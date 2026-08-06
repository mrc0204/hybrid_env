"""Sustainability Agent — reduce unnecessary environmental impact.

Scoring: adds a bonus to candidates that avoid an unnecessary route change,
but only when the active risk is low/medium severity — the bonus is
withdrawn entirely at high/critical severity so environmental preference
never overrides safety when it actually matters. This severity-gated bonus
is what lets Sustainability disagree with probability-maximizing agents on
minor risks while still converging with them on serious ones.
"""

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion, best_candidate, highest_severity_risk

_LOW_STAKES_BONUS = 0.20


def _is_status_quo(action: str) -> bool:
    lowered = action.lower()
    return "proceed as normal" in lowered or "maintain current plan" in lowered


class SustainabilityAgent:
    name = "Sustainability Agent"

    def analyze(
        self,
        world_state: WorldState,
        risks: list[RiskState],
        simulations: list[SimulationResult],
    ) -> AgentOpinion:
        top_risk = highest_severity_risk(risks)
        low_stakes = top_risk is None or top_risk.severity in ("low", "medium")

        def score(sim: SimulationResult) -> float:
            bonus = (
                _LOW_STAKES_BONUS if (low_stakes and _is_status_quo(sim.candidate_action)) else 0.0
            )
            return sim.success_probability + bonus

        chosen = best_candidate(simulations, score)
        avoided_unnecessary_travel = _is_status_quo(chosen.candidate_action)

        concerns = (
            []
            if avoided_unnecessary_travel or not low_stakes
            else ["Rerouting for a low-severity risk adds avoidable travel distance."]
        )
        evidence = [
            (
                "Avoided an unnecessary route change for a low/medium-severity risk."
                if avoided_unnecessary_travel and low_stakes
                else "Risk severity justifies the environmental cost of a route change."
            )
        ]

        return AgentOpinion(
            agent_name=self.name,
            observations=[
                (
                    "Low/medium-severity risk — environmental cost weighed against benefit."
                    if low_stakes
                    else "High/critical risk — safety takes precedence over environmental cost."
                )
            ],
            concerns=concerns,
            priorities=[
                "Avoid unnecessary environmental impact",
                "Prefer minimal-footprint options",
            ],
            recommended_simulation_id=chosen.id,
            confidence=round(min(1.0, chosen.success_probability), 2),
            evidence=evidence,
        )
