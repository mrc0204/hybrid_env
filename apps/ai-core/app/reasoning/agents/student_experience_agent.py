"""Student Experience Agent — minimize disruption to students.

Scoring: success probability minus a schedule-disruption penalty, weighted
toward avoiding last-minute changes. Similar shape to Operations' model but
different magnitudes and framing — Operations cares about throughput cost,
this agent cares about a student's plans being upended.
"""

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion, best_candidate, highest_severity_risk

_WAIT_PENALTY = 0.15
_REROUTE_PENALTY = 0.10
_NO_CHANGE_PENALTY = 0.0


def _disruption_penalty(action: str) -> float:
    lowered = action.lower()
    if "wait" in lowered:
        return _WAIT_PENALTY
    if "proceed as normal" in lowered or "maintain current plan" in lowered:
        return _NO_CHANGE_PENALTY
    return _REROUTE_PENALTY


class StudentExperienceAgent:
    name = "Student Experience Agent"

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
        disrupts_schedule = _disruption_penalty(chosen.candidate_action) > 0

        concerns = (
            ["Recommended change may affect punctuality for scheduled classes."]
            if disrupts_schedule
            else []
        )
        evidence = ["Candidate minimizes deviation from the student's existing schedule."]
        if top_risk:
            evidence.append(top_risk.description)

        return AgentOpinion(
            agent_name=self.name,
            observations=[f"{len(simulations)} candidate(s) evaluated for schedule impact."],
            concerns=concerns,
            priorities=["Minimize disruption to students", "Preserve on-time class attendance"],
            recommended_simulation_id=chosen.id,
            confidence=round(min(1.0, chosen.success_probability), 2),
            evidence=evidence,
        )
