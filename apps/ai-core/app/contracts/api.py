"""Mirrors packages/contracts/src/api/common.ts — keep both in sync manually."""

from typing import Generic, Literal, TypeVar

from app.contracts.base import CamelModel

ServiceName = Literal["backend", "ai-core"]


class HealthStatus(CamelModel):
    status: Literal["ok", "degraded", "down"]
    service: ServiceName
    version: str
    timestamp: str


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
