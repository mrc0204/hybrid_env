"""Dijkstra Route Optimization Engine.

Routes over the real OpenStreetMap infrastructure fetched for a location,
using real coordinates: edges come from geographic proximity, weights from
metric distance, and risk penalties apply only to the edges that actually
pass near a risk.

That last property is the whole point. A penalty applied uniformly to every
edge cannot change which path wins — it just adds a constant to all of them.
Risk has to be *local* for avoidance to mean anything, and only then does the
chosen route genuinely bend around a hazard rather than merely being labelled
as if it had.

STRICT POLICY: if real infrastructure entities cannot be resolved for a
location, no path and no synthetic graph is generated (returns None).
Hardcoded fallback paths are forbidden — a route is a claim about real
geography, and inventing one makes it a false claim.
"""

import heapq
from math import asin, cos, radians, sin, sqrt

from app.contracts.domain import GeoLocation, RiskState, WorldEntity, WorldState

# Entity types that form the routable network. Buildings and amenities are
# destinations, not ways to travel along.
_ROUTABLE_TYPES = frozenset({"road", "footpath", "gate", "entrance"})

# Each node links to its nearest neighbours. Enough for alternative paths to
# exist (with too few the graph degenerates into a line and Dijkstra has
# nothing to choose between); few enough that it stays a road network rather
# than becoming a dense mesh where everything connects to everything.
_NEIGHBOURS_PER_NODE = 4

# How far a risk's influence reaches, in metres. Edges whose midpoint falls
# inside this radius are penalised, scaled by how close they are.
_RISK_INFLUENCE_M = 250.0

# Multiplier applied to an edge fully inside a risk's influence, by severity.
_SEVERITY_PENALTY = {"low": 1.5, "medium": 3.0, "high": 6.0, "critical": 10.0}

# Live congestion makes every edge more expensive — it is a property of the
# area, not of one road, so unlike risk it genuinely does apply uniformly.
_CONGESTION_MULTIPLIER = {"low": 1.0, "medium": 1.4, "high": 2.2}

_RISK_TYPES_AFFECTING_TRAVEL = frozenset(
    {"travel-delay", "congestion", "crowd-buildup", "heat-exposure"}
)


def _coords(entity: WorldEntity) -> GeoLocation | None:
    """Only real coordinates count. A string label is a name, not a position."""
    location = entity.location
    return location if isinstance(location, GeoLocation) else None


def haversine_m(a: GeoLocation, b: GeoLocation) -> float:
    """Great-circle distance in metres."""
    earth_radius_m = 6_371_000.0
    lat1, lng1, lat2, lng2 = map(radians, (a.lat, a.lng, b.lat, b.lng))
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * earth_radius_m * asin(sqrt(h))


