# CLAUDE.md — AetherQA Development Guide

## Project Overview

AetherQA is an agentic QA system — a standalone Node.js/TypeScript service that uses a five-agent LangGraph pipeline, Mem0 memory, and Playwright browser automation to autonomously generate, run, and self-heal tests for web applications. It includes a React dashboard for human-in-the-loop review.

**Stack:** Node.js · TypeScript · LangGraph · Mem0 · Playwright · React (Vite) · Express · PostgreSQL

---

## Brand Guidelines

### Product Identity

- **Name:** AetherQA — always written as one word, capital A and QA
- **Tagline:** "Autonomous QA that learns."
- **Voice:** Technical, precise, confident. No marketing fluff. Speak like a senior engineer explaining something to a peer.
- **Personality:** Intelligent, reliable, surgical. Not playful, not corporate.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#F8F7F4` | Primary background (warm off-white) |
| `--color-surface` | `#FFFFFF` | Cards, panels, elevated surfaces |
| `--color-border` | `#E8E6E1` | Subtle borders, dividers |
| `--color-grid` | `#EDEBE6` | Background grid lines |
| `--color-text` | `#1A1A1A` | Primary text (near-black, not pure black) |
| `--color-text-sub` | `#6B6B6B` | Secondary/muted text |
| `--color-accent` | `#0A6E5C` | Primary accent — deep teal |
| `--color-accent-hover` | `#08594A` | Accent hover state |
| `--color-accent-light` | `#E6F5F1` | Accent tinted backgrounds |
| `--color-pass` | `#1A8C5E` | Test pass, success states |
| `--color-fail` | `#D93025` | Test fail, error states |
| `--color-warn` | `#E8A317` | Warnings, flaky tests |
| `--color-heal` | `#3B82F6` | Self-healed tests, AI actions |
| `--color-tag-bg` | `#F0EFEB` | Tag/badge backgrounds |

**Hard rules:**

- NO purple gradients anywhere. Ever.
- NO pure white (`#FFFFFF`) as page background — use `--color-bg` (`#F8F7F4`).
- NO generic drop shadows (`box-shadow: 0 2px 8px rgba(0,0,0,0.1)`). Use borders or subtle `box-shadow: 0 1px 2px rgba(0,0,0,0.04)` max.
- NO blue-to-purple or rainbow gradients. If a gradient is needed, use `--color-accent` to a slightly lighter teal.

### Typography

| Token | Font Family | Weight | Usage |
|---|---|---|---|
| `--font-display` | **Instrument Sans** | 600–700 | Hero headings, page titles |
| `--font-body` | **Instrument Sans** | 400 | Body text, paragraphs |
| `--font-mono` | **JetBrains Mono** | 400 | Code blocks, test output, IDs |

Load from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Hard rules:**

- DO NOT use Inter, Roboto, Open Sans, or system-ui as primary fonts.
- Headings: Instrument Sans at 600 or 700 weight.
- Body: Instrument Sans at 400 weight.
- Code/mono: JetBrains Mono only.

### Type Scale

```css
--text-xs:   0.75rem;   /* 12px — captions, badges */
--text-sm:   0.875rem;  /* 14px — secondary text, table cells */
--text-base: 1rem;      /* 16px — body text */
--text-lg:   1.125rem;  /* 18px — lead paragraphs */
--text-xl:   1.25rem;   /* 20px — section headings */
--text-2xl:  1.75rem;   /* 28px — page titles */
--text-3xl:  2.25rem;   /* 36px — hero subheading */
--text-4xl:  3.5rem;    /* 56px — hero heading */
--text-5xl:  4.5rem;    /* 72px — landing page hero */
```

### Spacing & Layout

- Base unit: 4px (0.25rem). All spacing is multiples of this.
- Page max-width: 1200px, centered with `margin: 0 auto`.
- Section padding: 80px 0 (desktop), 48px 0 (mobile).
- Card padding: 24px.
- Card border-radius: 12px.
- Button border-radius: 8px.
- Grid gap: 24px (cards), 16px (form elements).

### Grid Background Pattern

The landing page and dashboard use a subtle dot-grid or line-grid background:

```css
.grid-bg {
  background-image:
    linear-gradient(var(--color-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
  background-size: 64px 64px;
}
```

Do NOT use noisy textures, gradients as backgrounds, or parallax background images.

### Iconography

- Use Lucide React (`lucide-react`) for all icons.
- Icon size: 20px default, 16px in compact contexts, 24px for section icons.
- Icon stroke-width: 1.5 (the Lucide default).
- Never use Font Awesome, Material Icons, or emoji as icons.

---

## Scrolling Stack (MANDATORY)

