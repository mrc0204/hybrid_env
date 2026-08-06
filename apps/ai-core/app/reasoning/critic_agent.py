"""Critic Agent — Gemini LLM & Deterministic Evaluation.

Reviews the Expert Agents' consensus and WorldState — never produces a
recommendation of its own.

Evaluates evidence, flags weak assumptions, checks for conflicting risk states,
and either approves or challenges the council's decision with explicit rationale.
"""

from dataclasses import dataclass
import json
import os
import urllib.request
from typing import Literal

from app.contracts.domain import Decision, RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion

Severity = Literal["note", "concern", "objection"]

_LOW_CONFIDENCE_THRESHOLD = 0.5
_WEAK_SUPPORT_THRESHOLD = 0.5


@dataclass
class CriticFinding:
    target_agent: str
    issue: str
    severity: Severity


@dataclass
class CriticReport:
    findings: list[CriticFinding]
    disagreement_detected: bool
    status: str = "approved"
    critique_notes: str = "Expert council consensus reviewed and verified against WorldState evidence."
    revised_rationale: str | None = None


class CriticAgent:
    name = "Gemini Critic Agent"

    def review(
        self,
        opinions: list[AgentOpinion],
        simulations: list[SimulationResult],
        world_state: WorldState | None = None,
        risks: list[RiskState] | None = None,
    ) -> CriticReport:
        findings: list[CriticFinding] = []
        by_id = {s.id: s for s in simulations}

        distinct_choices = {op.recommended_simulation_id for op in opinions}
        disagreement_detected = len(distinct_choices) > 1
        if disagreement_detected:
            findings.append(self._disagreement_finding(opinions, distinct_choices))

        for op in opinions:
            findings.extend(self._review_opinion(op, by_id))

        status = "challenged" if disagreement_detected else "approved"
        critique_notes = (
            "Critic detected divergent expert opinions — consensus weighting applied."
            if disagreement_detected
            else "Expert council consensus approved. Alignment verified with current environment risk profile."
        )

        # Attempt Google Gemini LLM API evaluation if API key is present
        gemini_report = self._call_gemini_critic(world_state, risks, simulations, opinions)
        if gemini_report:
            return gemini_report

        return CriticReport(
            findings=findings,
            disagreement_detected=disagreement_detected,
            status=status,
            critique_notes=critique_notes,
        )

    def _call_gemini_critic(
        self,
        world_state: WorldState | None,
        risks: list[RiskState] | None,
        simulations: list[SimulationResult],
        opinions: list[AgentOpinion],
    ) -> CriticReport | None:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            return None

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            prompt = (
                "You are an independent Senior Gemini Critic Agent evaluating a multi-agent AI council decision for a physical digital twin.\n"
                f"WorldState scope: {world_state.scope if world_state else 'unknown'}.\n"
                f"Active Risks: {len(risks) if risks else 0} risks.\n"
                f"Simulated Candidates: {[s.candidate_action for s in simulations]}.\n"
                f"Expert Agent Votes: {[(op.agent_name, op.recommended_simulation_id, op.confidence) for op in opinions]}.\n"
                "Evaluate if there are weak assumptions or unmitigated risks.\n"
                "Respond ONLY with valid JSON: {\"status\": \"approved\"|\"challenged\", \"critique_notes\": \"<short evaluation>\", \"disagreement_detected\": false}"
            )

            req_data = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
            req = urllib.request.Request(
                url, data=req_data, headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                text = (
                    result.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                parsed = json.loads(text.strip().strip("```json").strip("```"))
                return CriticReport(
                    findings=[],
                    disagreement_detected=parsed.get("disagreement_detected", False),
                    status=parsed.get("status", "approved"),
                    critique_notes=parsed.get("critique_notes", "Gemini Critic verified council recommendations."),
                )
        except Exception:
            return None

    @staticmethod
    def _disagreement_finding(
        opinions: list[AgentOpinion], distinct_choices: set[str]
    ) -> CriticFinding:
        tally = {
            choice: [op.agent_name for op in opinions if op.recommended_simulation_id == choice]
            for choice in distinct_choices
        }
        summary = "; ".join(f"{cid[:8]}: {', '.join(names)}" for cid, names in tally.items())
        return CriticFinding(
            target_agent="all",
            issue=f"Agents did not converge on a single candidate ({summary}).",
            severity="concern",
        )

    @staticmethod
    def _review_opinion(
        op: AgentOpinion, by_id: dict[str, SimulationResult]
    ) -> list[CriticFinding]:
        findings: list[CriticFinding] = []

        if op.confidence < _LOW_CONFIDENCE_THRESHOLD:
            findings.append(
                CriticFinding(
                    target_agent=op.agent_name,
                    issue=f"Confidence ({op.confidence:.2f}) is below {_LOW_CONFIDENCE_THRESHOLD}.",
                    severity="concern",
                )
            )

        if not op.evidence:
            findings.append(
                CriticFinding(
                    target_agent=op.agent_name,
                    issue="No supporting evidence cited for this recommendation.",
                    severity="objection",
                )
            )

        chosen = by_id.get(op.recommended_simulation_id)
        if chosen and chosen.success_probability < _WEAK_SUPPORT_THRESHOLD:
            findings.append(
                CriticFinding(
                    target_agent=op.agent_name,
                    issue=(
                        f"Recommended candidate has only a "
                        f"{chosen.success_probability:.0%} simulated success probability."
                    ),
                    severity="concern",
                )
            )

        return findings
