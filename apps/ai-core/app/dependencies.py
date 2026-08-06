"""FastAPI dependency providers — the AI Core's dependency injection layer.

WorldModelService is stateful (holds the current WorldState across requests)
so it must be a true singleton, created once at startup and stored on
`app.state`; the provider here just reads it back per-request. The
reasoning engines are pure/stateless, so `lru_cache` is enough to make each
one a singleton without needing app.state.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Request

from app.ingestion.perception_service import PerceptionService
from app.reasoning.decision_engine import DecisionEngine
from app.reasoning.recommendation_engine import RecommendationEngine
from app.reasoning.risk_engine import RiskEngine
from app.world_model.service import WorldModelService


def get_world_model_service(request: Request) -> WorldModelService:
    return request.app.state.world_model_service


@lru_cache
def get_perception_service() -> PerceptionService:
    return PerceptionService()


@lru_cache
def get_risk_engine() -> RiskEngine:
    return RiskEngine()


@lru_cache
def get_decision_engine() -> DecisionEngine:
    return DecisionEngine()


@lru_cache
def get_recommendation_engine() -> RecommendationEngine:
    return RecommendationEngine()


# Annotated aliases: the FastAPI-recommended way to declare a dependency,
# reusable across routes without repeating `= Depends(...)` in every signature.
WorldModelServiceDep = Annotated[WorldModelService, Depends(get_world_model_service)]
PerceptionServiceDep = Annotated[PerceptionService, Depends(get_perception_service)]
RiskEngineDep = Annotated[RiskEngine, Depends(get_risk_engine)]
DecisionEngineDep = Annotated[DecisionEngine, Depends(get_decision_engine)]
RecommendationEngineDep = Annotated[RecommendationEngine, Depends(get_recommendation_engine)]
