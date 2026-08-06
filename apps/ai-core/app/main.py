"""AI Cognitive Core — FastAPI entrypoint.

Milestone 3 scope: the smallest complete cognitive loop — Environment Input
-> WorldState -> Risk Engine -> Decision -> Recommendation -> API response.
No simulation engine, expert council, consensus engine, learning engine,
persistence, or external APIs yet.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI

from app.config.settings import get_settings
from app.contracts.api import ApiSuccess, HealthStatus
from app.logging.logger import configure_logging, get_logger
from app.routes.reason import router as reason_router
from app.world_model.service import WorldModelService

SERVICE_VERSION = "0.1.0"

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("AI Core started (scope=%s)", get_settings().scope)
    yield
    logger.info("AI Core shutting down")


app = FastAPI(title="AI Cognitive Core", version=SERVICE_VERSION, lifespan=lifespan)

# WorldModelService is stateful and must be a single instance shared across
# requests — created once here, read back per-request via app.dependencies.
app.state.world_model_service = WorldModelService()

app.include_router(reason_router)


@app.get("/health", response_model=ApiSuccess[HealthStatus])
def health() -> ApiSuccess[HealthStatus]:
    return ApiSuccess(
        data=HealthStatus(
            status="ok",
            service="ai-core",
            version=SERVICE_VERSION,
            timestamp=datetime.now(UTC).isoformat(),
        )
    )
