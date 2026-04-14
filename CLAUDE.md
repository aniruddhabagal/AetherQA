# CLAUDE.md — AetherQA Development Guide

## What This File Is

This file is the **entry point** for agents and developers working on AetherQA. It contains only:

- Product identity and hard rules
- Where to find detailed specs (file paths, not inline content)
- Quick-reference decisions that apply to every task

**Read the referenced file for a task, not this whole document.**

---

## Project Overview

AetherQA is a standalone Node.js/TypeScript service: a five-agent LangGraph pipeline with Mem0 memory and Playwright browser automation that autonomously generates, runs, and self-heals tests for web applications. A React dashboard handles human-in-the-loop review.

**Full architecture, agent designs, API contracts, and rollout plan → [`implementation_plan.md`](./implementation_plan.md)**

**Stack:** Node.js · TypeScript · LangGraph · Mem0 · Playwright · React (Vite) · Express · PostgreSQL

---

## Repository Structure

```
aetherqa/
├── src/
│   ├── agents/               # .graph.ts files — one per agent
│   ├── memory/               # Mem0 client, schemas, query keys
│   ├── tools/                # playwright, voice, api, db-seeder, scroll, sse, github
│   ├── api/                  # Express routes, SSE manager, middleware
│   ├── db/                   # PostgreSQL schema (schema.sql)
│   ├── orchestrator.graph.ts
│   ├── state.types.ts
│   └── config.ts
├── tests/
│   ├── generated/            # Agent 3 writes .spec.ts here
│   ├── specs/                # Agent 2 writes .md specs here
│   │   ├── feature/
│   │   └── regression/
│   ├── fixtures/
│   │   ├── audio/            # WAV files for voice testing
│   │   └── db/               # JSON seed data per scenario
│   └── .auth/                # Saved Playwright storageState per role
├── dashboard/                # React (Vite) — separate app
│   └── src/
│       ├── pages/            # RunTrigger, SpecReview, RunMonitor, FailureTriage, MemoryInspector
│       └── components/
├── landing/                  # Static marketing page
├── docker-compose.yml
├── playwright.config.ts      # Generated dynamically per run
├── CLAUDE.md                 # This file
└── implementation_plan.md    # Full system spec — read this for any agent/pipeline task
```

---

## Brand & Design

### Product Identity

- **Name:** AetherQA — one word, capital A and QA. Never "Aether QA" or "aetherqa".
- **Tagline:** "Autonomous QA that learns."
- **Voice:** Technical, precise, confident. No marketing fluff. Speak like a senior engineer.
- **Personality:** Intelligent, reliable, surgical. Not playful, not corporate.

### Color Tokens

| Token                  | Hex       | Usage                            |
| ---------------------- | --------- | -------------------------------- |
| `--color-bg`           | `#F8F7F4` | Page background (warm off-white) |
| `--color-surface`      | `#FFFFFF` | Cards, panels                    |
| `--color-border`       | `#E8E6E1` | Borders, dividers                |
| `--color-grid`         | `#EDEBE6` | Grid line background             |
| `--color-text`         | `#1A1A1A` | Primary text                     |
| `--color-text-sub`     | `#6B6B6B` | Secondary/muted text             |
| `--color-accent`       | `#0A6E5C` | Primary accent — deep teal       |
| `--color-accent-hover` | `#08594A` | Accent hover                     |
| `--color-accent-light` | `#E6F5F1` | Accent tinted backgrounds        |
| `--color-pass`         | `#1A8C5E` | Pass / success                   |
| `--color-fail`         | `#D93025` | Fail / error                     |
| `--color-warn`         | `#E8A317` | Warnings, flaky tests            |
| `--color-heal`         | `#3B82F6` | Self-healed tests, AI actions    |
| `--color-tag-bg`       | `#F0EFEB` | Tag/badge backgrounds            |

**Hard rules — these apply everywhere, no exceptions:**

- NO purple gradients. Ever.
- NO pure `#FFFFFF` as page background — always use `--color-bg`.
- NO generic drop shadows. Max: `box-shadow: 0 1px 2px rgba(0,0,0,0.04)`.
- NO blue-to-purple or rainbow gradients. Gradients use `--color-accent` to lighter teal only.

### Typography

