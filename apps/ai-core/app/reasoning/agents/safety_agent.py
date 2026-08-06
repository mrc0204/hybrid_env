"""Safety Agent — protect people and minimize risk.

Scoring: prefers any candidate that mitigates the highest-severity active
risk over one that doesn't, and only breaks ties on success probability.
This is a lexicographic preference (mitigate first, optimize second), which
is what makes Safety behave differently from agents that only ever chase
the raw probability number.
"""

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion, best_candidate, highest_severity_risk


class SafetyAgent:
    name = "Safety Agent"

    def analyze(
        self,
        world_state: WorldState,
        risks: list[RiskState],
        simulations: list[SimulationResult],
    ) -> AgentOpinion:
        top_risk = highest_severity_risk(risks)

        def score(sim: SimulationResult) -> tuple[int, float]:
            addresses_top_risk = bool(top_risk and top_risk.id in sim.affected_risk_ids)
            return (1 if addresses_top_risk else 0, sim.success_probability)

        chosen = best_candidate(simulations, score)

        observations = [f"{len(risks)} active risk(s) in the current WorldState."]
        concerns: list[str] = []
        evidence: list[str] = []

        if top_risk:
            observations.append(
                f"Highest-severity risk: '{top_risk.risk_type}' ({top_risk.severity})."
            )
            evidence.append(top_risk.description)
            if top_risk.severity in ("high", "critical"):
                concerns.append(
                    "Elevated risk severity requires proactive mitigation, not monitoring."
                )
        else:
            evidence.append("No active risks in the current WorldState.")

        return AgentOpinion(
            agent_name=self.name,
            observations=observations,
            concerns=concerns,
            priorities=["Minimize risk exposure", "Protect physical safety of students and staff"],
            recommended_simulation_id=chosen.id,
            confidence=chosen.success_probability,
            evidence=evidence,
        )
