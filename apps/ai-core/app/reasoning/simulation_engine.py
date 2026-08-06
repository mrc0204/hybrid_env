"""Reasoning Engine — simulation slice.

Generates the candidate actions the Expert Agents will independently score
and vote on. Deterministic by design (no ML/probabilistic modeling): success
probabilities come from a fixed severity-penalty table, not a learned model,
so the same WorldState always simulates the same candidates.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.dijkstra_router import DijkstraRouter

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
_SEVERITY_PENALTY = {"low": 0.05, "medium": 0.12, "high": 0.22, "critical": 0.35}

_MITIGATION_ACTION_BY_RISK_TYPE = {
    "travel-delay": "Leave earlier than usual and take an alternate route away from the gate.",
    "congestion": "Use an alternate gate or route to avoid the congested area.",
    "heat-exposure": "Prefer shaded or indoor routes and carry water; avoid peak sun hours.",
    "crowd-buildup": "Arrive early or use a side entrance to avoid the event crowd.",
}
_DEFAULT_MITIGATION_ACTION = "Take a precautionary alternate route until conditions improve."

_NO_RISK_ACTION = "Maintain current plan; continue monitoring."


class SimulationEngine:
    def __init__(self) -> None:
        self.router = DijkstraRouter()

    def simulate(self, world_state: WorldState, risks: list[RiskState]) -> list[SimulationResult]:
        now = datetime.now(UTC).isoformat()

        # Run Dijkstra Shortest Path Algorithm over REAL location road network graph
        # Returns None if real infrastructure entities could not be resolved for this location
        route_eval = self.router.calculate_optimal_route(risks, world_state)
        dijkstra_path = route_eval["path"] if route_eval else None
        dijkstra_cost = route_eval["dijkstra_cost"] if route_eval else None

        if not risks:
            estimated_cost_str = (
                f"Dijkstra Cost: {dijkstra_cost} units" if dijkstra_cost is not None else None
            )
            return [
                self._build(
                    world_state.id,
                    _NO_RISK_ACTION,
                    "Conditions remain within normal parameters.",
                    [],
                    0.95,
                    now,
                    route_path=dijkstra_path,
                    dijkstra_cost=dijkstra_cost,
                    estimated_cost=estimated_cost_str,
                )
            ]

        highest = max(risks, key=lambda r: _SEVERITY_RANK[r.severity])
        penalty = _SEVERITY_PENALTY[highest.severity]
        mitigation_p = round(max(0.5, 0.95 - penalty), 2)
        wait_p = round(max(0.15, mitigation_p - 0.30), 2)
        status_quo_p = round(max(0.10, mitigation_p - 0.45), 2)

        all_risk_ids = [r.id for r in risks]

        if dijkstra_path and dijkstra_cost is not None:
            path_str = " → ".join(dijkstra_path)
            mitigation_action = (
                f"Dijkstra Route Optimization: Take alternate route ({path_str}) to avoid congestion."
            )
            outcome_text = (
                f"Calculated via Dijkstra shortest/least-cost path algorithm over live location data. "
                f"Reduces exposure to '{highest.risk_type}' risk (Impedance: {dijkstra_cost} units)."
            )
            estimated_cost_text = f"Dijkstra Cost: {dijkstra_cost} units (Optimal)"
        else:
            mitigation_action = _MITIGATION_ACTION_BY_RISK_TYPE.get(
                highest.risk_type, _DEFAULT_MITIGATION_ACTION
            )
            outcome_text = (
                f"Reduces exposure to the '{highest.risk_type}' risk; "
                f"~{round(mitigation_p * 100)}% chance of an on-time arrival."
            )
            estimated_cost_text = None

        return [
            self._build(
                world_state.id,
                mitigation_action,
                outcome_text,
                all_risk_ids,
                mitigation_p,
                now,
                route_path=dijkstra_path,
                dijkstra_cost=dijkstra_cost,
                estimated_cost=estimated_cost_text,
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
                f"No route change made; full exposure to the '{highest.risk_type}' risk remains.",
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
        route_path: list[str] | None = None,
        dijkstra_cost: float | None = None,
        estimated_cost: str | None = None,
    ) -> SimulationResult:
        return SimulationResult(
            id=f"sim-{uuid4()}",
            world_state_id=world_state_id,
            candidate_action=action,
            predicted_outcome=outcome,
            affected_risk_ids=affected_risk_ids,
            success_probability=success_probability,
            estimated_cost=estimated_cost,
            route_path=route_path,
            dijkstra_cost=dijkstra_cost,
            generated_at=now,
        )
