"""Accessibility Agent — ensure recommendations remain accessible and inclusive.

Scoring: below high/critical severity, a route or timing change is treated
as an accessibility cost (unverified alternate paths may not be step-free,
well-lit, or short) and is only accepted if it isn't much better than
keeping the current route. At high/critical severity, that tolerance is
dropped — leaving someone in a genuinely dangerous situation is itself an
accessibility failure, so Accessibility defers to whichever candidate is
most likely to succeed, same as Safety would.
"""

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion, best_candidate, highest_severity_risk

_TOLERANCE = 0.25


def _is_status_quo(action: str) -> bool:
    lowered = action.lower()
    return "proceed as normal" in lowered or "maintain current plan" in lowered


class AccessibilityAgent:
    name = "Accessibility Agent"

    def analyze(
        self,
        world_state: WorldState,
        risks: list[RiskState],
        simulations: list[SimulationResult],
    ) -> AgentOpinion:
        top_risk = highest_severity_risk(risks)
        severity_critical = top_risk is not None and top_risk.severity in ("high", "critical")

        best_by_probability = best_candidate(simulations, lambda s: s.success_probability)
        status_quo_candidates = [s for s in simulations if _is_status_quo(s.candidate_action)]

        if not severity_critical and status_quo_candidates:
            status_quo = max(status_quo_candidates, key=lambda s: s.success_probability)
            gap = best_by_probability.success_probability - status_quo.success_probability
            chosen = status_quo if gap <= _TOLERANCE else best_by_probability
        else:
            chosen = best_by_probability

        is_status_quo = _is_status_quo(chosen.candidate_action)
        confidence = 0.8 if is_status_quo else round(chosen.success_probability * 0.9, 2)

        concerns = (
            []
            if is_status_quo
            else ["Alternate route accessibility (step-free access, distance) is unverified."]
        )
        evidence = [
            (
                "No verified accessibility data for alternate routes in this WorldState."
                if not is_status_quo
                else "Current route requires no accessibility re-verification."
            )
        ]
        if top_risk:
            evidence.append(top_risk.description)

        return AgentOpinion(
            agent_name=self.name,
            observations=[
                f"Evaluated {len(simulations)} candidate(s) for accessibility impact.",
                (
                    "High/critical risk overrides route-change caution."
                    if severity_critical
                    else "No high/critical risk — route-change caution applies."
                ),
            ],
            concerns=concerns,
            priorities=[
                "Keep recommendations accessible and inclusive",
                "Avoid unverified route changes",
            ],
            recommended_simulation_id=chosen.id,
            confidence=confidence,
            evidence=evidence,
        )
