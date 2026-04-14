# AetherQA

> Autonomous QA that learns.

AetherQA is a multi-tenant SaaS platform that autonomously generates, executes, and self-heals test suites for web applications. A five-agent LangGraph pipeline — backed by Mem0 persistent memory — crawls your staging environment, writes Playwright tests, runs them, and fixes selector breakages without human intervention. Teams sign up, connect their staging URL, and ship faster.

---

## How It Works

```
QA Dashboard (React)
       │  trigger / approve / triage
       ▼
Express API Gateway  ──SSE streaming──▶  Dashboard
       │
       ▼
LangGraph Orchestrator
       │
       ├──▶ [0] Scoper        — maps blast radius from git diff (feature runs)
       ├──▶ [1] Explorer      — crawls app, builds accessibility context
       ├──▶ [2] Test Case     — generates human-readable specs
       │          ↑ HUMAN CHECKPOINT — QA reviews and approves
       ├──▶ [3] Automation    — writes and runs Playwright .spec.ts files
       ├──▶ [4] Maintenance   — self-heals broken selectors, triages real bugs
       └──▶ [5] API Tester    — full backend API coverage (runs in parallel)
       │
       ▼
Mem0 Memory Layer  (agent / session / user scopes)
       │
       ▼
PostgreSQL  (runs, results, orgs, users, audit log)
```

The system compounds knowledge across runs. Each run, the agents recall what they learned before — route structures, overlay patterns, flaky selectors, known bugs — and produce measurably better output over time.

---

## Features

### Agent Pipeline

| Agent | Role |
|---|---|
| **Scoper** | Parses feature descriptions, fetches git diffs via GitHub MCP, resolves exact blast radius |
| **Explorer** | Crawls the app with Playwright, captures accessibility trees, detects voice inputs, WebSockets, file uploads |
| **Test Case** | Generates structured Markdown specs grounded in real Zod validation schemas from source |
| **Automation** | Writes and executes Playwright tests — UI, voice (Web Speech API mock), and API |
| **Maintenance** | Self-heals broken selectors using component JSX source, triages real bugs vs. test issues |
| **API Tester** | Runs contract, auth, input validation, and rate-limit tests against every backend endpoint |

### Run Modes

| Mode | What it does |
|---|---|
| `full` | All known routes, complete spec suite, full API coverage |
| `smoke` | Critical flows only — defined by the QA team in the Memory Inspector |
| `feature` | Scoped to a new feature — Scoper maps blast radius from git diff, only affected areas tested |

### Memory System (Mem0)

- **Agent scope** — permanent system knowledge: route structures, overlay patterns, self-heal strategies
- **Session scope** — per-run ephemeral state: which tests passed, explored routes, scope JSON
- **User scope** — per engineer: preferred spec style, flows that always need manual review, smoke mode critical flows

### Multi-Tenant SaaS

- Organizations with role-based access control (owner / admin / member)
- Full data isolation per org — runs, memory, and results never cross organization boundaries
- Invite team members via email with scoped roles
- Organization switcher in the dashboard sidebar

### Authentication

- Email + password registration and login
- OAuth via Google and GitHub
- JWT access tokens (15 min) + rotated refresh tokens (7 days, `httpOnly` cookie)
- Password reset via transactional email

### Voice Testing

Injects a Web Speech API mock directly into the browser page and feeds pre-recorded WAV fixtures — no microphone required. Six fixtures cover: clear English, accented speech, silence, background noise, very long utterances, and non-English input.

### GitHub Codebase Integration

Agents read your source repo via an official GitHub MCP Server sidecar. Zero write access — fine-grained PAT with `contents: read` only. Used to:

- ground blast radius in real git diffs (Scoper)
- discover feature-flagged routes not yet linked in the UI (Explorer)
- extract real Zod/Yup validation constraints for edge-case generation (Test Case)
- read component JSX to find `data-testid` and `aria-label` values for self-healing (Maintenance)

