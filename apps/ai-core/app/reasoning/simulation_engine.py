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
from app.reasoning.dijkstra_router import DijkstraRouter

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
_SEVERITY_PENALTY = {"low": 0.05, "medium": 0.12, "high": 0.22, "critical": 0.35}

_NO_RISK_ACTION = "Maintain current plan; continue monitoring."


class SimulationEngine:
    def __init__(self) -> None:
        self.router = DijkstraRouter()

    def simulate(self, world_state: WorldState, risks: list[RiskState]) -> list[SimulationResult]:
        now = datetime.now(UTC).isoformat()

        # Run Dijkstra Shortest Path Algorithm over dynamic road graph
        route_eval = self.router.calculate_optimal_route(risks)
        dijkstra_path = route_eval["path"]
        dijkstra_cost = route_eval["dijkstra_cost"]
        direct_cost = route_eval["direct_cost"]

        if not risks:
            return [
                self._build(
                    world_state.id,
                    _NO_RISK_ACTION,
                    "Conditions remain within normal parameters. Dijkstra graph optimal route is clear.",
                    [],
                    0.95,
                    now,
                    route_path=dijkstra_path,
                    dijkstra_cost=dijkstra_cost,
                    estimated_cost=f"Dijkstra Cost: {dijkstra_cost} units",
                )
            ]

        highest = max(risks, key=lambda r: _SEVERITY_RANK[r.severity])
        penalty = _SEVERITY_PENALTY[highest.severity]
        mitigation_p = round(max(0.5, 0.95 - penalty), 2)
        wait_p = round(max(0.15, mitigation_p - 0.30), 2)
        status_quo_p = round(max(0.10, mitigation_p - 0.45), 2)

        all_risk_ids = [r.id for r in risks]
        path_str = " → ".join(dijkstra_path) if dijkstra_path else "Alternate Route"

        dijkstra_action = (
            f"Dijkstra Route Optimization: Take alternate route ({path_str}) to avoid congestion bottlenecks."
        )

        direct_path = [
            "Current Position",
            "Main Corridor Junction",
            "Main South Gate Exit",
            "Regional Outer Ring Highway",
        ]

        return [
            self._build(
                world_state.id,
                dijkstra_action,
                f"Calculated via Dijkstra shortest/least-cost path algorithm. "
                f"Reduces exposure to '{highest.risk_type}' risk (Impedance: {dijkstra_cost} units vs Direct {direct_cost} units).",
                all_risk_ids,
                mitigation_p,
                now,
                route_path=dijkstra_path,
                dijkstra_cost=dijkstra_cost,
                estimated_cost=f"Dijkstra Cost: {dijkstra_cost} units (Optimal)",
            ),
            self._build(
                world_state.id,
                "Wait and monitor before deciding on a route change.",
                "Delays the decision until conditions are clearer; risk exposure persists.",
                [],
                wait_p,
                now,
                estimated_cost="Deferred routing evaluation",
            ),
            self._build(
                world_state.id,
                f"Proceed via direct route ({' → '.join(direct_path)}).",
                f"No route change made; experiences heavy congestion bottleneck (Impedance: {direct_cost} units).",
                [],
                status_quo_p,
                now,
                route_path=direct_path,
                dijkstra_cost=direct_cost,
                estimated_cost=f"Dijkstra Cost: {direct_cost} units (Congested)",
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
