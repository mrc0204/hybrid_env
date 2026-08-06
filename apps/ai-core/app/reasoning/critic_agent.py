"""Critic Agent.

Reviews the Expert Agents' opinions — never produces a recommendation of its
own. Deterministically flags: disagreement between agents, low agent
confidence, opinions with no cited evidence, and recommendations whose
chosen candidate has a weak simulated success probability.
"""

from dataclasses import dataclass
from typing import Literal

from app.contracts.domain import SimulationResult
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


class CriticAgent:
    name = "Critic"

    def review(
        self, opinions: list[AgentOpinion], simulations: list[SimulationResult]
    ) -> CriticReport:
        findings: list[CriticFinding] = []
        by_id = {s.id: s for s in simulations}

        distinct_choices = {op.recommended_simulation_id for op in opinions}
        disagreement_detected = len(distinct_choices) > 1
        if disagreement_detected:
            findings.append(self._disagreement_finding(opinions, distinct_choices))

        for op in opinions:
            findings.extend(self._review_opinion(op, by_id))

        return CriticReport(findings=findings, disagreement_detected=disagreement_detected)

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
