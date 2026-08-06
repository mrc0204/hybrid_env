"""Mirrors packages/contracts/src/domain/*.ts — keep both in sync manually.

The seven canonical domain models the whole system is built around. Events
notify that one of these changed; they never redefine the shape themselves.
"""

from typing import Literal

from app.contracts.base import CamelModel


class GeoLocation(CamelModel):
    lat: float
    lng: float


# --- WorldState --------------------------------------------------------


class WorldEntity(CamelModel):
    id: str
    type: str
    label: str
    location: GeoLocation | str | None = None
    attributes: dict[str, object]
    updated_at: str


class WorldState(CamelModel):
    id: str
    scope: str
    version: int
    generated_at: str
    summary: str
    entities: list[WorldEntity]
    source_event_ids: list[str]


# --- GoalState -----------------------------------------------------------


class GoalState(CamelModel):
    id: str
    scope: str
    owner_type: Literal["user", "system"]
    owner_id: str | None = None
    title: str
    description: str | None = None
    priority: Literal["low", "medium", "high"]
    status: Literal["active", "achieved", "abandoned", "expired"]
    target_time: str | None = None
    created_at: str
    updated_at: str


# --- RiskState -----------------------------------------------------------


class RiskState(CamelModel):
    id: str
    risk_type: str
    severity: Literal["low", "medium", "high", "critical"]
    status: Literal["active", "monitoring", "resolved"]
    description: str
    location: GeoLocation | str | None = None
    affected_entity_ids: list[str]
    world_state_id: str
    detected_at: str
    updated_at: str
    resolved_at: str | None = None


# --- SimulationResult ------------------------------------------------


class SimulationResult(CamelModel):
    id: str
    world_state_id: str
    goal_state_id: str | None = None
    candidate_action: str
    predicted_outcome: str
    affected_risk_ids: list[str]
    success_probability: float
    estimated_cost: str | None = None
    generated_at: str


# --- Decision --------------------------------------------------------


class ExpertVote(CamelModel):
    expert_name: str
    # Short verdict — "Endorse <candidate>" or "Dissent" for minority opinions.
    vote: str
    rationale: str
    confidence: float | None = None
    evidence: list[str] | None = None


class Decision(CamelModel):
    id: str
    world_state_id: str
    goal_state_id: str | None = None
    chosen_simulation_result_id: str
    considered_simulation_result_ids: list[str]
    consensus_score: float
    expert_votes: list[ExpertVote] | None = None
    governance_status: Literal["approved", "rejected", "pending_human_approval"]
    governance_notes: str | None = None
    rationale: str
    decided_at: str


# --- Recommendation --------------------------------------------------


class EvidenceRef(CamelModel):
    type: Literal["world_state", "risk_state", "input_event", "note"]
    ref_id: str | None = None
    description: str


class RecommendationAlternative(CamelModel):
    option: str
    reason: str


class Recommendation(CamelModel):
    id: str
    decision_id: str
    title: str
    action: str
    reasoning: str
    evidence: list[EvidenceRef]
    confidence: float
    alternatives: list[RecommendationAlternative]
    related_risk_ids: list[str]
    world_state_id: str
    target_user_ids: list[str] | None = None
    status: Literal["proposed", "delivered", "accepted", "dismissed", "expired"]
    created_at: str
    valid_until: str | None = None


# --- UserContext -------------------------------------------------------


class ScheduleItem(CamelModel):
    title: str
    start_time: str
    location: str | None = None


class UserContext(CamelModel):
    user_id: str
    role: str | None = None
    location: GeoLocation | None = None
    current_activity: str | None = None
    upcoming_schedule: list[ScheduleItem] | None = None
    preferences: dict[str, object] | None = None
    updated_at: str
