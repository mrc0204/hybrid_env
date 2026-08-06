from app.contracts.domain import RiskState, WorldEntity, WorldState
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
                type="highway",
                label="Kandi Main Access Road",
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e2",
                type="gate",
                label="IIT Main Entrance Gate",
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e3",
                type="road",
                label="North Campus Perimeter Ring",
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e4",
                type="gate",
                label="West Side Service Gate",
                attributes={},
                updated_at="2026-08-06T00:00:00Z",
            ),
            WorldEntity(
                id="e5",
                type="highway",
                label="NH 65 Outer Expressway Link",
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
    assert result["path"][0] == "Current Position"
    assert any("North Campus Perimeter Ring" in p for p in result["path"])
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
    # Should dynamically route via North Campus Perimeter Ring & West Side Service Gate
    assert "North Campus Perimeter Ring" in result["path"]
    assert "West Side Service Gate" in result["path"]