### Dashboard

Five pages with real-time SSE streaming, human-in-the-loop spec review, failure triage, and memory inspection.

| Page | Purpose |
|---|---|
| **Run Trigger** | Start a run — select mode, set target URL, describe feature (for feature mode) |
| **Spec Review** | Review AI-generated specs, edit inline, approve to resume the pipeline |
| **Run Monitor** | Live agent event stream with test result cards as they arrive |
| **Failure Triage** | AI-diagnosed failures with self-heal status, reproduction steps, curl commands, screenshots |
| **Memory Inspector** | Search and delete agent memory; define critical flows for smoke mode |

---

## Tech Stack

### Service

| | |
|---|---|
| Runtime | Node.js 22 + TypeScript (strict mode) |
| Orchestration | LangGraph (`@langchain/langgraph`) |
| LLM | Google Gemini 2.5 Pro (`@langchain/google-genai`) |
| Memory | Mem0 (`mem0ai`) |
| Browser automation | Playwright |
| API | Express + Helmet + CORS + rate limiting |
| Auth | `jsonwebtoken` + `bcrypt` |
| Email | Nodemailer |
| Database | PostgreSQL 16 |
| Validation | Zod + Ajv |
| GitHub integration | `@langchain/mcp-adapters` + GitHub MCP Server |

### Dashboard

| | |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Data fetching | TanStack Query |
| Routing | React Router v7 |
| Scroll / animation | Lenis + GSAP ScrollTrigger |
| Icons | Lucide React |

---

## Repository Structure

```
aetherqa/
├── src/
│   ├── agents/
│   │   ├── scoper.graph.ts        # Agent 0 — blast radius from git diff
│   │   ├── explorer.graph.ts      # Agent 1 — app crawler
│   │   ├── testcase.graph.ts      # Agent 2 — spec generator
│   │   ├── automation.graph.ts    # Agent 3 — test writer & runner
│   │   ├── maintenance.graph.ts   # Agent 4 — self-healer & triage
│   │   └── api-tester.graph.ts    # Agent 5 — backend API coverage
│   ├── memory/
│   │   ├── mem0.client.ts         # Typed Mem0 wrapper (3 scopes)
│   │   ├── memory.schemas.ts      # What each scope stores
│   │   └── memory.keys.ts         # Canonical recall query strings
│   ├── tools/
│   │   ├── playwright.tools.ts    # Browser launch, auth, overlay dismissal
│   │   ├── voice.tools.ts         # Web Speech API mock + audio injection
│   │   ├── api.tools.ts           # HTTP client, schema validator, diff
│   │   ├── db-seeder.tools.ts     # Test data seed/cleanup
│   │   ├── github.tools.ts        # GitHub MCP wrapper
│   │   └── scroll.tools.ts        # Infinite scroll, virtual lists
│   ├── api/
│   │   ├── routes.ts              # QA pipeline routes
│   │   ├── auth.routes.ts         # Login, register, OAuth, password reset
│   │   ├── org.routes.ts          # Organization CRUD, members, invites
│   │   ├── sse.ts                 # SSE manager
│   │   └── middleware.ts          # authRequired, orgRequired, requireRole
│   ├── auth/
│   │   ├── jwt.ts                 # JWT sign/verify, refresh rotation
│   │   ├── password.ts            # bcrypt hash/compare
│   │   └── oauth.ts               # Google + GitHub OAuth handlers
│   ├── db/schema.sql              # PostgreSQL schema
│   ├── orchestrator.graph.ts      # Main LangGraph StateGraph
│   ├── state.types.ts             # Shared state types
│   └── config.ts                  # Env var loader
├── tests/
│   ├── generated/                 # Agent 3 writes .spec.ts here
│   ├── specs/                     # Agent 2 writes .md specs here
│   ├── fixtures/audio/            # WAV fixtures for voice testing
│   └── .auth/                     # Playwright storageState per role
├── dashboard/
│   └── src/
│       ├── pages/
│       │   ├── auth/              # Login, Register, ForgotPassword, ResetPassword
│       │   └── org/               # OrgSettings, Members, OrgSwitcher
│       └── lib/                   # AuthProvider, apiFetch wrapper
├── landing/                       # Static marketing page
├── docker-compose.yml
├── Dockerfile
└── implementation_plan.md         # Full system specification
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker + Docker Compose
- Google AI Studio API key ([get one here](https://aistudio.google.com/apikey))
- Mem0 API key ([get one here](https://app.mem0.ai))

### 1. Clone and install

```bash
git clone https://github.com/your-username/aetherqa.git
cd aetherqa
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Required
GOOGLE_API_KEY=AIza...
MEM0_API_KEY=m0-...
DATABASE_URL=postgresql://qa:qa@localhost:5432/agentic_qa

