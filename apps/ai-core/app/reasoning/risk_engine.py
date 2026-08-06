"""Reasoning Engine — risk assessment slice. Deterministic, rule-based risk
detection over a WorldState. No statistical or learned modeling yet — rules
are intentionally simple and legible so the reasoning is easy to audit.

Worked example this implements: a "medium" traffic congestion entity alone
produces a medium-severity congestion risk; if heavy rain is also present at
the same time, that combination additionally produces a high-severity
travel-delay risk.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import RiskState, WorldEntity, WorldState

_CONGESTION_SEVERITY = {"medium": "medium", "high": "high"}


class RiskEngine:
    def assess(self, world_state: WorldState) -> list[RiskState]:
        now = datetime.now(UTC).isoformat()
        risks: list[RiskState] = []

        weather_entities = [e for e in world_state.entities if e.type == "weather"]
        traffic_entities = [e for e in world_state.entities if e.type == "traffic-segment"]

        heavy_rain = [e for e in weather_entities if e.attributes.get("condition") == "heavy_rain"]
        congested = [
            e
            for e in traffic_entities
            if e.attributes.get("congestionLevel") in _CONGESTION_SEVERITY
        ]

        for entity in congested:
            level = entity.attributes.get("congestionLevel")
            risks.append(self._congestion_risk(entity, level, world_state.id, now))

        if heavy_rain and congested:
            risks.append(self._travel_delay_risk(heavy_rain, congested, world_state.id, now))

        return risks

    @staticmethod
    def _congestion_risk(
        entity: WorldEntity, level: str, world_state_id: str, now: str
    ) -> RiskState:
        return RiskState(
            id=f"risk-{uuid4()}",
            risk_type="congestion",
            severity=_CONGESTION_SEVERITY[level],
            status="active",
            description=f"{level.capitalize()} traffic congestion at {entity.label}.",
            location=entity.location,
            affected_entity_ids=[entity.id],
            world_state_id=world_state_id,
            detected_at=now,
            updated_at=now,
        )

    @staticmethod
    def _travel_delay_risk(
        heavy_rain: list[WorldEntity],
        congested: list[WorldEntity],
        world_state_id: str,
        now: str,
    ) -> RiskState:
        affected = heavy_rain + congested
        return RiskState(
            id=f"risk-{uuid4()}",
            risk_type="travel-delay",
            severity="high",
            status="active",
            description=(
                "Heavy rain combined with traffic congestion significantly "
                f"increases travel delay risk near {congested[0].label}."
            ),
            location=congested[0].location,
            affected_entity_ids=[e.id for e in affected],
            world_state_id=world_state_id,
            detected_at=now,
            updated_at=now,
        )
