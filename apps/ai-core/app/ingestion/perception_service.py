"""Perception Engine — Milestone 3 slice. Converts raw InputEvents into the
WorldEntity objects and narrative summary a WorldState is built from. Real
perception (entity resolution, deduplication across many sources) is a later
concern; this handles exactly the three mock event types.
"""

from app.contracts.domain import WorldEntity
from app.contracts.events import InputEvent


class PerceptionService:
    def to_world_entities(
        self, events: list[InputEvent]
    ) -> tuple[list[WorldEntity], str, list[str]]:
        entities: list[WorldEntity] = []
        source_event_ids: list[str] = []
        summary_parts: list[str] = []

        for event in events:
            source_event_ids.append(event.id)

            if event.type == "input.weather.updated":
                payload = event.payload
                entities.append(
                    WorldEntity(
                        id=f"entity-weather-{payload.location}",
                        type="weather",
                        label=payload.location,
                        location=payload.location,
                        attributes={
                            "condition": payload.condition,
                            "temperatureC": payload.temperature_c,
                            "precipitationMm": payload.precipitation_mm,
                            "windKph": payload.wind_kph,
                        },
                        updated_at=event.timestamp,
                    )
                )
                summary_parts.append(f"{payload.condition.replace('_', ' ')} at {payload.location}")

            elif event.type == "input.traffic.updated":
                payload = event.payload
                entities.append(
                    WorldEntity(
                        id=f"entity-traffic-{payload.location}",
                        type="traffic-segment",
                        label=payload.location,
                        location=payload.location,
                        attributes={
                            "congestionLevel": payload.congestion_level,
                            "averageSpeedKph": payload.average_speed_kph,
                        },
                        updated_at=event.timestamp,
                    )
                )
                summary_parts.append(f"{payload.congestion_level} congestion at {payload.location}")

            elif event.type == "input.announcement.created":
                payload = event.payload
                entities.append(
                    WorldEntity(
                        id=f"entity-announcement-{payload.title}",
                        type="campus-event",
                        label=payload.title,
                        location=None,
                        attributes={"body": payload.body, "category": payload.category},
                        updated_at=event.timestamp,
                    )
                )
                summary_parts.append(payload.title)

        summary = "; ".join(summary_parts) or "No significant environment signals."
        return entities, summary, source_event_ids
