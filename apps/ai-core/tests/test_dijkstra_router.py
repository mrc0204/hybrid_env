from app.contracts.domain import RiskState
from app.reasoning.dijkstra_router import DijkstraRouter


def test_dijkstra_router_no_risks():
    router = DijkstraRouter()
    result = router.calculate_optimal_route([])

    assert result["path"] == [
        "Current Position",
        "Current Position Main Boulevard",
        "Current Position Main Entrance Gate",
        "Current Position Regional Outer Highway Link",
    ]
    assert result["dijkstra_cost"] == 1.5
    assert result["bypasses_congestion"] is False


def test_dijkstra_router_with_congestion_risk():
    router = DijkstraRouter()
    risk = RiskState(
        id="risk-1",
        risk_type="congestion",
        severity="high",
        status="active",
        description="Heavy bottleneck at Main South Gate",
        affected_entity_ids=[],
        world_state_id="ws-1",
        detected_at="2026-08-06T00:00:00Z",
        updated_at="2026-08-06T00:00:00Z",
    )
    result = router.calculate_optimal_route([risk])

    # Should dynamically route around the congested Main South Gate
    assert any("Perimeter" in p for p in result["path"])
    assert any("Service Gate" in p for p in result["path"])
    assert result["dijkstra_cost"] < result["direct_cost"]
    assert result["bypasses_congestion"] is True
