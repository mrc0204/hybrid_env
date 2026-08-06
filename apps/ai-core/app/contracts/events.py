"""Mirrors packages/contracts/src/events/*.ts — keep both in sync manually.

Field names are snake_case in Python but alias to camelCase on the wire via
CamelModel, matching the TypeScript field names exactly. Events notify that a
domain model (see domain.py) changed; they never redefine the domain shape
themselves.
"""

from typing import Annotated, Literal

from pydantic import Field

from app.contracts.base import BaseEvent, CamelModel
from app.contracts.domain import Recommendation, RiskState, UserContext, WorldState

# --- Input events -----------------------------------------------------------
# Raw signals entering the system: weather, traffic, campus announcements,
# user context changes. Consumed by the AI Core's Perception Engine.


class WeatherForecastPoint(CamelModel):
    time: str
    temperature_c: float
    precipitation_probability: float


class WeatherInputPayload(CamelModel):
    location: str
    # Normalized vocabulary the RiskEngine keys off: clear | cloudy | fog |
    # light_rain | moderate_rain | heavy_rain | snow | thunderstorm.
    condition: str
    temperature_c: float
    precipitation_mm: float
    wind_kph: float
    humidity_percent: float | None = None
    forecast: list[WeatherForecastPoint] | None = None


class WeatherInputEvent(BaseEvent):
    type: Literal["input.weather.updated"] = "input.weather.updated"
    payload: WeatherInputPayload


class TrafficInputPayload(CamelModel):
    location: str
    congestion_level: Literal["low", "medium", "high"]
    average_speed_kph: float | None = None
    travel_time_minutes: float | None = None
    delay_seconds: float | None = None
    route_status: Literal["open", "closed"] | None = None


class TrafficInputEvent(BaseEvent):
    type: Literal["input.traffic.updated"] = "input.traffic.updated"
    payload: TrafficInputPayload


class AnnouncementInputPayload(CamelModel):
    title: str
    body: str
    category: str


class AnnouncementInputEvent(BaseEvent):
    type: Literal["input.announcement.created"] = "input.announcement.created"
    payload: AnnouncementInputPayload


class UserContextInputPayload(CamelModel):
    user_context: UserContext


class UserContextInputEvent(BaseEvent):
    type: Literal["input.user.context_changed"] = "input.user.context_changed"
    payload: UserContextInputPayload


# Tagged union: `type` is the discriminator, so a Backend-supplied event
# parses into exactly the right model and a bad `type` produces a clear
# validation error rather than a confusing best-effort match.
InputEvent = Annotated[
    WeatherInputEvent | TrafficInputEvent | AnnouncementInputEvent | UserContextInputEvent,
    Field(discriminator="type"),
]

# --- AI events ----------------------------------------------------------
# Emitted by the Cognitive/Reasoning/Action Engines as domain models change.


class WorldModelUpdatedPayload(CamelModel):
    world_state: WorldState


class WorldModelUpdatedEvent(BaseEvent):
    type: Literal["ai.world_model.updated"] = "ai.world_model.updated"
    payload: WorldModelUpdatedPayload


class RiskDetectedPayload(CamelModel):
    risk_state: RiskState


class RiskDetectedEvent(BaseEvent):
    type: Literal["ai.risk.detected"] = "ai.risk.detected"
    payload: RiskDetectedPayload


class RecommendationGeneratedPayload(CamelModel):
    recommendation: Recommendation


class RecommendationGeneratedEvent(BaseEvent):
    type: Literal["ai.recommendation.generated"] = "ai.recommendation.generated"
    payload: RecommendationGeneratedPayload


AIEvent = WorldModelUpdatedEvent | RiskDetectedEvent | RecommendationGeneratedEvent

# --- Notification events -----------------------------------------------
# Personalized delivery of a Recommendation to a specific user, plus the
# read/dismiss feedback that flows back into the Learning Engine.


class NotificationCreatedPayload(CamelModel):
    notification_id: str
    user_id: str
    title: str
    message: str
    severity: Literal["info", "warning", "critical"]
    related_recommendation_id: str | None = None


class NotificationCreatedEvent(BaseEvent):
    type: Literal["notification.created"] = "notification.created"
    payload: NotificationCreatedPayload


class NotificationReadPayload(CamelModel):
    notification_id: str
    user_id: str


class NotificationReadEvent(BaseEvent):
    type: Literal["notification.read"] = "notification.read"
    payload: NotificationReadPayload


class NotificationDismissedEvent(BaseEvent):
    type: Literal["notification.dismissed"] = "notification.dismissed"
    payload: NotificationReadPayload


NotificationEvent = NotificationCreatedEvent | NotificationReadEvent | NotificationDismissedEvent

SystemEvent = InputEvent | AIEvent | NotificationEvent