| Token            | Family          | Weight  | Usage                  |
| ---------------- | --------------- | ------- | ---------------------- |
| `--font-display` | Instrument Sans | 600–700 | Headings, page titles  |
| `--font-body`    | Instrument Sans | 400     | Body text              |
| `--font-mono`    | JetBrains Mono  | 400–500 | Code, test output, IDs |

Load from Google Fonts:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

**Hard rules:**

- DO NOT use Inter, Roboto, Open Sans, or system-ui as primary fonts.
- Headings: Instrument Sans 600 or 700. Body: Instrument Sans 400. Code: JetBrains Mono only.

### Type Scale

```css
--text-xs: 0.75rem; /* 12px — captions, badges */
--text-sm: 0.875rem; /* 14px — table cells, secondary */
--text-base: 1rem; /* 16px — body */
--text-lg: 1.125rem; /* 18px — lead paragraphs */
--text-xl: 1.25rem; /* 20px — section headings */
--text-2xl: 1.75rem; /* 28px — page titles */
--text-3xl: 2.25rem; /* 36px — hero subheading */
--text-4xl: 3.5rem; /* 56px — hero heading */
--text-5xl: 4.5rem; /* 72px — landing hero */
```

### Spacing & Layout

- Base unit: 4px. All spacing is multiples of this.
- Page max-width: 1200px, `margin: 0 auto`.
- Section padding: 80px 0 (desktop), 48px 0 (mobile).
- Card padding: 24px. Card border-radius: 12px. Button border-radius: 8px.
- Grid gap: 24px (cards), 16px (form elements).

### Grid Background Pattern

