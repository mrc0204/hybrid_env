"""POST /reason — the Milestone 3 vertical slice: mock environment input ->
WorldState -> RiskState[] -> Decision -> Recommendation.
"""

from fastapi import APIRouter

from app.contracts.api import ApiSuccess
from app.contracts.domain import Recommendation
from app.dependencies import (
    DecisionEngineDep,
    PerceptionServiceDep,
    RecommendationEngineDep,
    RiskEngineDep,
    WorldModelServiceDep,
)
from app.ingestion.mock_sources import mock_environment_input

router = APIRouter()


@router.post("/reason", response_model=ApiSuccess[Recommendation])
def reason(
    perception_service: PerceptionServiceDep,
    world_model_service: WorldModelServiceDep,
    risk_engine: RiskEngineDep,
    decision_engine: DecisionEngineDep,
    recommendation_engine: RecommendationEngineDep,
) -> ApiSuccess[Recommendation]:
    raw_events = mock_environment_input()
    entities, summary, source_event_ids = perception_service.to_world_entities(raw_events)
    world_state = world_model_service.update(entities, summary, source_event_ids)

    risks = risk_engine.assess(world_state)
    decision, simulation = decision_engine.decide(world_state, risks)
    recommendation = recommendation_engine.generate(
        decision, simulation, risks, world_state.summary
    )

    return ApiSuccess(data=recommendation)
