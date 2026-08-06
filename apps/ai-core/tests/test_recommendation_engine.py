from datetime import UTC, datetime

from app.contracts.domain import Decision, RiskState, SimulationResult
from app.reasoning.recommendation_engine import RecommendationEngine


def _decision() -> Decision:
    now = datetime.now(UTC).isoformat()
    return Decision(
        id="decision-test",
        world_state_id="world-state-test",
        chosen_simulation_result_id="sim-test",
        considered_simulation_result_ids=["sim-test"],
        consensus_score=1.0,
        governance_status="approved",
        governance_notes="stub",
        rationale="Highest-severity risk is 'travel-delay' (high): heavy rain plus congestion.",
        decided_at=now,
    )


def _simulation() -> SimulationResult:
    return SimulationResult(
        id="sim-test",
        world_state_id="world-state-test",
        candidate_action="Leave earlier than usual and take an alternate route away from the gate.",
        predicted_outcome="Following this action reduces exposure to the travel-delay risk.",
        affected_risk_ids=["risk-travel-delay"],
        success_probability=1.0,
        generated_at=datetime.now(UTC).isoformat(),
    )


def _risk() -> RiskState:
    now = datetime.now(UTC).isoformat()
    return RiskState(
        id="risk-travel-delay",
        risk_type="travel-delay",
        severity="high",
        status="active",
        description="Heavy rain combined with traffic congestion at South Gate.",
        affected_entity_ids=[],
        world_state_id="world-state-test",
        detected_at=now,
        updated_at=now,
    )


def test_recommendation_carries_action_reasoning_evidence_and_confidence() -> None:
    recommendation = RecommendationEngine().generate(
        _decision(),
        _simulation(),
        [_risk()],
        "heavy rain at South Gate; medium congestion at South Gate",
    )

    assert recommendation.action == _simulation().candidate_action
    assert recommendation.reasoning
    assert len(recommendation.evidence) == 2  # world_state + one risk
    assert 0.0 < recommendation.confidence <= 1.0
    assert recommendation.alternatives
    assert recommendation.decision_id == "decision-test"
    assert recommendation.status == "proposed"


def test_recommendation_with_no_risks_still_has_full_envelope() -> None:
    decision = _decision()
    simulation = SimulationResult(
        id="sim-none",
        world_state_id="world-state-test",
        candidate_action="No action needed — no active risks detected.",
        predicted_outcome="Conditions remain normal.",
        affected_risk_ids=[],
        success_probability=1.0,
        generated_at=datetime.now(UTC).isoformat(),
    )

    recommendation = RecommendationEngine().generate(decision, simulation, [], "no signals")

    assert recommendation.evidence  # still has the world_state evidence entry
    assert recommendation.alternatives
    assert recommendation.title == "No action needed"
