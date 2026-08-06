from datetime import UTC, datetime

from app.contracts.domain import RiskState, SimulationResult, WorldState
from app.reasoning.agents import (
    AccessibilityAgent,
    OperationsAgent,
    SafetyAgent,
    StudentExperienceAgent,
    SustainabilityAgent,
    default_agents,
)
from app.reasoning.simulation_engine import SimulationEngine

_NOW = datetime.now(UTC).isoformat()


def _world_state() -> WorldState:
    return WorldState(
        id="ws-test",
        scope="test",
        version=1,
        generated_at=_NOW,
        summary="test",
        entities=[],
        source_event_ids=[],
    )


def _risk(severity: str = "medium") -> RiskState:
    return RiskState(
        id="risk-1",
        risk_type="congestion",
        severity=severity,
        status="active",
        description="Congestion at the gate",
        affected_entity_ids=[],
        world_state_id="ws-test",
        detected_at=_NOW,
        updated_at=_NOW,
    )


def _simulation(
    sim_id: str, action: str, probability: float, affected_risk_ids=None
) -> SimulationResult:
    return SimulationResult(
        id=sim_id,
        world_state_id="ws-test",
        candidate_action=action,
        predicted_outcome="outcome",
        affected_risk_ids=affected_risk_ids or [],
        success_probability=probability,
        generated_at=_NOW,
    )


def test_default_agents_returns_all_five_named_agents() -> None:
    names = {a.name for a in default_agents()}
    assert names == {
        "Safety Agent",
        "Operations Agent",
        "Accessibility Agent",
        "Student Experience Agent",
        "Sustainability Agent",
    }


def test_each_agent_produces_a_complete_opinion() -> None:
    world_state = _world_state()
    risks = [_risk("high")]
    simulations = SimulationEngine().simulate(world_state, risks)
    candidate_ids = {s.id for s in simulations}

    for agent in default_agents():
        opinion = agent.analyze(world_state, risks, simulations)

        assert opinion.agent_name == agent.name
        assert opinion.recommended_simulation_id in candidate_ids
        assert 0.0 <= opinion.confidence <= 1.0
        assert isinstance(opinion.observations, list) and opinion.observations
        assert isinstance(opinion.priorities, list) and opinion.priorities
        assert isinstance(opinion.evidence, list) and opinion.evidence


def test_all_agents_converge_when_a_risk_is_severe() -> None:
    world_state = _world_state()
    risks = [_risk("critical")]
    simulations = SimulationEngine().simulate(world_state, risks)

    choices = {
        agent.analyze(world_state, risks, simulations).recommended_simulation_id
        for agent in default_agents()
    }

    assert len(choices) == 1


def test_safety_and_sustainability_can_genuinely_disagree_on_a_low_stakes_risk() -> None:
    """Not identical logic wrapped in different labels: given a close call
    between a slightly-better reroute and a status-quo option, Safety
    chases the higher probability while Sustainability and Accessibility
    avoid an unnecessary route change for a low-severity risk."""
    world_state = _world_state()
    risks = [_risk("low")]
    simulations = [
        _simulation("reroute", "Use an alternate gate", 0.70, ["risk-1"]),
        _simulation("status-quo", "Proceed as normal without any change", 0.60, []),
    ]

    safety_choice = SafetyAgent().analyze(world_state, risks, simulations).recommended_simulation_id
    sustainability_choice = (
        SustainabilityAgent().analyze(world_state, risks, simulations).recommended_simulation_id
    )
    accessibility_choice = (
        AccessibilityAgent().analyze(world_state, risks, simulations).recommended_simulation_id
    )

    assert safety_choice == "reroute"
    assert sustainability_choice == "status-quo"
    assert accessibility_choice == "status-quo"


def test_accessibility_defers_to_probability_when_risk_is_critical() -> None:
    world_state = _world_state()
    risks = [_risk("critical")]
    simulations = [
        _simulation("reroute", "Use an alternate gate", 0.70, ["risk-1"]),
        _simulation("status-quo", "Proceed as normal without any change", 0.60, []),
    ]

    choice = AccessibilityAgent().analyze(world_state, risks, simulations).recommended_simulation_id

    assert choice == "reroute"


def test_operations_penalizes_waiting_over_an_equally_probable_reroute() -> None:
    world_state = _world_state()
    risks = [_risk("medium")]
    simulations = [
        _simulation("wait", "Wait and monitor before deciding", 0.70, []),
        _simulation("reroute", "Use an alternate gate", 0.70, ["risk-1"]),
    ]

    choice = OperationsAgent().analyze(world_state, risks, simulations).recommended_simulation_id

    assert choice == "reroute"


def test_student_experience_flags_a_schedule_concern_for_disruptive_choices() -> None:
    world_state = _world_state()
    risks = [_risk("high")]
    simulations = [_simulation("reroute", "Leave earlier via an alternate gate", 0.8, ["risk-1"])]

    opinion = StudentExperienceAgent().analyze(world_state, risks, simulations)

    assert opinion.concerns  # a route/timing change is flagged as a schedule concern
