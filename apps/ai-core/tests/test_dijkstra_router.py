from app.contracts.domain import GeoLocation, RiskState, WorldEntity, WorldState
from app.reasoning.dijkstra_router import DijkstraRouter


def _sample_world_state() -> WorldState:
    return WorldState(
        id="ws-1",
        scope="iit-hyderabad",
        version=1,
        generated_at="2026-08-06T00:00:00Z",
        summary="Environment state for IIT Hyderabad",
        entities=[
            WorldEntity(
                id="e1",
                type="road",
                label="Kandi Main Access Road",
                location=GeoLocation(lat=17.592, lng=78.121),
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e2",
                type="gate",
                label="IIT Main Entrance Gate",
                location=GeoLocation(lat=17.594, lng=78.123),
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e3",
                type="road",
                label="North Campus Perimeter Ring",
                location=GeoLocation(lat=17.598, lng=78.120),
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e4",
                type="gate",
                label="West Side Service Gate",
                location=GeoLocation(lat=17.599, lng=78.118),
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e5",
                type="road",
                label="NH 65 Outer Expressway Link",
                location=GeoLocation(lat=17.602, lng=78.115),
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
        ],
        source_event_ids=[],
    )


def test_dijkstra_router_returns_none_when_no_entities():
    router = DijkstraRouter()
    # Empty world state (no entities) must return None — NO hardcoded path allowed!
    empty_ws = WorldState(
        id="ws-0",
        scope="empty",
        version=1,
        generated_at="2026-08-06T00:00:00Z",
        summary="",
        entities=[],
        source_event_ids=[],
    )
    result = router.calculate_optimal_route([], empty_ws)
    assert result is None


def test_dijkstra_router_computes_path_from_real_entities():
    router = DijkstraRouter()
    ws = _sample_world_state()
    result = router.calculate_optimal_route([], ws)

    assert result is not None
    assert len(result["path"]) >= 2
    assert result["dijkstra_cost"] > 0


def test_dijkstra_router_with_congestion_risk_over_real_entities():
    router = DijkstraRouter()
    ws = _sample_world_state()
    risk = RiskState(
        id="risk-1",
        risk_type="congestion",
        severity="high",
        status="active",
        description="Heavy traffic bottleneck at Main Entrance",
        affected_entity_ids=["e2"],
        world_state_id="ws-1",
        detected_at="2026-08-06T00:00:00Z",
        updated_at="2026-08-06T00:00:00Z",
    )
    result = router.calculate_optimal_route([risk], ws)

    assert result is not None
    assert "North Campus Perimeter Ring" in result["path"]
    assert result["dijkstra_cost"] > 0
