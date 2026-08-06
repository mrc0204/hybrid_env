# Agentic Environment Intelligence System

An AI system that observes a real physical environment, builds a live world
model of it, reasons about what could go wrong, has a council of specialist
agents argue about what to do, and returns a personalized recommendation with
its full reasoning attached — evidence, confidence, and the alternatives it
rejected.

Not a dashboard. Not a chatbot. The interface is the reasoning itself.

**Live demo:** https://hybrid-env-frontend.vercel.app

> Hosted on free tiers that sleep when idle — the first request after a quiet
> period takes 30–60s to wake the services. Subsequent requests are fast.

Type any real place (`IIT Hyderabad`, `Charminar`, or pick from the
suggestions). The system geocodes it, pulls live weather and traffic for those
coordinates, discovers the surrounding infrastructure from OpenStreetMap,
assesses risk, simulates candidate actions, runs a five-agent deliberation,
and explains what it decided.

## The idea

Most "AI recommendation" systems show you a conclusion and ask you to trust
it. The contracts here carry the entire cognitive trace, so the UI can show
the argument instead: every simulated alternative, every agent's vote and
rationale, the consensus score, and the governance decision that let the
recommendation through.

The interface is organized as a **Reasoning Spine** — six stages, each
producing a real domain model you can click into:

```
Perceive  →  Model      →  Assess      →  Simulate           →  Deliberate  →  Recommend
InputEvent[] WorldState    RiskState[]    SimulationResult[]    Decision       Recommendation
```

Confidence is drawn against the 60% governance threshold. Below it, the panel
visibly changes character: a review banner appears, the action is
de-emphasized, and the alternatives are promoted. A system that looks equally
certain at 44% and 87% is one you eventually stop believing.

## Architecture

Three independently deployable services. They share nothing but the contracts
in [`packages/contracts`](packages/contracts), mirrored for Python in
[`apps/ai-core/app/contracts`](apps/ai-core/app/contracts).

| Layer        | Path            | Stack                                | Responsibility                                                                      |
| ------------ | --------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| **Frontend** | `apps/frontend` | React, TS, Vite, Tailwind, Zustand   | Presentation only. Renders the reasoning trace; holds no business logic.            |
| **Backend**  | `apps/backend`  | Node, Express, TS, Socket.IO, Prisma | Orchestration, external APIs, normalization, realtime. **Never does AI reasoning.** |
| **AI Core**  | `apps/ai-core`  | Python, FastAPI, Pydantic            | All intelligence: perception, world model, risk, simulation, agents, governance.    |

The boundary is strict and load-bearing: the Backend owns every third-party
integration and the AI Core owns every judgment. Either can be replaced
without touching the other, because both are typed against the same seven
domain models — `WorldState`, `GoalState`, `RiskState`, `SimulationResult`,
`Decision`, `Recommendation`, `UserContext`.

See [`packages/contracts/CONTRACTS.md`](packages/contracts/CONTRACTS.md) for
the event model and API envelope.

### The pipeline

```
                  ┌─ Nominatim (geocode) ──┐
                  ├─ Overpass (OSM infra) ─┤
Organization ────►├─ Open-Meteo (weather) ─┼──► Backend: normalize → InputEvent[]
                  └─ TomTom (traffic) ─────┘              │
                                                          ▼
                                         AI Core: POST /reason
                        Perception → World Model → Risk → Simulation
                                  → 5 Expert Agents → Critic → Consensus
                                  → Governance → Recommendation
                                                          │
                                          ┌───────────────┴───────────────┐
                                          ▼                               ▼
                                    HTTP response                Socket.IO broadcast
```

### The expert council

Five specialist agents in
[`apps/ai-core/app/reasoning/agents`](apps/ai-core/app/reasoning/agents), each
scoring the same candidate actions through a genuinely different lens — not
one ranking relabeled five times:

| Agent                | Optimizes for                                           |
| -------------------- | ------------------------------------------------------- |
| `safety`             | Addressing the highest-severity risk first              |
| `operations`         | Minimizing operational disruption cost                  |
| `accessibility`      | Step-free access; penalizes unverified alternate routes |
| `student_experience` | Schedule impact and punctuality                         |
| `sustainability`     | Environmental cost, weighed against risk severity       |

