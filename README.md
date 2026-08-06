# Agentic Environment Intelligence System

An AI system that continuously observes an environment (demo: NIAT KKH
Campus), builds a live world model, reasons about it, and produces
personalized, explainable recommendations — not another dashboard or chatbot.

## Architecture

Three independent layers, communicating only through the contracts in
[`packages/contracts`](packages/contracts) (mirrored for Python in
[`apps/ai-core/app/contracts`](apps/ai-core/app/contracts)):

| Layer    | Path            | Stack                                            | Responsibility                                                                                    |
| -------- | --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Frontend | `apps/frontend` | React, TS, Vite, Tailwind, Zustand, React Query  | Presentation only. Built in Milestone 4.                                                          |
| Backend  | `apps/backend`  | Node, Express, TS, Prisma, PostgreSQL, Socket.IO | Auth, API, orchestration, external integrations, notifications. Never does AI reasoning.          |
| AI Core  | `apps/ai-core`  | Python, FastAPI, Pydantic                        | All intelligence: perception, memory, reasoning, multi-agent debate, governance, action planning. |

See [`packages/contracts/CONTRACTS.md`](packages/contracts/CONTRACTS.md) for
the event model and API envelope shared across all three.

## Status

**Milestone 4 — Backend ↔ AI Core Integration & Live Environment Pipeline.**
The system runs end to end: live external APIs → Backend normalization →
AI Core reasoning → Socket.IO broadcast.

```
Milestone 1: Foundation & Contracts          done
Milestone 2: Backend Foundation              done
Milestone 3: AI Core / first cognitive loop  done
Milestone 4: Backend <-> AI Core integration done
Milestone 5: Frontend experience             <- you are here
Milestone 6: Demo & Polish
```

### Frontend

```bash
npm run dev:frontend      # http://localhost:5173
```

The interface is organised around a **Reasoning Spine** — the six cognitive
stages (Perceive → Model → Assess → Simulate → Deliberate → Recommend), each
producing a real domain model. A cycle travels down the spine live; any stage
can be clicked to interrogate its artifact. Hovering an evidence chip
cross-highlights its source stage and its marker on the map.

It currently renders a local cognitive simulation so the experience runs
without the full stack. Every component is typed against `@ai-env/contracts`
rather than mock shapes, so connecting the live Backend is a matter of
swapping the data source — see `src/api/client.ts` and `VITE_USE_MOCK`.

### The live pipeline

```
Open-Meteo + TomTom  ->  Environment Service (normalize/validate)
                     ->  InputEvent[]  ->  AI Core POST /reason
                     ->  Recommendation  ->  Socket.IO broadcast
```

Realtime channels (names shared via `@ai-env/contracts`):
`environment.updated`, `recommendation.generated`, `system.health`.

Trigger a cycle manually (the scheduler also runs it every
`ENVIRONMENT_POLL_INTERVAL_MS`):

```bash
curl -X POST http://localhost:4000/api/v1/environment/refresh
```

**No API keys required to run.** Weather uses Open-Meteo, which needs no key.
Traffic uses TomTom when `TOMTOM_API_KEY` is set and otherwise falls back to a
deterministic local provider, so the pipeline works on a fresh clone. See
`apps/backend/.env.example`.

## Running locally (without Docker)

Requires Node 20+ and Python 3.11+.

```bash
npm install
npm run dev:backend        # Express on http://localhost:4000/health
```

```bash
cd apps/ai-core
python -m venv .venv
.venv/Scripts/activate     # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/health
```

## Running with Docker Compose

```bash
docker compose up --build
```

Starts Postgres (`5432`), Backend (`4000`), AI Core (`8000`).

## Tooling

```bash
npm run lint            # ESLint (TS)
npm run format          # Prettier (TS/JSON/MD)
```

```bash
cd apps/ai-core
ruff check .
black .
```

## Repo layout

```
apps/
  backend/     Express service
  ai-core/     FastAPI service
  frontend/    placeholder — Milestone 4
packages/
  contracts/   shared TS types: events + API envelope (source of truth)
```