# Auth
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>

# Target app under test
DEFAULT_TARGET_URL=https://staging.yourapp.com

# GitHub integration (optional — enables codebase-aware agents)
GITHUB_TOKEN=github_pat_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-app-repo
```

### 3. Start services

```bash
docker compose up -d
```

This starts:

| Service | Port | Purpose |
|---|---|---|
| `aetherqa` | 4000 | Node.js QA service |
| `dashboard` | 3001 | React dashboard |
| `postgres` | 5432 | PostgreSQL database |
| `github-mcp` | 8080 | GitHub MCP sidecar (optional) |

### 4. Open the dashboard

Navigate to `http://localhost:3001`, register an account, and trigger your first run.

---

## Running Tests

```bash
# Run all agent-generated tests
npm test

# Voice tests only (single worker, WAV injection)
npm run test:voice

# Type-check the service
npx tsc --noEmit
```

---

## Development

```bash
# Service — hot reload
npm run dev

# Dashboard — hot reload
cd dashboard && npm run dev
```

---

## Architecture Deep Dive

The full implementation specification — agent designs, API contracts, memory schemas, DB schema, run modes, GitHub integration, SaaS auth, multi-tenancy, and the rollout plan — lives in [`implementation_plan.md`](./implementation_plan.md).

Key sections:

| Section | Topic |
|---|---|
| [§4](./implementation_plan.md#4-memory-architecture-mem0) | Memory architecture — 3 Mem0 scopes |
| [§11](./implementation_plan.md#11-agent-0--scoper-feature-run-mode) | Scoper agent — blast radius from git diff |
| [§13](./implementation_plan.md#13-voice--mic-input-testing) | Voice testing — WAV injection, error stubs |
| [§18](./implementation_plan.md#18-run-modes) | Run modes — full / smoke / feature |
| [§22](./implementation_plan.md#22-github-codebase-integration) | GitHub integration — codebase-aware agents |
| [§23](./implementation_plan.md#23-saas-authentication--authorization) | SaaS auth — JWT, OAuth, RBAC |
| [§24](./implementation_plan.md#24-multi-tenant-data-model) | Multi-tenant data model — org isolation |
| [§25](./implementation_plan.md#25-saas-dashboard--auth--org-pages) | Dashboard auth and org pages |

---

## Roadmap

| Status | Milestone |
|---|---|
| Done | All 6 agents (Scoper, Explorer, Test Case, Automation, Maintenance, API Tester) |
| Done | Human-in-the-loop spec review with inline editing |
| Done | Feature scoping with blast-radius detection |
| Done | Smoke mode with user-defined critical flows |
| Done | Memory Inspector |
| Done | GitHub codebase integration |
| In progress | Authentication — JWT + OAuth (Google, GitHub) |
| In progress | Multi-tenancy — organizations, RBAC, invites |
| Planned | Password reset + transactional email |
| Planned | Audit log + LLM usage tracking per org |
| Planned | Stripe integration (paid plans) |
| Planned | CI/CD API key authentication |
| Planned | SAML/SSO for enterprise customers |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT
