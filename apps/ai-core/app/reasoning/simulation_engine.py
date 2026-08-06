"""Reasoning Engine — simulation slice.

Generates the candidate actions the Expert Agents will independently score
and vote on. Deterministic by design (no ML/probabilistic modeling): success
probabilities come from a fixed severity-penalty table, not a learned model,
so the same WorldState always simulates the same candidates. Replaces the
single-candidate hack that used to live inside decision_engine.py.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import RiskState, SimulationResult, WorldState

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
_SEVERITY_PENALTY = {"low": 0.05, "medium": 0.12, "high": 0.22, "critical": 0.35}

_MITIGATION_ACTION_BY_RISK_TYPE = {
    "travel-delay": "Leave earlier than usual and take an alternate route away from the gate.",
    "congestion": "Use an alternate gate or route to avoid the congested area.",
}
_DEFAULT_MITIGATION_ACTION = "Take a precautionary alternate route until conditions improve."

_NO_RISK_ACTION = "Maintain current plan; continue monitoring."


class SimulationEngine:
    def simulate(self, world_state: WorldState, risks: list[RiskState]) -> list[SimulationResult]:
        now = datetime.now(UTC).isoformat()

        if not risks:
            return [
                self._build(
                    world_state.id,
                    _NO_RISK_ACTION,
                    "Conditions remain within normal parameters.",
                    [],
                    0.95,
                    now,
                )
            ]

        highest = max(risks, key=lambda r: _SEVERITY_RANK[r.severity])
        penalty = _SEVERITY_PENALTY[highest.severity]
        mitigation_p = round(max(0.5, 0.95 - penalty), 2)
        wait_p = round(max(0.15, mitigation_p - 0.30), 2)
        status_quo_p = round(max(0.10, mitigation_p - 0.45), 2)

        mitigation_action = _MITIGATION_ACTION_BY_RISK_TYPE.get(
            highest.risk_type, _DEFAULT_MITIGATION_ACTION
        )
        all_risk_ids = [r.id for r in risks]

        return [
            self._build(
                world_state.id,
                mitigation_action,
                f"Reduces exposure to the '{highest.risk_type}' risk; "
                f"~{round(mitigation_p * 100)}% chance of a normal, on-time arrival.",
                all_risk_ids,
                mitigation_p,
                now,
            ),
            self._build(
                world_state.id,
                "Wait and monitor before deciding on a route change.",
                "Delays the decision until conditions are clearer; risk exposure persists.",
                [],
                wait_p,
                now,
            ),
            self._build(
                world_state.id,
                "Proceed as normal without any route or timing change.",
                f"No change made; full exposure to the '{highest.risk_type}' risk remains.",
                [],
                status_quo_p,
                now,
            ),
        ]

    @staticmethod
    def _build(
        world_state_id: str,
        action: str,
        outcome: str,
        affected_risk_ids: list[str],
        success_probability: float,
        now: str,
    ) -> SimulationResult:
        return SimulationResult(
            id=f"sim-{uuid4()}",
            world_state_id=world_state_id,
            candidate_action=action,
            predicted_outcome=outcome,
            affected_risk_ids=affected_risk_ids,
            success_probability=success_probability,
            generated_at=now,
        )
