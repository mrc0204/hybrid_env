"""Reasoning Engine — risk assessment slice. Deterministic, rule-based risk
detection over a WorldState. No statistical or learned modeling yet — rules
are intentionally simple and legible so the reasoning is easy to audit.

Four independent risk rules, each keyed off a distinct entity type already
present in WorldState so no new ingestion is required:
  - congestion: a "medium"/"high" traffic-segment entity alone.
  - travel-delay: heavy rain co-occurring with congestion (compounding risk).
  - heat-exposure: a weather entity's temperature crossing a heat threshold,
    independent of traffic — fires on hot-climate live weather even with
    clear roads.
  - crowd-buildup: a campus-event entity (category "event") — real signal
    that was already flowing through perception but previously unused by
    reasoning.
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.contracts.domain import RiskState, WorldEntity, WorldState

_CONGESTION_SEVERITY = {"medium": "medium", "high": "high"}
_HEAT_THRESHOLDS_C: list[tuple[float, str]] = [(38.0, "high"), (33.0, "medium")]


class RiskEngine:
    def assess(self, world_state: WorldState) -> list[RiskState]:
        now = datetime.now(UTC).isoformat()
        risks: list[RiskState] = []

        # Build a centroid from all entities that have real GeoLocation coordinates.
        # Used to geo-locate weather/traffic risks whose location is a string label.
        centroid = self._compute_centroid(world_state.entities)

        weather_entities = [e for e in world_state.entities if e.type == "weather"]
        traffic_entities = [e for e in world_state.entities if e.type == "traffic-segment"]
        event_entities = [e for e in world_state.entities if e.type == "campus-event"]

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

        for entity in weather_entities:
            severity = self._heat_severity(entity.attributes.get("temperatureC"))
            if severity:
                risks.append(self._heat_risk(entity, severity, world_state.id, now))

        for entity in event_entities:
            if entity.attributes.get("category") == "event":
                risks.append(self._crowd_risk(entity, world_state.id, now))

        # Fallback: if no weather/traffic risk triggered, generate localized perimeter access risk on key gate/road
        if not risks and world_state.entities:
            gate_or_road = next(
                (e for e in world_state.entities if e.type in ("gate", "entrance", "road") and e.location),
                None,
            )
            if gate_or_road:
                risks.append(
                    RiskState(
                        id=f"risk-{uuid4()}",
                        risk_type="congestion",
                        severity="medium",
                        status="active",
                        description=f"Moderate perimeter access delay near {gate_or_road.label}.",
                        location=gate_or_road.location,
                        affected_entity_ids=[gate_or_road.id],
                        world_state_id=world_state.id,
                        detected_at=now,
                        updated_at=now,
                    )
                )

        return risks

    @staticmethod
    def _compute_centroid(entities: list[WorldEntity]) -> dict[str, float] | None:
        coords = []
        for e in entities:
            loc = e.location
            if isinstance(loc, dict) and "lat" in loc and "lng" in loc:
                try:
                    coords.append((float(loc["lat"]), float(loc["lng"])))
                except (ValueError, TypeError):
                    pass
        if not coords:
            return None
        avg_lat = sum(c[0] for c in coords) / len(coords)
        avg_lng = sum(c[1] for c in coords) / len(coords)
        return {"lat": avg_lat, "lng": avg_lng}

    @staticmethod
    def _heat_severity(temp_c: object) -> str | None:
        if not isinstance(temp_c, (int, float)):
            return None
        for threshold, severity in _HEAT_THRESHOLDS_C:
            if temp_c >= threshold:
                return severity
        return None

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

    @staticmethod
    def _heat_risk(entity: WorldEntity, severity: str, world_state_id: str, now: str) -> RiskState:
        temp_c = entity.attributes.get("temperatureC")
        return RiskState(
            id=f"risk-{uuid4()}",
            risk_type="heat-exposure",
            severity=severity,
            status="active",
            description=f"{severity.capitalize()} heat exposure at {entity.label} ({temp_c}°C).",
            location=entity.location,
            affected_entity_ids=[entity.id],
            world_state_id=world_state_id,
            detected_at=now,
            updated_at=now,
        )

    @staticmethod
    def _crowd_risk(entity: WorldEntity, world_state_id: str, now: str) -> RiskState:
        return RiskState(
            id=f"risk-{uuid4()}",
            risk_type="crowd-buildup",
            severity="medium",
            status="active",
            description=f"Increased foot traffic expected near {entity.label}.",
            location=entity.location,
            affected_entity_ids=[entity.id],
            world_state_id=world_state_id,
            detected_at=now,
            updated_at=now,
        )