```css
.grid-bg {
  background-image:
    linear-gradient(var(--color-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

### Icons

- Lucide React only (`lucide-react`). Never Font Awesome, Material Icons, or emoji as icons.
- Default size: 20px. Compact: 16px. Section icons: 24px. Stroke-width: 1.5.

---

## Scroll & Animation Stack

**Required libraries:** `lenis`, `gsap`, `@gsap/react`

**Rules (apply to dashboard and landing):**

- ALL smooth scroll → Lenis.
- ALL scroll-linked animations → GSAP ScrollTrigger.
- Animate ONLY `transform` and `opacity`. Never `width`, `height`, `top`, `left`, `margin`.
- No `scroll-behavior: smooth` in CSS — conflicts with Lenis.
- No `IntersectionObserver` for animations — use ScrollTrigger.
- No ScrollSmoother, no Locomotive Scroll.
- Use `lenis.scrollTo()` not `window.scrollTo({ behavior: 'smooth' })`.

**Initialization pattern:**

```ts
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);
```

**Standard entrance animation:**

```ts
gsap.from(element, {
  y: 40,
  opacity: 0,
  duration: 0.8,
  ease: "power2.out",
  scrollTrigger: {
    trigger: element,
    start: "top 85%",
    toggleActions: "play none none none",
  },
});
```

---

## Tech Stack

### Service (root `/`)

|                    |                                                                 |
| ------------------ | --------------------------------------------------------------- |
| Runtime            | Node.js + TypeScript (`"strict": true`)                         |
| Orchestration      | LangGraph (`@langchain/langgraph`)                              |
| LLM                | `@langchain/google-genai` — use `gemini-2.5-pro` for all agents |
| Memory             | Mem0 (`mem0ai`) — agent / session / user scopes                 |
| Browser automation | Playwright                                                      |
| API                | Express + cors + helmet + express-rate-limit                    |
| Database           | PostgreSQL — results store + LangGraph checkpointer             |
| Validation         | Zod (internal), Ajv (API contract testing)                      |
| GitHub integration | `@langchain/mcp-adapters` → GitHub MCP Server sidecar           |

### Dashboard (`/dashboard`)

|                  |                            |
| ---------------- | -------------------------- |
| Framework        | React + TypeScript (Vite)  |
| Data fetching    | `@tanstack/react-query`    |
| Routing          | `react-router-dom`         |
| Icons            | `lucide-react`             |
| Scroll/animation | Lenis + GSAP ScrollTrigger |

---

## Agent Pipeline

Five agents + one scoper. Full implementation for each → [`implementation_plan.md`](./implementation_plan.md).

| #   | Name        | File                              | Role                                                                           |
| --- | ----------- | --------------------------------- | ------------------------------------------------------------------------------ |
| 0   | Scoper      | `src/agents/scoper.graph.ts`      | Maps feature description → scope + blast radius. Uses git diff via GitHub MCP. |
| 1   | Explorer    | `src/agents/explorer.graph.ts`    | Crawls app, builds accessibility context. Reads React Router config from repo. |
| 2   | Test Case   | `src/agents/testcase.graph.ts`    | Generates Markdown specs. Reads Zod schemas from repo for real edge cases.     |
| 3   | Automation  | `src/agents/automation.graph.ts`  | Writes + runs Playwright `.spec.ts` files.                                     |
| 4   | Maintenance | `src/agents/maintenance.graph.ts` | Self-heals broken tests using component source. Triages real bugs.             |
| 5   | API Tester  | `src/agents/api-tester.graph.ts`  | Full backend API coverage. Runs in parallel.                                   |

**Run modes:** `full` · `smoke` · `feature` — see [`implementation_plan.md §18`](./implementation_plan.md#18-run-modes).

**Memory scopes and what each agent stores/recalls** → [`src/memory/memory.schemas.ts`](./src/memory/memory.schemas.ts) and [`implementation_plan.md §4`](./implementation_plan.md#4-memory-architecture-mem0).

**GitHub codebase integration (per-agent usage)** → [`src/tools/github.tools.ts`](./src/tools/github.tools.ts) and [`implementation_plan.md §22`](./implementation_plan.md#22-github-codebase-integration).

---

## Key Implementation References

| Topic                                     | Where to read                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Full LangGraph state type                 | `src/state.types.ts` · [`implementation_plan.md §5`](./implementation_plan.md#5-langgraph-state-machine)                             |
| Mem0 client (typed scopes)                | `src/memory/mem0.client.ts` · [`implementation_plan.md §4`](./implementation_plan.md#4-memory-architecture-mem0)                     |
| Overlay dismissal + scroll helpers        | `src/tools/playwright.tools.ts` · [`implementation_plan.md §12`](./implementation_plan.md#12-frontend-edge-cases--complete-handling) |
| Voice testing (mock + audio injection)    | `src/tools/voice.tools.ts` · [`implementation_plan.md §13`](./implementation_plan.md#13-voice--mic-input-testing)                    |
| API test engine + rate limit tests        | `src/tools/api.tools.ts` · [`implementation_plan.md §14`](./implementation_plan.md#14-backend-api-testing--full-coverage)            |
| DB seed endpoint + transaction middleware | `src/tools/db-seeder.tools.ts` · [`implementation_plan.md §15`](./implementation_plan.md#15-test-data-management)                    |
| GitHub MCP tools wrapper                  | `src/tools/github.tools.ts` · [`implementation_plan.md §22`](./implementation_plan.md#22-github-codebase-integration)                |
| Express routes + SSE manager              | `src/api/routes.ts` · [`implementation_plan.md §16`](./implementation_plan.md#16-express-api-gateway)                                |
| Dashboard pages (5 views)                 | `dashboard/src/pages/` · [`implementation_plan.md §17`](./implementation_plan.md#17-react-dashboard)                                 |
| Playwright config (voice/UI split)        | `playwright.config.ts` · [`implementation_plan.md §8`](./implementation_plan.md#8-agent-3--automation)                               |
| PostgreSQL schema                         | `src/db/schema.sql` · [`implementation_plan.md §19`](./implementation_plan.md#19-docker--deployment)                                 |
| Docker Compose (incl. GitHub MCP sidecar) | `docker-compose.yml` · [`implementation_plan.md §19`](./implementation_plan.md#19-docker--deployment)                                |
| Rollout plan (5 weeks)                    | [`implementation_plan.md §20`](./implementation_plan.md#20-rollout-plan)                                                             |

---

## Code Rules

### TypeScript

- Strict mode always (`"strict": true`).
- `import`/`export` only — no `require()`.
- `const` over `let`. Never `var`.
- Explicit return types on all exported functions.
- No `any` unless interfacing with untyped third-party APIs (comment why).
- Named exports over default exports.
- Zod for all external inputs: API requests, LLM outputs, Mem0 results.

### File Naming

- Agent graphs: `<name>.graph.ts`
- Tools: `<name>.tools.ts`
- Types: `<name>.types.ts` or co-located
- Generated test specs: `<id>-<title>.spec.ts` or `<id>-<title>.voice.spec.ts`
- Dashboard pages/components: PascalCase `.tsx`

### Playwright Tests (generated and handwritten)

- Locators: `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `getByTestId` only.
- NEVER use CSS selectors or XPath.
- NEVER use `waitForTimeout` — use `waitForResponse`, `waitForSelector`, etc.
- Every test calls `seedTestData()` at the start — never reuse data from other tests.
- Use `storageState` for auth — never re-login inside a test.
- Voice tests: `.voice.spec.ts` suffix, `workers: 1`.
- API tests: include `X-Test-Run: true` header for automatic DB rollback.

