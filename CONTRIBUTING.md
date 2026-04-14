# Contributing to AetherQA

Thanks for your interest in contributing. This document covers how to get your development environment running, the project's conventions, and how to submit changes.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Conventions](#code-conventions)
- [Working on Agents](#working-on-agents)
- [Working on the Dashboard](#working-on-the-dashboard)
- [Commit Style](#commit-style)
- [Pull Requests](#pull-requests)
- [Design System](#design-system)

---

## Development Setup

### Requirements

- Node.js 22+
- Docker + Docker Compose
- A Google AI Studio API key (Gemini 2.5 Pro)
- A Mem0 API key

### 1. Fork and clone

```bash
git clone https://github.com/your-username/aetherqa.git
cd aetherqa
```

### 2. Install dependencies

```bash
# Service
npm install

# Dashboard (separate Vite app)
cd dashboard && npm install && cd ..
```

### 3. Set up environment

```bash
cp .env.example .env
# Fill in GOOGLE_API_KEY, MEM0_API_KEY, DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

Generate strong JWT secrets:

```bash
openssl rand -hex 32  # run twice — once for JWT_SECRET, once for JWT_REFRESH_SECRET
```

### 4. Start the database

```bash
docker compose up postgres -d
```

Or start all services:

```bash
docker compose up -d
```

### 5. Run in dev mode

```bash
# Service (port 4000)
npm run dev

# Dashboard (port 3001) — separate terminal
cd dashboard && npm run dev
```

### 6. Type-check

```bash
npx tsc --noEmit          # service
cd dashboard && npx tsc --noEmit  # dashboard
```

Both must pass with zero errors before submitting a PR.

---

## Project Structure

```
src/agents/       — one LangGraph StateGraph per agent (.graph.ts)
src/memory/       — Mem0 client, schemas, canonical recall keys
src/tools/        — browser, voice, api, db, github, scroll tools
src/api/          — Express routes, auth, org, SSE, middleware
src/auth/         — JWT, password, OAuth
src/db/           — PostgreSQL schema
dashboard/src/    — React (Vite) dashboard
tests/generated/  — Agent-written Playwright specs (do not edit manually)
tests/specs/      — Agent-written Markdown specs (do not edit manually)
tests/fixtures/   — Audio WAV files and DB seed data
```

The full architecture specification is in [`implementation_plan.md`](./implementation_plan.md). Read the relevant section before modifying any agent, route, or memory schema.

---

## Code Conventions

### TypeScript

- Strict mode always (`"strict": true` in `tsconfig.json`)
- `import` / `export` only — no `require()`
- `const` over `let`. Never `var`.
- Explicit return types on all exported functions
- No `any` unless interfacing with untyped third-party code — add a comment explaining why
- Named exports — no default exports

### Naming

| Thing | Convention |
|---|---|
| Agent graph files | `<name>.graph.ts` |
| Tool files | `<name>.tools.ts` |
| Type files | `<name>.types.ts` |
| Dashboard pages | `PascalCase.tsx` |
| Generated test specs | `<id>-<title>.spec.ts` |
| Voice test specs | `<id>-<title>.voice.spec.ts` |

### Security

- Every `/api/*` route (except `/auth/*`) must be behind `authRequired` middleware
- Every pipeline route (`/runs`, `/memory`, etc.) must also use `orgRequired`
- All DB queries for pipeline data must include `org_id` — never return cross-org data
- Never store tokens in `localStorage` — access tokens in memory, refresh tokens as `httpOnly` cookies
- Never log tokens, passwords, or API keys
- Never commit `.env`

### Validation

- All external inputs (API request bodies, LLM outputs, Mem0 results) must be validated with Zod
- Use Ajv for API contract testing in the API Tester agent

---

## Working on Agents

Each agent is a self-contained LangGraph `StateGraph` in `src/agents/<name>.graph.ts`. They share state via `QARunState` (defined in `src/state.types.ts`).

### Agent structure

```typescript
// src/agents/example.graph.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { QARunState, QARunStateType } from "../state.types.js";

async function recallMemory(state: QARunStateType): Promise<Partial<QARunStateType>> {
  // 1. Recall relevant memory before acting
}

async function doWork(state: QARunStateType): Promise<Partial<QARunStateType>> {
  // 2. Do the agent's actual work
}

async function saveMemory(state: QARunStateType): Promise<Partial<QARunStateType>> {
  // 3. Persist facts learned this run
}

const graph = new StateGraph(QARunState)
  .addNode("recallMemory", recallMemory)
  .addNode("doWork", doWork)
  .addNode("saveMemory", saveMemory)
  .addEdge(START, "recallMemory")
  .addEdge("recallMemory", "doWork")
  .addEdge("doWork", "saveMemory")
  .addEdge("saveMemory", END);

export const runExample = graph.compile();
```

### Memory conventions

Use the canonical keys from `src/memory/memory.keys.ts` when recalling — this ensures recall hits the right memories across runs. Add new keys there if you're adding a new recall pattern.

Agent-scoped memory (`agentMemory`) is **org-scoped** — the agent ID is `aetherqa:{orgId}`, not a global singleton. Never use a hardcoded agent ID.

### LLM usage

Use `gemini-2.5-pro` for all agents (set via `config.llmModel`). Log token counts to `usage_logs` after every LLM call — see existing agents for the pattern.

---

## Working on the Dashboard

The dashboard is a separate Vite app at `dashboard/`. It has its own `package.json` and `tsconfig.json`.

### Fetch wrapper

Use `apiFetch` from `dashboard/src/lib/api.ts` for all API calls — it attaches the JWT access token and current org slug automatically, and handles 401 → refresh transparently.

Never call `fetch()` directly from a page or component.

### Auth context

Use `useAuth()` from `dashboard/src/lib/auth.ts` to access the current user. Use `useOrg()` from the org context to access the current organization.

### Playwright test locators

Generated tests must only use accessible locators:

```typescript
// Allowed
page.getByRole(...)
page.getByLabel(...)
page.getByText(...)
page.getByPlaceholder(...)
page.getByTestId(...)

// Never use
page.locator(".css-class")
page.locator("//xpath")
```

Never use `waitForTimeout`. Use `waitForResponse`, `waitForSelector`, or `waitForURL` instead.

---

## Commit Style

One logical change per commit. Imperative mood, under 72 characters.

```
feat: add OAuth callback handler for GitHub
fix: prevent cross-org data leak in GET /runs
refactor: extract JWT refresh logic into auth middleware
docs: update Memory Inspector section in implementation_plan
```

**Do not:**
- Batch unrelated changes in one commit
- Add `Co-authored-by: Claude` or any AI attribution
- Add `Signed-off-by` trailers
- Use emoji in commit messages

---

## Pull Requests

1. **Branch** from `main`. Name your branch `feat/<thing>`, `fix/<thing>`, or `refactor/<thing>`.
2. **Keep PRs small.** One feature or fix per PR. If you're refactoring, keep it separate from feature work.
3. **Type-check** — both `npx tsc --noEmit` passes must be clean before opening a PR.
4. **Describe the change** — what it does, why it's needed, and how to test it.
5. **Reference the spec** — if you're implementing something from `implementation_plan.md`, link to the relevant section.

### PR template

```
## What

Brief description of the change.

## Why

Why this change is needed — links to spec section, issue, or context.

## How to test

Steps to verify the change works end-to-end.
```

---

## Design System

The dashboard uses a strict design token system. All values must come from CSS custom properties — no hardcoded hex codes, font families, or spacing values.

### Key rules

- **Background:** Always `var(--color-bg)` (`#F8F7F4`). Never `#FFFFFF` or `white`.
- **Fonts:** Instrument Sans for all UI text. JetBrains Mono for code, IDs, timestamps. Never Inter, Roboto, or system-ui.
- **Icons:** Lucide React only. Size 16px (compact), 20px (default), 24px (section). Stroke-width 1.5.
- **Shadows:** Max `box-shadow: 0 1px 2px rgba(0,0,0,0.04)`. No generic drop shadows.
- **Gradients:** Teal-only (`--color-accent` to lighter teal). No purple, no rainbow.
- **Scroll:** Lenis for smooth scroll. GSAP ScrollTrigger for scroll-linked animations. Never `scroll-behavior: smooth`.
- **Animations:** Only animate `transform` and `opacity`. Never animate layout properties.

Full token reference is in [`CLAUDE.md`](./CLAUDE.md#color-tokens).