All scroll behavior MUST use this exact stack. No exceptions.

### Required Libraries

```bash
npm install lenis gsap @gsap/react
```

### Initialization Pattern

```ts
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  lerp: 0.08,           // buttery, weighty feel
  smoothWheel: true,
});

// Feed Lenis RAF into GSAP ticker — keeps ScrollTrigger in sync
lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0); // disable GSAP lag smoothing
```

### What TO Use

- Lenis for ALL smooth scroll behavior.
- GSAP ScrollTrigger for ALL scroll-linked animations (fade-ins, parallax, pinning, scrub).
- `gsap.to()` / `gsap.from()` / `gsap.fromTo()` with ScrollTrigger for entrance animations.
- `will-change: transform` and `transform: translate3d()` / `opacity` for animated properties.

### What NOT To Use

| Banned | Why |
|---|---|
| `scroll-behavior: smooth` (CSS) | Conflicts with Lenis scroll ownership |
| `IntersectionObserver` for animations | Use ScrollTrigger instead — more precise |
| ScrollSmoother (GSAP plugin) | Conflicts with Lenis's scroll ownership |
| Locomotive Scroll | Redundant, deprecated in favor of Lenis |
| Animating `width`, `height`, `top`, `left`, `margin` | Causes layout thrash — animate `transform` and `opacity` only |
| `window.scrollTo({ behavior: 'smooth' })` | Use `lenis.scrollTo()` instead |
| Framer Motion `useScroll` | Use GSAP ScrollTrigger for consistency |

### Animation Defaults

```ts
// Entrance animation (fade up)
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

// Stagger children
gsap.from(".card", {
  y: 40,
  opacity: 0,
  duration: 0.6,
  stagger: 0.1,
  ease: "power2.out",
  scrollTrigger: {
    trigger: ".cards-container",
    start: "top 80%",
  },
});
```

---

## Tech Stack Reference

### Backend Service (root `/`)

| | |
|---|---|
| Runtime | Node.js + TypeScript |
| Orchestration | LangGraph (`@langchain/langgraph`) |
| LLM | Claude via `@langchain/anthropic` (use `claude-sonnet-4-6` for agents) |
| Memory | Mem0 (`mem0ai`) — 3 scopes: agent, session, user |
| Browser automation | Playwright |
| API | Express + cors + helmet + express-rate-limit |
| Database | PostgreSQL (results store + LangGraph checkpointer) |
| Validation | Zod for internal types, Ajv for API contract testing |
| GitHub integration | `@langchain/mcp-adapters` bridging GitHub MCP server |

### Dashboard (`/dashboard`)

| | |
|---|---|
| Framework | React + TypeScript (Vite) |
| Data fetching | `@tanstack/react-query` |
| Routing | `react-router-dom` |
| Icons | `lucide-react` |
| Scroll | Lenis + GSAP ScrollTrigger (see Scrolling Stack section) |

### Five-Agent Pipeline

| Agent | Name | Role |
|---|---|---|
| 0 | Scoper | Maps feature description to test scope |
| 1 | Explorer | Crawls app, builds accessibility context |
| 2 | Test Case | Generates human-readable Markdown specs |
| 3 | Automation | Writes + runs Playwright `.spec.ts` files |
| 4 | Maintenance | Self-heals broken tests, triages real bugs |
| 5 | API Tester | Runs in parallel — full backend API coverage |

### Run Modes

| Mode | Scoper | Explorer Scope | Human Review |
|---|---|---|---|
| `full` | No | All known routes | All specs |
| `smoke` | No | Critical flows (memory) | All specs |
| `feature` | Yes | Scoped + blast radius | Feature bucket only |

---

## Development Rules

### Git & Commits

- Commit after every feature. Do not batch multiple features into one commit.
- DO NOT add Claude as a co-author. No `Co-authored-by: Claude` in commit messages.
- DO NOT add `Signed-off-by` trailers unless explicitly asked.
- Commit messages: imperative mood, under 72 chars for the subject line. Example: `Add Explorer agent memory recall node`
- One logical change per commit. Refactors and features are separate commits.
- Never force-push to shared branches without explicit permission.

### Code Style

- TypeScript strict mode (`"strict": true` in tsconfig).
- Use `import` / `export` — no `require()`.
- Prefer `const` over `let`. Never use `var`.
- Use explicit return types on exported functions.
- No `any` unless interfacing with untyped third-party APIs (and comment why).
- Prefer named exports over default exports.
- Use Zod for runtime validation of external inputs (API requests, LLM outputs, Mem0 results).

### File Naming

