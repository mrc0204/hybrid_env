from datetime import UTC, datetime

from app.contracts.domain import SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion
from app.reasoning.consensus_engine import ConsensusEngine
from app.reasoning.critic_agent import CriticReport

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


def _simulation(sim_id: str, probability: float, action: str = "action") -> SimulationResult:
    return SimulationResult(
        id=sim_id,
        world_state_id="ws-test",
        candidate_action=action,
        predicted_outcome="outcome",
        affected_risk_ids=[],
        success_probability=probability,
        generated_at=_NOW,
    )


def _opinion(agent_name: str, sim_id: str, confidence: float) -> AgentOpinion:
    return AgentOpinion(
        agent_name=agent_name,
        observations=[f"{agent_name} observation"],
        concerns=[],
        priorities=["priority"],
        recommended_simulation_id=sim_id,
        confidence=confidence,
        evidence=["evidence"],
    )


_NO_FINDINGS = CriticReport(findings=[], disagreement_detected=False)


def test_unanimous_agreement_yields_full_consensus_and_approval() -> None:
    simulations = [_simulation("a", 0.9)]
    opinions = [_opinion("Agent1", "a", 0.9), _opinion("Agent2", "a", 0.8)]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    assert decision.chosen_simulation_result_id == "a"
    assert decision.consensus_score == 1.0
    assert decision.governance_status == "approved"
    assert all(v.vote.startswith("Endorse") for v in decision.expert_votes)


def test_confidence_weighted_vote_can_overturn_a_raw_majority() -> None:
    """The core algorithm claim: two highly-confident agents should be able
    to outweigh three lukewarm ones, proving votes are weighted by
    confidence and not simply counted."""
    simulations = [_simulation("a", 0.8), _simulation("b", 0.8)]
    opinions = [
        _opinion("Agent1", "a", 0.9),
        _opinion("Agent2", "a", 0.9),  # weight for "a" = 1.8
        _opinion("Agent3", "b", 0.3),
        _opinion("Agent4", "b", 0.3),
        _opinion("Agent5", "b", 0.3),  # weight for "b" = 0.9, despite 3 votes vs 2
    ]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    assert decision.chosen_simulation_result_id == "a"


def test_minority_agents_are_marked_as_dissenting() -> None:
    simulations = [_simulation("a", 0.9), _simulation("b", 0.8)]
    opinions = [_opinion("Agent1", "a", 0.9), _opinion("Agent2", "b", 0.4)]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    votes_by_agent = {v.expert_name: v for v in decision.expert_votes}
    assert votes_by_agent["Agent1"].vote.startswith("Endorse")
    assert votes_by_agent["Agent2"].vote == "Dissent"


def test_low_consensus_is_escalated_for_human_approval() -> None:
    simulations = [_simulation("a", 0.9), _simulation("b", 0.85)]
    # Close to a 50/50 split -> consensus_score well under the 0.6 threshold.
    opinions = [_opinion("Agent1", "a", 0.55), _opinion("Agent2", "b", 0.50)]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    assert decision.consensus_score < 0.6
    assert decision.governance_status == "pending_human_approval"


def test_a_weakly_supported_winner_is_rejected_outright() -> None:
    simulations = [_simulation("a", 0.15)]
    opinions = [_opinion("Agent1", "a", 0.9)]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    assert decision.governance_status == "rejected"


def test_considered_ids_include_every_candidate_not_just_the_winner() -> None:
    simulations = [_simulation("a", 0.9), _simulation("b", 0.5), _simulation("c", 0.3)]
    opinions = [_opinion("Agent1", "a", 0.9)]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    assert set(decision.considered_simulation_result_ids) == {"a", "b", "c"}


def test_expert_votes_carry_confidence_and_evidence_through() -> None:
    simulations = [_simulation("a", 0.9)]
    opinions = [_opinion("Agent1", "a", 0.77)]

    decision = ConsensusEngine().resolve(_world_state(), simulations, opinions, _NO_FINDINGS)

    vote = decision.expert_votes[0]
    assert vote.confidence == 0.77
    assert vote.evidence == ["evidence"]
