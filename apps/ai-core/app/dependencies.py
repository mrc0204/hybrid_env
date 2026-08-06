"""FastAPI dependency providers — the AI Core's dependency injection layer.

WorldModelService and TraceService are stateful (they hold the current
WorldState / last full trace across requests) so each must be a true
singleton, created once at startup and stored on `app.state`; the providers
here just read them back per-request. The reasoning engines and agents are
pure/stateless, so `lru_cache` is enough to make each one a singleton
without needing app.state.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Request

from app.ingestion.perception_service import PerceptionService
from app.reasoning.agents import ExpertAgent, default_agents
from app.reasoning.consensus_engine import ConsensusEngine
from app.reasoning.critic_agent import CriticAgent
from app.reasoning.recommendation_engine import RecommendationEngine
from app.reasoning.risk_engine import RiskEngine
from app.reasoning.simulation_engine import SimulationEngine
from app.reasoning.trace_service import TraceService
from app.world_model.service import WorldModelService


def get_world_model_service(request: Request) -> WorldModelService:
    return request.app.state.world_model_service


def get_trace_service(request: Request) -> TraceService:
    return request.app.state.trace_service


@lru_cache
def get_perception_service() -> PerceptionService:
    return PerceptionService()


@lru_cache
def get_risk_engine() -> RiskEngine:
    return RiskEngine()


@lru_cache
def get_simulation_engine() -> SimulationEngine:
    return SimulationEngine()


@lru_cache
def get_expert_agents() -> tuple[ExpertAgent, ...]:
    # Tuple, not list: lru_cache requires a hashable return value.
    return tuple(default_agents())


@lru_cache
def get_critic_agent() -> CriticAgent:
    return CriticAgent()


@lru_cache
def get_consensus_engine() -> ConsensusEngine:
    return ConsensusEngine()


@lru_cache
def get_recommendation_engine() -> RecommendationEngine:
    return RecommendationEngine()


# Annotated aliases: the FastAPI-recommended way to declare a dependency,
# reusable across routes without repeating `= Depends(...)` in every signature.
WorldModelServiceDep = Annotated[WorldModelService, Depends(get_world_model_service)]
TraceServiceDep = Annotated[TraceService, Depends(get_trace_service)]
PerceptionServiceDep = Annotated[PerceptionService, Depends(get_perception_service)]
RiskEngineDep = Annotated[RiskEngine, Depends(get_risk_engine)]
SimulationEngineDep = Annotated[SimulationEngine, Depends(get_simulation_engine)]
ExpertAgentsDep = Annotated[tuple[ExpertAgent, ...], Depends(get_expert_agents)]
CriticAgentDep = Annotated[CriticAgent, Depends(get_critic_agent)]
ConsensusEngineDep = Annotated[ConsensusEngine, Depends(get_consensus_engine)]
RecommendationEngineDep = Annotated[RecommendationEngine, Depends(get_recommendation_engine)]