The Consensus Engine resolves them by confidence-weighted vote, records every
vote and dissent on the `Decision`, and assigns a governance status:
`rejected` below a 0.3 success-probability floor, `approved` at ≥0.6
consensus, otherwise `pending_human_approval`.

Risk detection is deterministic and rule-based — legible on purpose, so the
reasoning can be audited. Four rules currently fire: `congestion`,
`travel-delay` (rain compounding congestion), `heat-exposure`, and
`crowd-buildup`.

## Resilience

Every external dependency here is a free public API that can and does fail
mid-demo. Degradation is deliberately asymmetric, because honesty matters more
than availability once a real place is involved:

- **Overpass down** → continue with zero infrastructure entities. It enriches
  the world model but isn't required for one; weather and traffic still
  produce a complete recommendation.
- **TomTom key absent** → deterministic local traffic provider, clearly
  labelled `fallback-simulated` so it is never mistaken for live data.
- **Geocoding fails for a named place** → error, _not_ a silent substitution.
  Answering a search for one place with the demo campus's data would present
  fiction as fact. The user is offered a Google Maps link fallback instead.
- **AI Core down** → typed 503 with bounded retries; the Backend stays up and
  self-recovers when the AI Core returns.
- **Pipeline errors mid-cycle** → contained; the background scheduler never
  wedges.

## Running locally

Requires Node 20+ and Python 3.11+. **No API keys needed** — weather uses
Open-Meteo (keyless) and traffic falls back to a deterministic provider, so a
fresh clone works end to end.

```bash
npm install
npm run dev:backend        # http://localhost:4000/health
```

```bash
cd apps/ai-core
python -m venv .venv
.venv/Scripts/activate     # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/health
```

```bash
npm run dev:frontend       # http://localhost:5173
```

The frontend defaults to a self-contained mock so it runs with no backend. To
point it at the live stack, create `apps/frontend/.env`:

```env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4000
```

Optional: copy `apps/backend/.env.example` to `apps/backend/.env` to set a
`TOMTOM_API_KEY` or change the environment scope.

### With Docker Compose

```bash
docker compose up --build
```

Starts Postgres (`5432`), Backend (`4000`), AI Core (`8000`).

## Testing and tooling

```bash
npm run build          # contracts → backend → frontend
npm test               # 52 backend tests (vitest)
npm run lint           # ESLint
npm run format:check   # Prettier
```

```bash
cd apps/ai-core
pytest -q              # 38 tests
ruff check . && black --check .
```

All of the above run on every push via
[GitHub Actions](.github/workflows/ci.yml).

## Deployment

Frontend on Vercel, Backend and AI Core on Render. `vercel.json` and
`render.yaml` are committed, so both platforms self-configure on import — see
[`DEPLOYMENT.md`](DEPLOYMENT.md) for the step-by-step, including which
environment variables must be set by hand.

## Known limitations

Stated plainly, because a system that reports its own boundaries is easier to
trust than one that doesn't:

- **No persistence.** The world model and reasoning trace live in memory in a
  single process. Restarting loses history; running two instances gives them
  divergent state. Postgres is wired up and health-checked but no domain table
  is used yet — the Prisma schema holds only a placeholder model.
- **No continuous learning.** Agent weights and risk thresholds are
  hand-tuned constants. There is no outcome-evaluation or policy-update loop;
  "learning" is a design goal, not a shipped feature.
- **Realtime is broadcast-only.** The Backend emits on three Socket.IO
  channels (`environment.updated`, `recommendation.generated`,
  `system.health`), but the frontend currently polls via request/response
  rather than subscribing.
- **Personalization uses a single fixed user.** `UserContext` is plumbed end
  to end and shapes the recommendation, but the API does not yet accept one
  per request.
- **Risk rules are narrow.** Four deterministic rules over weather, traffic,
  and events — enough to demonstrate the reasoning architecture, far from
  domain coverage.

## Repo layout

```
apps/
  frontend/    React app — the Reasoning Spine interface
  backend/     Express service — orchestration and integrations
  ai-core/     FastAPI service — all reasoning
packages/
  contracts/   shared TS types: 7 domain models, events, API envelope
```

## License

[MIT](LICENSE)
