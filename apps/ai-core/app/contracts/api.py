"""Mirrors packages/contracts/src/api/*.ts — keep both in sync manually."""

from typing import Generic, Literal, TypeVar

from app.contracts.base import CamelModel
from app.contracts.events import InputEvent

ServiceName = Literal["backend", "ai-core"]
DependencyStatus = Literal["ok", "degraded", "down"]


class HealthStatus(CamelModel):
    status: Literal["ok", "degraded", "down"]
    service: ServiceName
    version: str
    timestamp: str
    dependencies: dict[str, DependencyStatus] | None = None


T = TypeVar("T")


class ApiSuccess(CamelModel, Generic[T]):
    success: Literal[True] = True
    data: T


class ApiErrorBody(CamelModel):
    code: str
    message: str
    details: object | None = None


class ApiError(CamelModel):
    success: Literal[False] = False
    error: ApiErrorBody


class ReasonRequest(CamelModel):
    """Mirrors packages/contracts/src/api/reason.ts.

    The Backend collects and normalizes external signals into InputEvents and
    posts them here; the AI Core never fetches from the outside world itself.
    """

    events: list[InputEvent]
