"""Cognitive Engine — Milestone 3 slice. Holds the current WorldState
in-process and hands out a fresh, versioned snapshot on every update. No
persistence and no episodic/semantic memory yet — that's a later milestone;
this is just the minimal "current snapshot" the Reasoning Engine reads.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.config.settings import get_settings
from app.contracts.domain import WorldEntity, WorldState


class WorldModelService:
    def __init__(self) -> None:
        self._current: WorldState | None = None
        self._version = 0

    def get_current(self) -> WorldState | None:
        return self._current

    def update(
        self, entities: list[WorldEntity], summary: str, source_event_ids: list[str]
    ) -> WorldState:
        self._version += 1
        self._current = WorldState(
            id=f"world-state-{uuid4()}",
            scope=get_settings().scope,
            version=self._version,
            generated_at=datetime.now(UTC).isoformat(),
            summary=summary,
            entities=entities,
            source_event_ids=source_event_ids,
        )
        return self._current
