"""POST /reason — the cognitive loop: Backend-supplied environment events ->
WorldState -> RiskState[] -> Decision -> Recommendation.

The Backend owns all external API integration and posts normalized
InputEvents here; the AI Core owns all reasoning and never fetches from the
outside world itself.
"""

from fastapi import APIRouter

from app.contracts.api import ApiSuccess, ReasonRequest
from app.contracts.domain import Recommendation
from app.dependencies import (
    DecisionEngineDep,
    PerceptionServiceDep,
    RecommendationEngineDep,
    RiskEngineDep,
    WorldModelServiceDep,
)

router = APIRouter()


@router.post("/reason", response_model=ApiSuccess[Recommendation])
def reason(
    request: ReasonRequest,
    perception_service: PerceptionServiceDep,
    world_model_service: WorldModelServiceDep,
    risk_engine: RiskEngineDep,
    decision_engine: DecisionEngineDep,
    recommendation_engine: RecommendationEngineDep,
) -> ApiSuccess[Recommendation]:
    entities, summary, source_event_ids = perception_service.to_world_entities(request.events)
    world_state = world_model_service.update(entities, summary, source_event_ids)

    risks = risk_engine.assess(world_state)
    decision, simulation = decision_engine.decide(world_state, risks)
    recommendation = recommendation_engine.generate(
        decision, simulation, risks, world_state.summary
    )

    return ApiSuccess(data=recommendation)
