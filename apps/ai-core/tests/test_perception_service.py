from datetime import UTC, datetime

from app.contracts.domain import WorldEntity
from app.contracts.events import (
    OrganizationContextInputEvent,
    OrganizationContextInputPayload,
    WeatherInputEvent,
    WeatherInputPayload,
)
from app.ingestion.perception_service import PerceptionService


def _now() -> str:
    return datetime.now(UTC).isoformat()


def test_weather_event_still_produces_one_entity() -> None:
    event = WeatherInputEvent(
        id="w1",
        timestamp=_now(),
        source="test",
        payload=WeatherInputPayload(
            location="South Gate",
            condition="clear",
            temperature_c=25.0,
            precipitation_mm=0,
            wind_kph=5,
        ),
    )

    entities, summary, source_ids = PerceptionService().to_world_entities([event])

    assert len(entities) == 1
    assert entities[0].type == "weather"
    assert source_ids == ["w1"]
    assert "clear" in summary


def test_organization_event_extends_entities_directly_without_remapping() -> None:
    org_entities = [
        WorldEntity(
            id="osm-way-1",
            type="building",
            label="Main Academic Block",
            location={"lat": 17.385, "lng": 78.4867},
            attributes={"building": "university"},
            updated_at=_now(),
        ),
        WorldEntity(
            id="osm-node-2",
            type="gate",
            label="North Gate",
            location={"lat": 17.3891, "lng": 78.4849},
            attributes={"barrier": "gate"},
            updated_at=_now(),
        ),
    ]
    event = OrganizationContextInputEvent(
        id="org1",
        timestamp=_now(),
        source="organization-understanding-engine:live",
        payload=OrganizationContextInputPayload(
            organization_name="NIAT KKH",
            resolved_name="NIAT KKH Campus, Hyderabad",
            center={"lat": 17.385, "lng": 78.4867},
            source="live",
            entities=org_entities,
        ),
    )

    entities, summary, source_ids = PerceptionService().to_world_entities([event])

    # Extended directly — same ids, same types, no field remapping occurred.
    assert [e.id for e in entities] == ["osm-way-1", "osm-node-2"]
    assert entities[0].type == "building"
    assert source_ids == ["org1"]
    assert "2 organization entities loaded" in summary
    assert "NIAT KKH Campus" in summary


def test_mixed_events_combine_into_one_world_state_entity_list() -> None:
    weather = WeatherInputEvent(
        id="w1",
        timestamp=_now(),
        source="test",
        payload=WeatherInputPayload(
            location="South Gate",
            condition="heavy_rain",
            temperature_c=24.0,
            precipitation_mm=18.0,
            wind_kph=12.0,
        ),
    )
    org = OrganizationContextInputEvent(
        id="org1",
        timestamp=_now(),
        source="organization-understanding-engine:cache",
        payload=OrganizationContextInputPayload(
            organization_name="NIAT KKH",
            resolved_name="NIAT KKH Campus",
            center={"lat": 17.385, "lng": 78.4867},
            source="cache",
            entities=[
                WorldEntity(
                    id="osm-way-1",
                    type="building",
                    label="Library",
                    location={"lat": 17.3844, "lng": 78.4859},
                    attributes={},
                    updated_at=_now(),
                )
            ],
        ),
    )

    entities, _summary, source_ids = PerceptionService().to_world_entities([weather, org])

    assert {e.type for e in entities} == {"weather", "building"}
    assert source_ids == ["w1", "org1"]
