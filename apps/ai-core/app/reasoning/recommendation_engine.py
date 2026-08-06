"""Action Engine — recommendation slice. Turns an internal Decision into the
personalized, explainable Recommendation the API returns. Every
recommendation carries an action, reasoning, evidence, and a confidence
score — never a bare conclusion, per the project's core rule.

Milestone 3 personalizes against a single hardcoded UserContext, since
POST /reason takes only mock environment input, not a user. Accepting a
real UserContext as request input is a later milestone; this proves
personalization is wired end-to-end in the meantime.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import (
    Decision,
    EvidenceRef,
    Recommendation,
    RecommendationAlternative,
    RiskState,
    ScheduleItem,
    SimulationResult,
    UserContext,
    WorldState,
)

# The three signal families a complete picture of an environment draws on.
# Anything that isn't a live environment reading came from the infrastructure
# graph, so it counts as the third family.
_ENVIRONMENT_ENTITY_TYPES = frozenset({"weather", "traffic-segment", "campus-event"})

# The chosen action's predicted success rate is the base claim. Expert
# agreement and data completeness then *discount* it — they can erode
# confidence but never manufacture it, which is why they scale the base
# rather than adding to it.
#
# Composed additively these two would instead contribute a flat floor
# (both sit at 1.0 whenever the council is unanimous and every source
# reported), pinning every ordinary result above ~0.78 and putting the
# governance threshold permanently out of reach.
_BASE_WEIGHT = 0.55
_WEIGHT_CONSENSUS = 0.30
_WEIGHT_COMPLETENESS = 0.15

# Never claim certainty and never claim nothing: both are dishonest given a
# rule-based model that cannot know what it hasn't been told to look for.
_MIN_CONFIDENCE = 0.05
_MAX_CONFIDENCE = 0.95

MOCK_USER_CONTEXT = UserContext(
    user_id="demo-student-1",
    role="student",
    current_activity="preparing to leave for class",
    upcoming_schedule=[
        ScheduleItem(title="3 PM Lecture", start_time="15:00", location="Auditorium")
    ],
    updated_at=datetime.now(UTC).isoformat(),
)


def data_completeness(world_state: WorldState) -> float:
    """Fraction of the three signal families actually present in the world model.

    A recommendation drawn from a partial picture is a weaker claim than one
    drawn from the full picture, and shouldn't present as equally certain.
    This is what makes a degraded run — Overpass down, a weather fetch that
    failed — visibly less confident instead of silently just as confident.
    """
    types = {entity.type for entity in world_state.entities}
    families = (
        "weather" in types,
        "traffic-segment" in types,
        bool(types - _ENVIRONMENT_ENTITY_TYPES),  # any infrastructure entity
    )
    return sum(families) / len(families)


class RecommendationEngine:
    @staticmethod
    def _confidence(decision: Decision, simulation: SimulationResult, completeness: float) -> float:
        """Confidence in the recommendation, from signals the pipeline already produced.

        Deliberately *not* a function of how many risks were counted. Risk
        count says nothing about whether the chosen response is the right one,
        and keying off it made every quiet environment report the same number
        — which reads as a hardcoded constant, not a judgment.
        """
        quality = (
            _BASE_WEIGHT
            + _WEIGHT_CONSENSUS * decision.consensus_score
            + _WEIGHT_COMPLETENESS * completeness
        )
        blended = simulation.success_probability * quality
        return round(min(_MAX_CONFIDENCE, max(_MIN_CONFIDENCE, blended)), 2)

    def generate(
        self,
        decision: Decision,
        simulation: SimulationResult,
        risks: list[RiskState],
        world_state: WorldState,
    ) -> Recommendation:
        now = datetime.now(UTC).isoformat()
        user = MOCK_USER_CONTEXT
        completeness = data_completeness(world_state)

        evidence = [
            EvidenceRef(
                type="world_state",
                ref_id=decision.world_state_id,
                description=world_state.summary,
            )
        ] + [
            EvidenceRef(type="risk_state", ref_id=risk.id, description=risk.description)
            for risk in risks
        ]

        if risks:
            alternatives = [
                RecommendationAlternative(
                    option="Proceed via the usual route",
                    reason="Higher exposure to the detected risk(s) given current severity.",
                )
            ]
            title = "Adjust your route or timing"
        else:
            alternatives = [
                RecommendationAlternative(
                    option="Take no action",
                    reason="No risks were detected, so no change is necessary.",
                )
            ]
            title = "No action needed"

        return Recommendation(
            id=f"rec-{uuid4()}",
            decision_id=decision.id,
            title=title,
            action=simulation.candidate_action,
            reasoning=f"{decision.rationale} {simulation.predicted_outcome}",
            evidence=evidence,
            confidence=self._confidence(decision, simulation, completeness),
            alternatives=alternatives,
            related_risk_ids=[r.id for r in risks],
            world_state_id=decision.world_state_id,
            target_user_ids=[user.user_id],
            status="proposed",
            created_at=now,
        )
