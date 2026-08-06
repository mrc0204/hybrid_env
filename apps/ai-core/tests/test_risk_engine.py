from datetime import UTC, datetime

from app.contracts.domain import WorldEntity, WorldState
from app.reasoning.risk_engine import RiskEngine


def _world_state(entities: list[WorldEntity]) -> WorldState:
    now = datetime.now(UTC).isoformat()
    return WorldState(
        id="world-state-test",
        scope="test-scope",
        version=1,
        generated_at=now,
        summary="test",
        entities=entities,
        source_event_ids=[],
    )


def _weather_entity(condition: str) -> WorldEntity:
    return WorldEntity(
        id="entity-weather-south-gate",
        type="weather",
        label="South Gate",
        location="South Gate",
        attributes={"condition": condition, "temperatureC": 24.0},
        updated_at=datetime.now(UTC).isoformat(),
    )


def _traffic_entity(level: str) -> WorldEntity:
    return WorldEntity(
        id="entity-traffic-south-gate",
        type="traffic-segment",
        label="South Gate",
        location="South Gate",
        attributes={"congestionLevel": level},
        updated_at=datetime.now(UTC).isoformat(),
    )


def test_no_risks_when_conditions_are_normal() -> None:
    world_state = _world_state([_weather_entity("clear"), _traffic_entity("low")])

    risks = RiskEngine().assess(world_state)

    assert risks == []


def test_medium_congestion_alone_produces_medium_risk() -> None:
    world_state = _world_state([_traffic_entity("medium")])

    risks = RiskEngine().assess(world_state)

    assert len(risks) == 1
    assert risks[0].risk_type == "congestion"
    assert risks[0].severity == "medium"


def test_heavy_rain_plus_congestion_escalates_to_high_travel_delay_risk() -> None:
    world_state = _world_state([_weather_entity("heavy_rain"), _traffic_entity("medium")])

    risks = RiskEngine().assess(world_state)

    risk_types = {r.risk_type: r.severity for r in risks}
    assert risk_types["congestion"] == "medium"
    assert risk_types["travel-delay"] == "high"