### Frontend (Dashboard + Landing)

- All colors, fonts, spacing via CSS custom properties — no hardcoded values.
- No inline styles except truly dynamic values (e.g. progress bar widths).
- Mobile-first. Breakpoints: 640px / 768px / 1024px / 1200px.
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`.

---

## Git Rules

- Commit after every feature. One logical change per commit.
- Imperative mood, under 72 chars: `Add Explorer agent memory recall node`
- Refactors and features are separate commits.
- DO NOT add `Co-authored-by: Claude` or any AI attribution.
- DO NOT add `Signed-off-by` trailers unless explicitly asked.
- Never force-push to shared branches without explicit permission.
- No emoji in commit messages or code comments.

---

Update every week's status by marking them complete / incompete in here after every commit.

---

## Environment Variables

Full list with descriptions → [`implementation_plan.md §3`](./implementation_plan.md#3-tech-stack--dependencies).

Required in `.env` (never commit this file, never log keys):

```
GOOGLE_API_KEY
MEM0_API_KEY
DATABASE_URL
DEFAULT_TARGET_URL
GITHUB_TOKEN          # Fine-grained PAT: contents:read only on app repo
GITHUB_OWNER
GITHUB_REPO
GITHUB_DEFAULT_BRANCH
GITHUB_MCP_URL        # Default: http://github-mcp:8080/sse
TEST_USER_EMAIL / TEST_USER_PASSWORD
TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
DASHBOARD_SECRET
```

---

## Quick Commands

```bash
# Start all services (includes GitHub MCP sidecar)
docker compose up -d

# Run service in dev mode
npx tsx src/index.ts

# Start dashboard in dev mode
cd dashboard && npm run dev

# Run all generated tests
npx playwright test tests/generated/

# Run voice tests only (workers: 1 enforced in config)
npx playwright test tests/generated/ --project voice-tests
```

---

## Hard Nos (complete list)

| Category   | Never do this                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Design     | Purple gradients · pure `#FFF` background · generic box-shadows · Inter/Roboto/system-ui as primary font                           |
| Scroll     | `scroll-behavior: smooth` · ScrollSmoother · Locomotive Scroll · `IntersectionObserver` for animations · animate layout properties |
| Playwright | `waitForTimeout` · CSS selectors · XPath · hardcoded fixture IDs · re-login inside tests                                           |
| Code       | `require()` · `var` · untyped `any` without comment · default exports                                                              |
| Git        | Co-author attribution · emoji in commits · batching unrelated changes                                                              |
| Security   | Committing `.env` · logging API keys                                                                                               |

---

## Rollout Task List

