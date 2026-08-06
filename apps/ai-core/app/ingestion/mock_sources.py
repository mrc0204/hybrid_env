"""Mock environment input for Milestone 3's vertical slice. Real ingestion —
live weather/traffic APIs, campus systems feeding events through the
Backend — is a later milestone; this exists purely so the cognitive loop has
something to perceive.

Congestion is deliberately set to "medium", not "high": combined with heavy
rain it should escalate to a high travel-delay risk while the congestion
risk itself stays medium — matching the Risk Engine's worked example.
"""

from datetime import UTC, datetime

from app.contracts.events import (
    AnnouncementInputEvent,
    AnnouncementInputPayload,
    InputEvent,
    TrafficInputEvent,
    TrafficInputPayload,
    WeatherInputEvent,
    WeatherInputPayload,
)


def mock_environment_input() -> list[InputEvent]:
    now = datetime.now(UTC).isoformat()

    return [
        WeatherInputEvent(
            id="mock-weather-1",
            timestamp=now,
            source="mock-weather-api",
            payload=WeatherInputPayload(
                location="South Gate",
                condition="heavy_rain",
                temperature_c=24.0,
                precipitation_mm=18.5,
                wind_kph=12.0,
            ),
        ),
        TrafficInputEvent(
            id="mock-traffic-1",
            timestamp=now,
            source="mock-traffic-api",
            payload=TrafficInputPayload(
                location="South Gate",
                congestion_level="medium",
                average_speed_kph=15.0,
            ),
        ),
        AnnouncementInputEvent(
            id="mock-announcement-1",
            timestamp=now,
            source="campus-admin",
            payload=AnnouncementInputPayload(
                title="Guest Lecture at Auditorium",
                body="A guest lecture starts at 3 PM; expect increased foot traffic nearby.",
                category="event",
            ),
        ),
    ]
