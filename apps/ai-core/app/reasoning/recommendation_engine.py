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
)

MOCK_USER_CONTEXT = UserContext(
    user_id="demo-student-1",
    role="student",
    current_activity="preparing to leave for class",
    upcoming_schedule=[
        ScheduleItem(title="3 PM Lecture", start_time="15:00", location="Auditorium")
    ],
    updated_at=datetime.now(UTC).isoformat(),
)


class RecommendationEngine:
    def generate(
        self,
        decision: Decision,
        simulation: SimulationResult,
        risks: list[RiskState],
        world_state_summary: str,
    ) -> Recommendation:
        now = datetime.now(UTC).isoformat()
        user = MOCK_USER_CONTEXT

        evidence = [
            EvidenceRef(
                type="world_state",
                ref_id=decision.world_state_id,
                description=world_state_summary,
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
            confidence = min(0.95, 0.6 + 0.1 * len(risks))
            title = "Adjust your route or timing"
        else:
            alternatives = [
                RecommendationAlternative(
                    option="Take no action",
                    reason="No risks were detected, so no change is necessary.",
                )
            ]
            confidence = 0.6
            title = "No action needed"

        return Recommendation(
            id=f"rec-{uuid4()}",
            decision_id=decision.id,
            title=title,
            action=simulation.candidate_action,
            reasoning=f"{decision.rationale} {simulation.predicted_outcome}",
            evidence=evidence,
            confidence=confidence,
            alternatives=alternatives,
            related_risk_ids=[r.id for r in risks],
            world_state_id=decision.world_state_id,
            target_user_ids=[user.user_id],
            status="proposed",
            created_at=now,
        )