- Agent graphs: `<name>.graph.ts` (e.g., `explorer.graph.ts`)
- Tools: `<name>.tools.ts` (e.g., `playwright.tools.ts`)
- Types: `<name>.types.ts` or co-located in the module
- Test specs (generated): `<id>-<title>.spec.ts` or `<id>-<title>.voice.spec.ts`
- Dashboard pages: PascalCase `<Name>.tsx` (e.g., `RunTrigger.tsx`)
- Dashboard components: PascalCase `<Name>.tsx`

### Testing

- Every generated test seeds its own data via `seedTestData()`.
- Tests use `storageState` for auth — never re-login in tests.
- Use Playwright locators: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. Never use CSS selectors or XPath.
- Never use `waitForTimeout` — use explicit waits (`waitForResponse`, `waitForSelector`, etc.).
- Voice tests: `.voice.spec.ts` suffix, `workers: 1` in Playwright config.
- API tests use `X-Test-Run: true` header for automatic DB rollback.

### Frontend (Dashboard + Landing)

- All scroll behavior via Lenis. No native `scroll-behavior: smooth`.
- All scroll-linked animations via GSAP ScrollTrigger. No `IntersectionObserver` for animations.
- Animate only `transform` and `opacity`. Never animate layout properties.
- Use CSS custom properties for all colors, fonts, and spacing.
- Mobile-first responsive design. Breakpoints: 640px, 768px, 1024px, 1200px.
- No inline styles except for truly dynamic values (e.g., progress bars).
- Use semantic HTML (`<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`).

---

## What NOT To Do

- DO NOT use Inter, Roboto, or system-ui as primary fonts.
- DO NOT use pure white (`#FFF`) as a page background.
- DO NOT use purple gradients.
- DO NOT use generic box-shadows.
- DO NOT use ScrollSmoother, Locomotive Scroll, or `IntersectionObserver` for scroll animations.
- DO NOT use `scroll-behavior: smooth` in CSS.
- DO NOT animate `width`, `height`, `top`, `left`, or `margin`.
- DO NOT add co-author attributions to commits.
- DO NOT use `waitForTimeout` in Playwright tests.
- DO NOT use CSS selectors or XPath in Playwright locators.
- DO NOT hardcode test data IDs — always use seeded fixtures.
- DO NOT use emoji in code, comments, or commit messages unless explicitly requested.

---

## Repository Structure

```
aetherqa/
├── src/
│   ├── agents/           # LangGraph agent subgraphs (.graph.ts)
│   ├── memory/           # Mem0 client, schemas, query keys
│   ├── tools/            # Playwright, voice, API, seeder, GitHub tools
│   ├── api/              # Express routes, SSE manager, middleware
│   ├── db/               # PostgreSQL schema
│   ├── orchestrator.graph.ts
│   ├── state.types.ts
│   └── config.ts
├── tests/
│   ├── generated/        # Agent 3 writes .spec.ts here
│   ├── specs/            # Agent 2 writes .md specs here
│   │   ├── feature/
│   │   └── regression/
│   ├── fixtures/         # Audio WAVs, seed data JSONs
│   └── .auth/            # Saved Playwright storageState per role
├── dashboard/            # React (Vite) dashboard app
│   └── src/
│       ├── pages/        # RunTrigger, SpecReview, RunMonitor, FailureTriage, MemoryInspector
│       └── components/
├── landing/              # Landing page (static HTML/CSS/JS)
├── docker-compose.yml
├── playwright.config.ts
├── CLAUDE.md             # This file
└── implementation_plan.md
```

---

## Environment Variables

Required in `.env` (see `.env.example`):

```
ANTHROPIC_API_KEY       — Claude API key
MEM0_API_KEY            — Mem0 API key
DATABASE_URL            — PostgreSQL connection string
DEFAULT_TARGET_URL      — Staging URL of the app under test
GITHUB_TOKEN            — Fine-grained PAT (contents:read only)
GITHUB_OWNER            — GitHub org/user
GITHUB_REPO             — App repository name
GITHUB_DEFAULT_BRANCH   — Branch agents read from (usually main or staging)
TEST_USER_EMAIL         — Test user credentials
TEST_USER_PASSWORD
TEST_ADMIN_EMAIL        — Test admin credentials
TEST_ADMIN_PASSWORD
DASHBOARD_SECRET        — Dashboard auth secret
```

Never commit `.env` files. Never log API keys.

---

## Quick Reference

```bash
# Start all services
docker compose up -d

# Run the service in dev mode
npx tsx src/index.ts

# Start dashboard in dev mode
cd dashboard && npm run dev

# Run generated tests manually
npx playwright test tests/generated/

# Run only voice tests
npx playwright test tests/generated/ --project voice-tests
```
