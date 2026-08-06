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

**Milestone 1 — Foundation & System Contracts.** Monorepo, tooling, shared
contracts, and health endpoints only. No business logic, no AI reasoning, no
frontend features yet.

```
Milestone 1: Foundation & Contracts   <- you are here
Milestone 2: Backend Foundation
Milestone 3: AI Cognitive Core
Milestone 4: Frontend
Milestone 5: Integration
Milestone 6: Demo & Polish
```

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
