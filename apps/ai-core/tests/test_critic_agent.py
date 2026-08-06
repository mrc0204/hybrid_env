from datetime import UTC, datetime

from app.contracts.domain import SimulationResult
from app.reasoning.agents.base import AgentOpinion
from app.reasoning.critic_agent import CriticAgent

_NOW = datetime.now(UTC).isoformat()


def _simulation(sim_id: str, probability: float) -> SimulationResult:
    return SimulationResult(
        id=sim_id,
        world_state_id="ws-test",
        candidate_action="action",
        predicted_outcome="outcome",
        affected_risk_ids=[],
        success_probability=probability,
        generated_at=_NOW,
    )


def _opinion(agent_name: str, sim_id: str, confidence: float, evidence=None) -> AgentOpinion:
    return AgentOpinion(
        agent_name=agent_name,
        observations=["obs"],
        concerns=[],
        priorities=["priority"],
        recommended_simulation_id=sim_id,
        confidence=confidence,
        evidence=evidence if evidence is not None else ["some evidence"],
    )


def test_no_findings_when_agents_agree_confidently_with_evidence() -> None:
    simulations = [_simulation("a", 0.9)]
    opinions = [_opinion("Agent1", "a", 0.9), _opinion("Agent2", "a", 0.85)]

    report = CriticAgent().review(opinions, simulations)

    assert report.disagreement_detected is False
    assert report.findings == []


def test_detects_disagreement_between_agents() -> None:
    simulations = [_simulation("a", 0.9), _simulation("b", 0.8)]
    opinions = [_opinion("Agent1", "a", 0.9), _opinion("Agent2", "b", 0.85)]

    report = CriticAgent().review(opinions, simulations)

    assert report.disagreement_detected is True
    assert any("did not converge" in f.issue for f in report.findings)


def test_flags_low_confidence_as_a_weak_assumption() -> None:
    simulations = [_simulation("a", 0.9)]
    opinions = [_opinion("Agent1", "a", 0.3)]

    report = CriticAgent().review(opinions, simulations)

    assert any(f.target_agent == "Agent1" and "Confidence" in f.issue for f in report.findings)


def test_flags_a_recommendation_with_no_cited_evidence() -> None:
    simulations = [_simulation("a", 0.9)]
    opinions = [_opinion("Agent1", "a", 0.9, evidence=[])]

    report = CriticAgent().review(opinions, simulations)

    assert any(
        f.target_agent == "Agent1" and "No supporting evidence" in f.issue for f in report.findings
    )


def test_flags_a_recommendation_unsupported_by_simulated_probability() -> None:
    simulations = [_simulation("a", 0.2)]
    opinions = [_opinion("Agent1", "a", 0.9)]

    report = CriticAgent().review(opinions, simulations)

    assert any("simulated success probability" in f.issue for f in report.findings)
