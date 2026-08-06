from datetime import UTC, datetime

from app.contracts.domain import (
    Decision,
    RiskState,
    SimulationResult,
    WorldEntity,
    WorldState,
)
from app.reasoning.recommendation_engine import RecommendationEngine


def _entity(entity_type: str) -> WorldEntity:
    return WorldEntity(
        id=f"entity-{entity_type}",
        type=entity_type,
        label="South Gate",
        attributes={},
        updated_at=datetime.now(UTC).isoformat(),
    )


def _world_state(
    summary: str = "heavy rain at South Gate; medium congestion at South Gate",
    entity_types: tuple[str, ...] = ("weather", "traffic-segment", "building"),
) -> WorldState:
    return WorldState(
        id="world-state-test",
        scope="test",
        version=1,
        generated_at=datetime.now(UTC).isoformat(),
        summary=summary,
        entities=[_entity(t) for t in entity_types],
        source_event_ids=[],
    )


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
        _world_state(),
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

    recommendation = RecommendationEngine().generate(
        decision, simulation, [], _world_state(summary="no signals")
    )

    assert recommendation.evidence  # still has the world_state evidence entry
    assert recommendation.alternatives
    assert recommendation.title == "No action needed"


def _sim_with(success_probability: float) -> SimulationResult:
    return SimulationResult(
        id="sim-test",
        world_state_id="world-state-test",
        candidate_action="Take an alternate route.",
        predicted_outcome="Reduces exposure.",
        affected_risk_ids=[],
        success_probability=success_probability,
        generated_at=datetime.now(UTC).isoformat(),
    )


def _decision_with(consensus_score: float) -> Decision:
    decision = _decision()
    return decision.model_copy(update={"consensus_score": consensus_score})


def test_confidence_tracks_the_chosen_actions_success_probability() -> None:
    """The regression this guards: confidence used to be `0.6 + 0.1 * len(risks)`,
    so every environment with the same risk count reported an identical number
    regardless of whether the chosen action was any good."""
    engine = RecommendationEngine()
    risks = [_risk()]

    strong = engine.generate(_decision(), _sim_with(0.9), risks, _world_state())
    weak = engine.generate(_decision(), _sim_with(0.3), risks, _world_state())

    assert strong.confidence > weak.confidence


def test_a_split_council_is_less_confident_than_a_unanimous_one() -> None:
    engine = RecommendationEngine()
    risks = [_risk()]
    simulation = _sim_with(0.8)

    unanimous = engine.generate(_decision_with(1.0), simulation, risks, _world_state())
    split = engine.generate(_decision_with(0.4), simulation, risks, _world_state())

    assert unanimous.confidence > split.confidence


def test_a_degraded_world_model_lowers_confidence() -> None:
    """Overpass down (no infrastructure entities) should read as less certain
    than a full picture — the system telling the truth about its own inputs."""
    engine = RecommendationEngine()
    risks = [_risk()]
    simulation = _sim_with(0.8)

    full = engine.generate(_decision(), simulation, risks, _world_state())
    degraded = engine.generate(
        _decision(),
        simulation,
        risks,
        _world_state(entity_types=("weather", "traffic-segment")),
    )

    assert full.confidence > degraded.confidence
