from datetime import UTC, datetime

from app.contracts.domain import RiskState, WorldState
from app.reasoning.decision_engine import DecisionEngine


def _world_state() -> WorldState:
    return WorldState(
        id="world-state-test",
        scope="test-scope",
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
        world_state_id="world-state-test",
        detected_at=now,
        updated_at=now,
    )


def test_no_risks_yields_no_action_decision() -> None:
    decision, simulation = DecisionEngine().decide(_world_state(), [])

    assert "No risks were detected" in decision.rationale
    assert decision.governance_status == "approved"
    assert decision.chosen_simulation_result_id == simulation.id
    assert decision.considered_simulation_result_ids == [simulation.id]


def test_decides_on_highest_severity_risk() -> None:
    risks = [_risk("congestion", "medium"), _risk("travel-delay", "high")]

    decision, simulation = DecisionEngine().decide(_world_state(), risks)

    assert "travel-delay" in decision.rationale
    assert "high" in decision.rationale
    assert "alternate route" in simulation.candidate_action


def test_decision_references_a_real_world_state() -> None:
    world_state = _world_state()

    decision, simulation = DecisionEngine().decide(world_state, [])

    assert decision.world_state_id == world_state.id
    assert simulation.world_state_id == world_state.id
