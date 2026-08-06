from datetime import UTC, datetime

from app.contracts.domain import RiskState, WorldState
from app.reasoning.simulation_engine import SimulationEngine


def _world_state() -> WorldState:
    return WorldState(
        id="ws-test",
        scope="test",
        version=1,
        generated_at=datetime.now(UTC).isoformat(),
        summary="test",
        entities=[],
        source_event_ids=[],
    )


def _risk(risk_type: str, severity: str) -> RiskState:
    now = datetime.now(UTC).isoformat()
    return RiskState(
        id=f"risk-{risk_type}",
        risk_type=risk_type,
        severity=severity,
        status="active",
        description=f"{risk_type} risk",
        affected_entity_ids=[],
        world_state_id="ws-test",
        detected_at=now,
        updated_at=now,
    )


def test_no_risks_yields_a_single_high_confidence_candidate() -> None:
    candidates = SimulationEngine().simulate(_world_state(), [])

    assert len(candidates) == 1
    assert candidates[0].affected_risk_ids == []
    assert candidates[0].success_probability >= 0.9


def test_risks_present_yields_three_candidates_with_mitigation_ranked_highest() -> None:
    candidates = SimulationEngine().simulate(_world_state(), [_risk("congestion", "medium")])

    assert len(candidates) == 3
    best = max(candidates, key=lambda c: c.success_probability)
    assert "alternate" in best.candidate_action.lower() or "avoid" in best.candidate_action.lower()


def test_higher_severity_lowers_the_mitigation_success_probability() -> None:
    medium = SimulationEngine().simulate(_world_state(), [_risk("congestion", "medium")])
    critical = SimulationEngine().simulate(_world_state(), [_risk("congestion", "critical")])

    best_medium = max(medium, key=lambda c: c.success_probability)
    best_critical = max(critical, key=lambda c: c.success_probability)

    assert best_critical.success_probability < best_medium.success_probability


def test_unknown_risk_type_falls_back_to_a_generic_mitigation_action() -> None:
    candidates = SimulationEngine().simulate(_world_state(), [_risk("route-closure", "high")])

    best = max(candidates, key=lambda c: c.success_probability)
    assert best.candidate_action  # falls back, doesn't crash on an unmapped risk type


def test_mitigation_candidate_targets_every_active_risk() -> None:
    risks = [_risk("congestion", "medium"), _risk("travel-delay", "high")]
    candidates = SimulationEngine().simulate(_world_state(), risks)

    best = max(candidates, key=lambda c: c.success_probability)
    assert set(best.affected_risk_ids) == {r.id for r in risks}
