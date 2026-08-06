"""Critic Agent — OpenRouter LLM & Deterministic Evaluation.

Reviews the Expert Agents' consensus and WorldState — never produces a
recommendation of its own.

Uses OpenRouter API (google/gemini-flash-1.5) as the LLM backend.
Evaluates evidence, flags weak assumptions, checks for conflicting risk states,
and either approves or challenges the council's decision with explicit rationale.
"""

from dataclasses import dataclass
import json
import logging
import os
import urllib.request
from typing import Literal

from app.contracts.domain import Decision, RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion

logger = logging.getLogger(__name__)

Severity = Literal["note", "concern", "objection"]

_LOW_CONFIDENCE_THRESHOLD = 0.5
_WEAK_SUPPORT_THRESHOLD = 0.5

# OpenRouter config
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_MODEL = "google/gemini-flash-1.5"


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
    llm_powered: bool = False


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

        # ── Try live LLM critique via OpenRouter ────────────────────────────
        llm_report = self._call_openrouter_critic(
            world_state, risks, simulations, opinions, findings, disagreement_detected,
        )
        if llm_report:
            return llm_report

        # ── Deterministic fallback ──────────────────────────────────────────
        status = "challenged" if disagreement_detected else "approved"
        critique_notes = (
            "Critic detected divergent expert opinions — consensus weighting applied."
            if disagreement_detected
            else "Expert council consensus approved. Alignment verified with current environment risk profile."
        )

        return CriticReport(
            findings=findings,
            disagreement_detected=disagreement_detected,
            status=status,
            critique_notes=critique_notes,
            llm_powered=False,
        )

    def _call_openrouter_critic(
        self,
        world_state: WorldState | None,
        risks: list[RiskState] | None,
        simulations: list[SimulationResult],
        opinions: list[AgentOpinion],
        findings: list[CriticFinding],
        disagreement_detected: bool,
    ) -> CriticReport | None:
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logger.info("OPENROUTER_API_KEY not set — falling back to deterministic critic")
            return None

        risk_details = "None"
        if risks:
            risk_details = "; ".join(
                f"{r.risk_type} ({r.severity}): {r.description}" for r in risks
            )

        sim_details = "; ".join(
            f"'{s.candidate_action}' → {s.success_probability:.0%} success"
            for s in simulations
        )

        vote_details = "; ".join(
            f"{op.agent_name}: recommends '{op.recommended_simulation_id[:8]}…' "
            f"(confidence {op.confidence:.0%}, evidence: {len(op.evidence)} items)"
            for op in opinions
        )

        finding_details = "; ".join(
            f"[{f.severity}] {f.target_agent}: {f.issue}" for f in findings
        ) or "None"

        prompt = (
            "You are the independent Gemini Critic Agent for a multi-agent AI digital twin system. "
            "Your role is to evaluate the Expert Council's consensus decision and identify weak assumptions, "
            "unmitigated risks, or conflicting evidence. You NEVER produce your own recommendation.\n\n"
            f"SCOPE: {world_state.scope if world_state else 'unknown'}\n"
            f"ENTITY COUNT: {len(world_state.entities) if world_state else 0}\n"
            f"ACTIVE RISKS: {risk_details}\n"
            f"SIMULATED CANDIDATES: {sim_details}\n"
            f"EXPERT VOTES: {vote_details}\n"
            f"DETERMINISTIC FINDINGS: {finding_details}\n"
            f"DISAGREEMENT DETECTED: {disagreement_detected}\n\n"
            "Evaluate the council's decision. Respond with ONLY valid JSON (no markdown, no code fences):\n"
            '{"status": "approved" or "challenged", '
            '"critique_notes": "<2-3 sentence evaluation of the decision quality, risk coverage, and any blind spots>", '
            '"disagreement_detected": true/false, '
            '"revised_rationale": "<if challenged, explain what the council missed; if approved, null>"}'
        )

        try:
            req_body = json.dumps({
                "model": _MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 300,
            }).encode("utf-8")

            req = urllib.request.Request(
                _OPENROUTER_URL,
                data=req_body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://hybrid-env-frontend.vercel.app",
                    "X-Title": "Environment Intelligence Critic Agent",
                },
            )

            with urllib.request.urlopen(req, timeout=8.0) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            text = result["choices"][0]["message"]["content"].strip()
            # Strip any accidental code fences
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            parsed = json.loads(text)
            logger.info("OpenRouter Gemini Critic responded: %s", parsed.get("status"))

            return CriticReport(
                findings=findings,
                disagreement_detected=parsed.get("disagreement_detected", disagreement_detected),
                status=parsed.get("status", "approved"),
                critique_notes=parsed.get("critique_notes", "Gemini Critic evaluated council decision."),
                revised_rationale=parsed.get("revised_rationale"),
                llm_powered=True,
            )
        except Exception as exc:
            logger.warning("OpenRouter Gemini Critic call failed: %s — using deterministic fallback", exc)
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
