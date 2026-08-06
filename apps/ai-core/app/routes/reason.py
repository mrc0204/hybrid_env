"""POST /reason — the cognitive loop: Backend-supplied environment events ->
WorldState -> RiskState[] -> SimulationResult[] -> Expert Agents -> Critic ->
Consensus -> Decision -> Recommendation.

The Backend owns all external API integration and posts normalized
InputEvents here; the AI Core owns all reasoning and never fetches from the
outside world itself.

The response contract is unchanged from Milestone 3 — still just the
Recommendation — so the existing Backend pipeline needs no changes. The full
trace (including every agent's opinion) is additionally stored via
TraceService and readable at GET /trace/latest.
"""

from fastapi import APIRouter

from app.contracts.api import ApiSuccess, ReasonRequest, ReasonTrace
from app.contracts.domain import Recommendation
from app.dependencies import (
    ConsensusEngineDep,
    CriticAgentDep,
    ExpertAgentsDep,
    PerceptionServiceDep,
    RecommendationEngineDep,
    RiskEngineDep,
    SimulationEngineDep,
    TraceServiceDep,
    WorldModelServiceDep,
)

router = APIRouter()


@router.post("/reason", response_model=ApiSuccess[Recommendation])
def reason(
    request: ReasonRequest,
    perception_service: PerceptionServiceDep,
    world_model_service: WorldModelServiceDep,
    risk_engine: RiskEngineDep,
    simulation_engine: SimulationEngineDep,
    expert_agents: ExpertAgentsDep,
    critic_agent: CriticAgentDep,
    consensus_engine: ConsensusEngineDep,
    recommendation_engine: RecommendationEngineDep,
    trace_service: TraceServiceDep,
) -> ApiSuccess[Recommendation]:
    entities, summary, source_event_ids = perception_service.to_world_entities(request.events)
    world_state = world_model_service.update(entities, summary, source_event_ids)

    risks = risk_engine.assess(world_state)
    simulations = simulation_engine.simulate(world_state, risks)

    opinions = [agent.analyze(world_state, risks, simulations) for agent in expert_agents]
    critic_report = critic_agent.review(opinions, simulations)
    decision = consensus_engine.resolve(world_state, simulations, opinions, critic_report)

    chosen_simulation = next(s for s in simulations if s.id == decision.chosen_simulation_result_id)
    recommendation = recommendation_engine.generate(
        decision, chosen_simulation, risks, world_state.summary
    )

    trace_service.set(
        ReasonTrace(
            input_events=request.events,
            world_state=world_state,
            risks=risks,
            simulations=simulations,
            decision=decision,
            recommendation=recommendation,
        )
    )

    return ApiSuccess(data=recommendation)
