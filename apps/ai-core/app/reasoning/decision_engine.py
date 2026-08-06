"""Reasoning Engine — decision slice. Milestone 3 keeps this deterministic
and single-path: given the assessed risks, synthesize the internal Decision
directly, picking the highest-severity active risk to act on.

Decision's contract requires a chosen SimulationResult, a consensus score,
and a governance status — fields that belong to the Simulation Engine,
Expert Council/Consensus Engine, and Governance, none of which exist yet
(explicit non-goals this milestone). Rather than leave the contract
half-populated, this constructs exactly one deterministic SimulationResult
purely to satisfy that foreign key — not a "Simulation Engine" (no candidate
comparison, no probabilistic evaluation) — and marks consensus/governance
with values that honestly describe what actually happened: trivial
agreement with itself, and an explicit note that governance hasn't been
built yet.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import Decision, RiskState, SimulationResult, WorldState

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}

_ACTION_BY_RISK_TYPE = {
    "travel-delay": "Leave earlier than usual and take an alternate route away from the gate.",
    "congestion": "Use an alternate gate or route to avoid the congested area.",
}
_DEFAULT_ACTION = "Monitor the situation closely; no route change needed yet."


class DecisionEngine:
    def decide(
        self, world_state: WorldState, risks: list[RiskState]
    ) -> tuple[Decision, SimulationResult]:
        now = datetime.now(UTC).isoformat()

        if not risks:
            candidate_action = "No action needed — no active risks detected."
            predicted_outcome = "Conditions remain normal."
            rationale = "No risks were detected in the current WorldState."
            affected_risk_ids: list[str] = []
        else:
            highest = max(risks, key=lambda r: _SEVERITY_RANK[r.severity])
            candidate_action = _ACTION_BY_RISK_TYPE.get(highest.risk_type, _DEFAULT_ACTION)
            predicted_outcome = (
                f"Reduces exposure to the '{highest.risk_type}' risk without materially "
                "changing arrival time."
            )
            rationale = (
                f"Highest-severity active risk is '{highest.risk_type}' ({highest.severity}): "
                f"{highest.description}"
            )
            affected_risk_ids = [r.id for r in risks]

        simulation = SimulationResult(
            id=f"sim-{uuid4()}",
            world_state_id=world_state.id,
            candidate_action=candidate_action,
            predicted_outcome=predicted_outcome,
            affected_risk_ids=affected_risk_ids,
            success_probability=1.0,
            generated_at=now,
        )

        decision = Decision(
            id=f"decision-{uuid4()}",
            world_state_id=world_state.id,
            chosen_simulation_result_id=simulation.id,
            considered_simulation_result_ids=[simulation.id],
            consensus_score=1.0,
            governance_status="approved",
            governance_notes=(
                "Governance/guardrails not yet implemented (Milestone 3 stub) — auto-approved."
            ),
            rationale=rationale,
            decided_at=now,
        )

        return decision, simulation