Full context and validation criteria for each week → [`implementation_plan.md §20`](./implementation_plan.md#20-rollout-plan).

### Week 1 — Foundation

**Goal:** Service runs, Explorer works, no agents yet.

- [x] Scaffold repo structure (all folders, `tsconfig.json`, root `package.json`)
- [x] Set up Docker Compose — service + dashboard + postgres containers
- [x] Implement `src/memory/mem0.client.ts` with typed agent/session/user scopes
- [x] Implement Express API gateway — `POST /runs`, `GET /runs/:id/stream` (SSE)
- [x] Build Explorer agent (`src/agents/explorer.graph.ts`) — run against staging URL manually
- [x] Verify accessibility tree output is useful for at least 3 routes
- [x] Auth setup — save `storageState` for all roles to `tests/.auth/`
- [x] Dashboard: Run Trigger page only (`dashboard/src/pages/RunTrigger.tsx`)

**Done when:** QA engineer can trigger a run from the dashboard and see the Explorer's app context JSON.

---

### Week 2 — Human-in-the-Loop

**Goal:** Specs generate, QA reviews them, system learns from feedback.

- [x] Implement Test Case agent (`src/agents/testcase.graph.ts`) — spec generation
- [x] Implement LangGraph human checkpoint — graph pauses after Agent 2 (`specsApproved: false`)
- [x] Implement `POST /runs/:id/approve` endpoint in `src/api/routes.ts`
- [x] Dashboard: Spec Review page with inline editor (`dashboard/src/pages/SpecReview.tsx`)
- [x] Implement Mem0 writes for spec patterns and user preferences
- [ ] Test with real feature — QA reviews AI specs for 3 existing flows

**Done when:** QA team reviews AI-generated specs for familiar features and 80%+ need no edits.

---

### Week 3 — Automation, Voice & GitHub Integration

**Goal:** Tests run, voice works, results stream to dashboard. GitHub codebase access live.

- [x] Implement Automation agent (`src/agents/automation.graph.ts`) — UI, voice, API code gen templates
- [x] Implement `injectSpeechMock` and `injectSpeechErrorMock` in `src/tools/voice.tools.ts`
- [x] Create audio fixture library — 6 WAV files in `tests/fixtures/audio/`
- [x] Set up `playwright.config.ts` with voice project (`workers: 1`) and UI project (`workers: 4`)
- [x] Implement SSE result streaming from runner to dashboard
- [x] Dashboard: Run Monitor page (`dashboard/src/pages/RunMonitor.tsx`)
- [ ] Create fine-grained GitHub PAT (`contents: read` only on app repo)
- [ ] Add `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` to `.env` and Docker secrets
- [x] Install `@langchain/mcp-adapters`, implement `src/tools/github.tools.ts`
- [x] Add GitHub MCP sidecar to `docker-compose.yml`
- [x] Wire `enrichWithCodebase` into Explorer — validate it finds the React Router config file
- [x] Wire `fetchValidationLogic` into Test Case — validate edge cases reference real Zod constraints
- [ ] Run in shadow mode alongside existing QA process — compare results

**Done when:** Agent-generated tests catch the same bugs as manual testing for 3 flows. Spec edge cases reference real Zod schema constraints, not DOM inference.

---

### Week 4 — API Tester, Maintenance & Source-Aware Healing

**Goal:** Full pipeline end-to-end, self-healing working, Scoper uses git diff.

- [x] Implement API Tester agent (`src/agents/api-tester.graph.ts`) — contract, auth, input validation
- [x] Add `testTransactionMiddleware` to main backend (`src/api/middleware.ts`)
- [x] Implement `POST /api/test/seed` on main backend with at least 5 scenarios (`src/api/routes.ts`)
- [x] Implement Maintenance agent (`src/agents/maintenance.graph.ts`) — triage, heal, escalate
- [x] Wire `fetchGitDiff` into Scoper — full Scoper implementation (`src/agents/scoper.graph.ts`)
- [x] Wire `fetchRepoFile` into Maintenance `healSelectors` — uses GitHub MCP to fetch component source
- [x] Dashboard: Failure Triage page (`dashboard/src/pages/FailureTriage.tsx`)
- [ ] Run full regression — measure pass rate

**Done when:** Full pipeline runs end-to-end. Maintenance agent heals at least 1 real selector breakage without human intervention. Scoper's blast radius matches actual changed files from git diff.

---

### Week 5 — Feature Scoping & Memory Inspector

**Goal:** Scoped runs work, memory is inspectable and correctable.

- [x] Implement Scoper agent (`src/agents/scoper.graph.ts`)
- [x] Add `runMode: "feature"` option to dashboard Run Trigger form
- [x] Implement blast-radius auto-approval logic (regression bucket skips human review)
- [x] Dashboard: Memory Inspector page (`dashboard/src/pages/MemoryInspector.tsx`)
- [ ] Test scoped run against a real new feature in the app
- [x] Implement smoke mode — critical flows queried from user-scoped Mem0

**Done when:** QA engineer tests a new feature in under 10 minutes from trigger to results. Memory Inspector surfaces meaningful learned facts that can be deleted.

---

### Month 2 — Hardening

- [ ] Tune Maintenance agent — track heal success rate in Mem0, improve prompts based on patterns
- [ ] Add flaky test quarantine — tests that fail intermittently get auto-disabled and flagged
- [ ] Expand fixture scenario catalog in `src/tools/fixtures.catalog.ts` as app grows
- [ ] Add LLM token cost monitoring — log cost per agent per run
- [ ] Tune Explorer overlay dismissal to handle all overlay types encountered in the app
- [ ] Write QA team runbook: how to add memory corrections, add fixture scenarios, set critical flows