class DijkstraRouter:
    """Graph router using Dijkstra's algorithm over real location infrastructure."""

    def calculate_optimal_route(
        self,
        risks: list[RiskState],
        world_state: WorldState | None = None,
    ) -> dict[str, object] | None:
        if not world_state or not world_state.entities:
            return None

        nodes = self._routable_nodes(world_state)
        if len(nodes) < 3:
            # Fewer than three points cannot express a choice between routes.
            return None

        risk_points = self._risk_points(risks, world_state)
        congestion = self._congestion_multiplier(world_state)
        graph = self._build_graph(nodes, risk_points, congestion)

        origin, destination = self._endpoints(nodes)
        if origin is None or destination is None or origin == destination:
            return None

        path, cost = self._shortest_path(graph, origin, destination)
        if not path:
            return None

        return {
            "path": path,
            "dijkstra_cost": cost,
            "real_entities_count": len(nodes),
        }

    # ── Graph construction ────────────────────────────────────────────────

    @staticmethod
    def _routable_nodes(world_state: WorldState) -> list[tuple[str, GeoLocation]]:
        """Distinct, positioned points of the travel network.

        Deduplicated by label because OSM splits a single road into many ways
        that all carry the same name; keeping them all would let one street
        dominate the graph.
        """
        seen: set[str] = set()
        nodes: list[tuple[str, GeoLocation]] = []
        for entity in world_state.entities:
            if entity.type not in _ROUTABLE_TYPES:
                continue
            label = (entity.label or "").strip()
            point = _coords(entity)
            if not label or point is None or label in seen:
                continue
            seen.add(label)
            nodes.append((label, point))
        return nodes

    @staticmethod
    def _risk_points(
        risks: list[RiskState], world_state: WorldState
    ) -> list[tuple[GeoLocation, str]]:
        """Where each travel-affecting risk actually sits, with its severity.

        A risk's own location is often the organization's label rather than a
        coordinate, so the entities it affects are used to place it.
        """
        by_id = {e.id: e for e in world_state.entities}
        points: list[tuple[GeoLocation, str]] = []

        for risk in risks:
            if risk.risk_type not in _RISK_TYPES_AFFECTING_TRAVEL:
                continue

            direct = risk.location if isinstance(risk.location, GeoLocation) else None
            if direct is not None:
                points.append((direct, risk.severity))
                continue

            for entity_id in risk.affected_entity_ids:
                entity = by_id.get(entity_id)
                point = _coords(entity) if entity else None
                if point is not None:
                    points.append((point, risk.severity))

        return points

    @staticmethod
    def _congestion_multiplier(world_state: WorldState) -> float:
        for entity in world_state.entities:
            if entity.type == "traffic-segment":
                level = entity.attributes.get("congestionLevel")
                if isinstance(level, str):
                    return _CONGESTION_MULTIPLIER.get(level, 1.0)
        return 1.0

    @staticmethod
    def _edge_penalty(
        a: GeoLocation, b: GeoLocation, risk_points: list[tuple[GeoLocation, str]]
    ) -> float:
        """Multiplier for traversing this edge, given nearby risks.

        Measured from the edge's midpoint, and falling off linearly with
        distance, so an edge running through a hazard costs far more than one
        skirting its outer edge — which is what gives Dijkstra a reason to
        prefer the detour.
        """
        midpoint = GeoLocation(lat=(a.lat + b.lat) / 2, lng=(a.lng + b.lng) / 2)
        penalty = 0.0
        for point, severity in risk_points:
            distance = haversine_m(midpoint, point)
            if distance >= _RISK_INFLUENCE_M:
                continue
            proximity = 1.0 - (distance / _RISK_INFLUENCE_M)
            penalty += _SEVERITY_PENALTY.get(severity, 2.0) * proximity
        return penalty

    def _build_graph(
        self,
        nodes: list[tuple[str, GeoLocation]],
        risk_points: list[tuple[GeoLocation, str]],
        congestion: float,
    ) -> dict[str, list[tuple[str, float]]]:
        """k-nearest-neighbour graph weighted by real distance and local risk."""
        graph: dict[str, list[tuple[str, float]]] = {label: [] for label, _ in nodes}

        for i, (label_a, point_a) in enumerate(nodes):
            distances = sorted(
                (
                    (haversine_m(point_a, point_b), j)
                    for j, (_, point_b) in enumerate(nodes)
                    if j != i
                ),
                key=lambda pair: pair[0],
            )

            for distance_m, j in distances[:_NEIGHBOURS_PER_NODE]:
                label_b, point_b = nodes[j]
                penalty = self._edge_penalty(point_a, point_b, risk_points)
                # Distance in metres is the base cost; risk multiplies it, so
                # avoiding a hazard is worth a proportional detour rather than
                # a fixed one.
                weight = round(distance_m * congestion * (1.0 + penalty), 2)

                if not any(n == label_b for n, _ in graph[label_a]):
                    graph[label_a].append((label_b, weight))
                if not any(n == label_a for n, _ in graph[label_b]):
                    graph[label_b].append((label_a, weight))

        return graph

    @staticmethod
    def _endpoints(
        nodes: list[tuple[str, GeoLocation]],
    ) -> tuple[str | None, str | None]:
        """Route across the site: from its most central point to its furthest.

        Both are derived from the fetched geometry rather than named up front,
        so the endpoints belong to the place being analysed.
        """
        if len(nodes) < 2:
            return None, None

        centre = GeoLocation(
            lat=sum(p.lat for _, p in nodes) / len(nodes),
            lng=sum(p.lng for _, p in nodes) / len(nodes),
        )
        origin_label, origin_point = min(nodes, key=lambda n: haversine_m(n[1], centre))
        destination_label, _ = max(nodes, key=lambda n: haversine_m(n[1], origin_point))
        return origin_label, destination_label

    # ── Search ────────────────────────────────────────────────────────────

    @staticmethod
    def _shortest_path(
        graph: dict[str, list[tuple[str, float]]], origin: str, destination: str
    ) -> tuple[list[str], float]:
        pq: list[tuple[float, str, list[str]]] = [(0.0, origin, [origin])]
        visited: set[str] = set()

        while pq:
            cost, current, path = heapq.heappop(pq)
            if current in visited:
                continue
            visited.add(current)

            if current == destination:
                return path, round(cost, 2)

            for neighbour, weight in graph.get(current, []):
                if neighbour not in visited:
                    heapq.heappush(pq, (cost + weight, neighbour, [*path, neighbour]))

        return [], 0.0
