"""Holds the full cognitive trace behind the most recent /reason call.

/reason itself keeps returning only the Recommendation (unchanged contract,
so the Backend pipeline built in Milestone 4 needs no changes). This is a
separate, additive read path — GET /trace/latest — for the Frontend's
Reasoning Spine to show the real WorldState/RiskState/SimulationResult/
Decision behind the last recommendation instead of mocking them.

Same in-process-singleton pattern as WorldModelService: one instance on
app.state, no persistence, overwritten each cycle.
"""

from app.contracts.api import ReasonTrace


class TraceService:
    def __init__(self) -> None:
        self._latest: ReasonTrace | None = None

    def set(self, trace: ReasonTrace) -> None:
        self._latest = trace

    def get(self) -> ReasonTrace | None:
        return self._latest
