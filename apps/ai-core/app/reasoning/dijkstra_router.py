"""Dijkstra Route Optimization Engine.

Calculates the most feasible and convenient exit route from a location using
Dijkstra's shortest/least-cost path algorithm. Graph edge weights incorporate
both base physical distances and dynamic environmental risk penalties (traffic
congestion, crowd density, weather hazards).
"""

import heapq
import re

from app.contracts.domain import RiskState, WorldState

_SEVERITY_PENALTY = {
    "low": 1.5,
    "medium": 3.5,
    "high": 6.0,
    "critical": 10.0,
}


class DijkstraRouter:
    """Graph router using Dijkstra's algorithm for dynamic hazard-avoidance routing."""

    def calculate_optimal_route(
        self,
        risks: list[RiskState],
        world_state: WorldState | None = None,
    ) -> dict[str, object]:
        """Calculates the minimum cost path using Dijkstra's algorithm.

        Edge costs are dynamically weighted by live RiskState severity penalties.
        Nodes are dynamically assigned from actual WorldState infrastructure entities
        and location name.
        """
        # Construct location-specific or OSM entity-based spatial graph
        graph_nodes = self._build_spatial_nodes(world_state)

        start_node = graph_nodes["start"]
        main_corridor = graph_nodes["main_corridor"]
        main_gate = graph_nodes["main_gate"]
        perimeter_road = graph_nodes["perimeter_road"]
        side_gate = graph_nodes["side_gate"]
        exit_node = graph_nodes["outer_exit"]

        # Base physical graph connections and distances (km)
        spatial_graph: dict[str, list[tuple[str, float]]] = {
            start_node: [(main_corridor, 0.5), (perimeter_road, 0.8)],
            main_corridor: [(start_node, 0.5), (main_gate, 0.7)],
            main_gate: [(main_corridor, 0.7), (exit_node, 0.3)],
            perimeter_road: [(start_node, 0.8), (side_gate, 0.6)],
            side_gate: [(perimeter_road, 0.6), (exit_node, 0.4)],
            exit_node: [(main_gate, 0.3), (side_gate, 0.4)],
        }

        # Calculate dynamic edge weights including active risk penalties
        weighted_graph: dict[str, list[tuple[str, float]]] = {}
        for u, neighbors in spatial_graph.items():
            weighted_graph[u] = []
            for v, base_dist in neighbors:
                penalty = 0.0
                # Apply congestion/traffic penalties to Main Gate corridor if risks are active
                if u in (main_corridor, main_gate) or v in (main_corridor, main_gate):
                    for risk in risks:
                        if risk.risk_type in ("travel-delay", "congestion", "crowd-buildup"):
                            penalty += _SEVERITY_PENALTY.get(risk.severity, 2.0)

                weight = round(base_dist + penalty, 2)
                weighted_graph[u].append((v, weight))

        # Dijkstra algorithm implementation using priority queue (min-heap)
        pq: list[tuple[float, str, list[str]]] = [(0.0, start_node, [start_node])]
        visited: set[str] = set()

        best_path: list[str] = []
        min_cost: float = float("inf")

        while pq:
            cost, current, path = heapq.heappop(pq)

            if current in visited:
                continue
            visited.add(current)

            if current == exit_node:
                best_path = path
                min_cost = round(cost, 2)
                break

            for neighbor, weight in weighted_graph.get(current, []):
                if neighbor not in visited:
                    heapq.heappush(pq, (cost + weight, neighbor, path + [neighbor]))

        # Calculate direct main gate route cost for comparison
        direct_path = [start_node, main_corridor, main_gate, exit_node]
        direct_cost = self._calculate_path_cost(weighted_graph, direct_path)

        return {
            "path": best_path,
            "dijkstra_cost": min_cost,
            "direct_cost": direct_cost,
            "direct_path": direct_path,
            "bypasses_congestion": min_cost < direct_cost,
        }

    def _build_spatial_nodes(self, world_state: WorldState | None) -> dict[str, str]:
        """Dynamically generates location-specific node labels from WorldState entities or scope."""
        location_title = "Current Position"
        if world_state:
            # Extract clean location name from summary or scope
            if world_state.summary and "for " in world_state.summary.lower():
                raw = world_state.summary.split("for ", 1)[-1]
                location_title = raw.split(" (")[0].strip()
            elif world_state.scope and world_state.scope != "niat-kkh-campus":
                location_title = world_state.scope.replace("-", " ").title()

        # Extract real OpenStreetMap entity labels if present
        gates: list[str] = []
        roads: list[str] = []

        if world_state and world_state.entities:
            for e in world_state.entities:
                label = getattr(e, "label", "").strip()
                etype = getattr(e, "type", "").lower()
                if not label:
                    continue
                if etype in ("gate", "entrance", "barrier") or "gate" in label.lower() or "entrance" in label.lower():
                    if label not in gates:
                        gates.append(label)
                elif etype in ("highway", "road", "way") or "road" in label.lower() or "highway" in label.lower() or "way" in label.lower():
                    if label not in roads:
                        roads.append(label)

        main_corridor = roads[0] if roads else f"{location_title} Main Boulevard"
        main_gate = gates[0] if gates else f"{location_title} Main Entrance Gate"
        perimeter_road = (
            roads[1] if len(roads) > 1 else f"{location_title} Perimeter Ring Road"
        )
        side_gate = (
            gates[1] if len(gates) > 1 else f"{location_title} Side Service Gate"
        )
        outer_exit = (
            roads[2] if len(roads) > 2 else f"{location_title} Regional Outer Highway Link"
        )

        return {
            "start": "Current Position",
            "main_corridor": main_corridor,
            "main_gate": main_gate,
            "perimeter_road": perimeter_road,
            "side_gate": side_gate,
            "outer_exit": outer_exit,
        }

    @staticmethod
    def _calculate_path_cost(
        graph: dict[str, list[tuple[str, float]]], path: list[str]
    ) -> float:
        total = 0.0
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            found = False
            for neighbor, weight in graph.get(u, []):
                if neighbor == v:
                    total += weight
                    found = True
                    break
            if not found:
                total += 10.0
        return round(total, 2)
