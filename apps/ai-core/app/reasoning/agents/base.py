"""Shared types and helpers for the Expert Agents.

Every agent implements the same `analyze` contract so a future LLM-backed
agent can be swapped in later without touching the Critic or Consensus
Engine — only this interface has to be honored. Nothing here is a shared
contract: `AgentOpinion` is internal reasoning state, condensed into an
`ExpertVote` (the wire-facing shape) only once the Consensus Engine builds
the final `Decision`.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from app.contracts.domain import RiskState, SimulationResult, WorldState

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


@dataclass
class AgentOpinion:
    agent_name: str
    observations: list[str]
    concerns: list[str]
    priorities: list[str]
    recommended_simulation_id: str
    confidence: float
    evidence: list[str]


class ExpertAgent(Protocol):
    name: str

    def analyze(
        self,
        world_state: WorldState,
        risks: list[RiskState],
        simulations: list[SimulationResult],
    ) -> AgentOpinion: ...


def highest_severity_risk(risks: list[RiskState]) -> RiskState | None:
    if not risks:
        return None
    return max(risks, key=lambda r: _SEVERITY_RANK[r.severity])


def best_candidate(
    simulations: list[SimulationResult],
    score_fn: Callable[[SimulationResult], float],
) -> SimulationResult:
    """The candidate maximizing `score_fn`. Each agent passes its own scoring
    function, which is what makes the agents genuinely independent rather
    than the same ranking relabeled five times."""
    return max(simulations, key=score_fn)
