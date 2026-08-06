# Communication Contracts

This package (`@ai-env/contracts`) is the **source of truth** for how Frontend,
Backend, and AI Core talk to each other. It is TypeScript, consumed directly
(no build step — `main`/`types` point at `src/index.ts`) by the Frontend and
Backend workspaces.

The AI Core is a separate Python service and cannot import TypeScript, so its
contracts are hand-mirrored as Pydantic models in
[`apps/ai-core/app/contracts/`](../../apps/ai-core/app/contracts/). Both sides
must be updated together whenever a contract changes here.

## Wire format

All JSON on the wire — REST bodies, WebSocket/Socket.IO payloads, event bus
messages — uses **camelCase**, matching the TypeScript field names exactly.
The Pydantic models use idiomatic snake_case internally but serialize/parse
with a camelCase alias generator (`CamelModel` in
`apps/ai-core/app/contracts/base.py`), so no translation layer is needed
between services.

## API envelope

Every HTTP JSON response (Backend and AI Core) is wrapped in `ApiResponse<T>`:

```ts
{ success: true, data: T } | { success: false, error: { code, message, details? } }
```

## Health contract

`GET /health` on both Backend and AI Core returns a `HealthStatus`:

```ts
{ status: "ok" | "degraded" | "down", service: "backend" | "ai-core", version: string, timestamp: string }
```

## Domain model

The system is built around seven canonical domain models, defined once in
[`src/domain/`](src/domain/) and used everywhere else — APIs, events,
database schemas, and AI modules all reference these, they never redefine
them. **Domain models are state (nouns); events are notifications that state
changed (verbs).** An event payload embeds or references a domain model; it
never duplicates its shape.

| Model              | Produced by        | Purpose                                                                                                                                                                            |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WorldState`       | Perception Engine  | Live snapshot of the environment: tracked `WorldEntity` objects, a narrative summary, traceable to the `InputEvent`s that produced it.                                             |
| `GoalState`        | Cognitive Engine   | An active objective (a user's or the system's) reasoning is optimized against.                                                                                                     |
| `RiskState`        | Reasoning Engine   | A detected hazard derived from a `WorldState`, with its own active/monitoring/resolved lifecycle.                                                                                  |
| `SimulationResult` | Reasoning Engine   | The predicted outcome of one candidate action, evaluated against a `WorldState`/`GoalState`.                                                                                       |
| `Decision`         | Reasoning Engine   | The consensus-backed, governance-validated internal choice among debated `SimulationResult`s — not yet personalized.                                                               |
| `Recommendation`   | Action Engine      | The personalized, explainable, user-facing artifact derived from a `Decision`. Always carries `reasoning`, `evidence`, `confidence`, and `alternatives` — never a bare conclusion. |
| `UserContext`      | Interaction Engine | A user's current situational context — the Personalization Engine's input for turning a `Decision` into a targeted `Recommendation`.                                               |

Relationships: `RiskState.worldStateId` → `WorldState`;
`SimulationResult.worldStateId`/`goalStateId` → `WorldState`/`GoalState`;
`Decision.chosenSimulationResultId` → `SimulationResult`;
`Recommendation.decisionId` → `Decision` (with `worldStateId` and
`relatedRiskIds` denormalized onto `Recommendation` so presentation-layer
consumers don't need to join back through `Decision`).

## Event model

Every event on the event bus shares a `BaseEvent`: `id`, `type`, `timestamp`,
`source`, optional `correlationId`. Three families, discriminated by `type`:

- **Input events** (`input.*`) — raw signals entering the system: weather,
  traffic, campus announcements, user context changes (embedding
  `UserContext`). Produced by the Backend's external API integrations,
  consumed by the AI Core's Perception Engine.
- **AI events** (`ai.*`) — a domain model changed: `ai.world_model.updated`
  embeds `WorldState`, `ai.risk.detected` embeds `RiskState`,
  `ai.recommendation.generated` embeds `Recommendation`. Produced by the AI
  Core, consumed by the Backend.
- **Notification events** (`notification.*`) — personalized delivery of a
  `Recommendation` to a specific user (`relatedRecommendationId`), plus
  read/dismiss feedback used by the Learning Engine. Produced by the
  Backend's Notification Service, consumed by the Frontend.

`SystemEvent` is the union of all three families. See
[`src/events/`](src/events/) for exact shapes.

## Changing a contract

1. Edit the TypeScript source in `src/`.
2. Mirror the change in `apps/ai-core/app/contracts/`.
3. Update this doc if the shape or meaning changed.
