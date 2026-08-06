"""Operations Agent — maintain efficient campus operations.

Scoring: success probability minus a throughput-disruption penalty. Waiting
is penalized most (it stalls operational flow while resolving nothing);
a route/timing change carries a small penalty; doing nothing carries none.
This is a flat-penalty model, deliberately simpler than Safety's
mitigation-first rule — Operations doesn't care *why* a candidate works,
only how cheaply it does.
"""

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion, best_candidate, highest_severity_risk

_WAIT_PENALTY = 0.20
_CHANGE_PENALTY = 0.05
_NO_CHANGE_PENALTY = 0.0


def _disruption_penalty(action: str) -> float:
    lowered = action.lower()
    if "wait" in lowered:
        return _WAIT_PENALTY
    if "proceed as normal" in lowered or "maintain current plan" in lowered:
        return _NO_CHANGE_PENALTY
    return _CHANGE_PENALTY


class OperationsAgent:
    name = "Operations Agent"

    def analyze(
        self,
        world_state: WorldState,
        risks: list[RiskState],
        simulations: list[SimulationResult],
    ) -> AgentOpinion:
        top_risk = highest_severity_risk(risks)

        def score(sim: SimulationResult) -> float:
            return sim.success_probability - _disruption_penalty(sim.candidate_action)

        chosen = best_candidate(simulations, score)
        penalty = _disruption_penalty(chosen.candidate_action)

        observations = [f"{len(simulations)} candidate action(s) evaluated for operational cost."]
        concerns = (
            ["Waiting delays throughput without resolving the underlying condition."]
            if "wait" in chosen.candidate_action.lower()
            else []
        )
        evidence = [f"Selected candidate carries an estimated disruption cost of {penalty:.2f}."]
        if top_risk:
            evidence.append(top_risk.description)

        return AgentOpinion(
            agent_name=self.name,
            observations=observations,
            concerns=concerns,
            priorities=["Maintain efficient campus operations", "Minimize unnecessary delay"],
            recommended_simulation_id=chosen.id,
            confidence=round(min(1.0, chosen.success_probability), 2),
            evidence=evidence,
        )
