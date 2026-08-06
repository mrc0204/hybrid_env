"""Dijkstra Route Optimization Engine.

Calculates the most feasible and convenient exit route from a location using
Dijkstra's shortest/least-cost path algorithm. Graph edge weights incorporate
both base physical distances and dynamic environmental risk penalties (traffic
congestion, crowd density, weather hazards).
"""

import heapq

from app.contracts.domain import RiskState

_SEVERITY_PENALTY = {
    "low": 1.5,
    "medium": 3.5,
    "high": 6.0,
    "critical": 10.0,
}


class DijkstraRouter:
    """Graph router using Dijkstra's algorithm for dynamic hazard-avoidance routing."""

    def __init__(self) -> None:
        # Default spatial road network graph for campus/facility environments
        # Format: node -> list of (neighbor_node, base_distance_km)
        self.default_graph: dict[str, list[tuple[str, float]]] = {
            "Current Position": [("Main Corridor Junction", 0.5), ("North Perimeter Road", 0.8)],
            "Main Corridor Junction": [("Current Position", 0.5), ("Main South Gate Exit", 0.7)],
            "Main South Gate Exit": [
                ("Main Corridor Junction", 0.7),
                ("Regional Outer Ring Highway", 0.3),
            ],
            "North Perimeter Road": [("Current Position", 0.8), ("West Outer Gate", 0.6)],
            "West Outer Gate": [
                ("North Perimeter Road", 0.6),
                ("Regional Outer Ring Highway", 0.4),
            ],
            "Regional Outer Ring Highway": [
                ("Main South Gate Exit", 0.3),
                ("West Outer Gate", 0.4),
            ],
        }

    def calculate_optimal_route(
        self,
        risks: list[RiskState],
        start_node: str = "Current Position",
        exit_node: str = "Regional Outer Ring Highway",
    ) -> dict[str, object]:
        """Calculates the minimum cost path using Dijkstra's algorithm.

        Edge costs are dynamically weighted by live RiskState severity penalties.
        """
        # Calculate dynamic edge weights
        weighted_graph: dict[str, list[tuple[str, float]]] = {}
        for u, neighbors in self.default_graph.items():
            weighted_graph[u] = []
            for v, base_dist in neighbors:
                penalty = 0.0
                # Apply congestion/traffic penalties to Main Gate corridor if risks are active
                if u in ("Main Corridor Junction", "Main South Gate Exit") or v in (
                    "Main Corridor Junction",
                    "Main South Gate Exit",
                ):
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

        # Calculate alternative direct cost for comparison
        direct_cost = self._calculate_path_cost(
            weighted_graph,
            [
                "Current Position",
                "Main Corridor Junction",
                "Main South Gate Exit",
                "Regional Outer Ring Highway",
            ],
        )

        return {
            "path": best_path,
            "dijkstra_cost": min_cost,
            "direct_cost": direct_cost,
            "bypasses_congestion": min_cost < direct_cost,
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
