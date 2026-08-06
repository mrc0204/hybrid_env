"""Reasoning Engine — consensus slice.

Algorithm (confidence-weighted plurality vote): every agent's vote for a
candidate is weighted by that agent's own confidence rather than counted
equally, so one highly-confident agent can outweigh two lukewarm ones. The
winner is the candidate with the highest total weighted score;
`consensus_score` is the winner's share of the total weight across all
candidates — how much of the room's conviction backs it, not just how many
agents nominally agree.

Governance, applied in order:
  1. If the winning candidate's own simulated success_probability < 0.3, the
     group cannot credibly endorse anything -> "rejected".
  2. Else if consensus_score >= 0.6 -> "approved".
  3. Else -> "pending_human_approval".

Minority agents (whose vote didn't match the winner) get `vote: "Dissent"`
on their ExpertVote — the Frontend's deliberation view already styles that
exact string as dissent, so no Frontend change was needed to surface it.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import Decision, ExpertVote, SimulationResult, WorldState
from app.reasoning.agents.base import AgentOpinion
from app.reasoning.critic_agent import CriticReport

_APPROVAL_THRESHOLD = 0.6
_REJECTION_THRESHOLD = 0.3


class ConsensusEngine:
    def resolve(
        self,
        world_state: WorldState,
        simulations: list[SimulationResult],
        opinions: list[AgentOpinion],
        critic_report: CriticReport,
    ) -> Decision:
        now = datetime.now(UTC).isoformat()
        by_id = {s.id: s for s in simulations}

        weighted = self._weighted_votes(opinions)
        winner_id = max(weighted, key=lambda candidate_id: weighted[candidate_id])
        total_weight = sum(weighted.values()) or 1.0
        consensus_score = round(weighted[winner_id] / total_weight, 2)
        winner = by_id[winner_id]

        governance_status = self._governance_status(winner, consensus_score)
        expert_votes = self._build_expert_votes(opinions, winner_id, winner)
        minority = [op.agent_name for op in opinions if op.recommended_simulation_id != winner_id]

        return Decision(
            id=f"decision-{uuid4()}",
            world_state_id=world_state.id,
            chosen_simulation_result_id=winner_id,
            considered_simulation_result_ids=[s.id for s in simulations],
            consensus_score=consensus_score,
            expert_votes=expert_votes,
            governance_status=governance_status,
            governance_notes=self._governance_notes(
                critic_report, minority, simulations, consensus_score
            ),
            rationale=(
                f"Consensus-weighted vote selected '{winner.candidate_action}' with a "
                f"{consensus_score:.0%} weighted share among {len(opinions)} agents."
            ),
            decided_at=now,
        )

    @staticmethod
    def _weighted_votes(opinions: list[AgentOpinion]) -> dict[str, float]:
        weighted: dict[str, float] = {}
        for op in opinions:
            weighted[op.recommended_simulation_id] = (
                weighted.get(op.recommended_simulation_id, 0.0) + op.confidence
            )
        return weighted

    @staticmethod
    def _governance_status(winner: SimulationResult, consensus_score: float) -> str:
        if winner.success_probability < _REJECTION_THRESHOLD:
            return "rejected"
        if consensus_score >= _APPROVAL_THRESHOLD:
            return "approved"
        return "pending_human_approval"

    @staticmethod
    def _build_expert_votes(
        opinions: list[AgentOpinion], winner_id: str, winner: SimulationResult
    ) -> list[ExpertVote]:
        votes = []
        for op in opinions:
            agrees = op.recommended_simulation_id == winner_id
            vote_label = f"Endorse {_short_label(winner.candidate_action)}" if agrees else "Dissent"
            rationale_parts = list(op.observations)
            if op.concerns:
                rationale_parts.append("Concerns: " + " ".join(op.concerns))
            votes.append(
                ExpertVote(
                    expert_name=op.agent_name,
                    vote=vote_label,
                    rationale=" ".join(rationale_parts) or "No specific observations.",
                    confidence=op.confidence,
                    evidence=op.evidence,
                )
            )
        return votes

    @staticmethod
    def _governance_notes(
        critic_report: CriticReport,
        minority: list[str],
        simulations: list[SimulationResult],
        consensus_score: float,
    ) -> str:
        notes = [f"Resolved via confidence-weighted vote (consensus {consensus_score:.0%})."]
        if minority:
            notes.append(f"Minority opinion from: {', '.join(minority)}.")
        rejected_count = len(simulations) - 1
        if rejected_count > 0:
            notes.append(f"{rejected_count} alternative candidate(s) not selected.")
        if critic_report.findings:
            notes.append(
                f"Critic raised {len(critic_report.findings)} finding(s), "
                f"including: {critic_report.findings[0].issue}"
            )
        return " ".join(notes)


def _short_label(action: str) -> str:
    return action if len(action) <= 40 else action[:37] + "..."
