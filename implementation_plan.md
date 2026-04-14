# AetherQA - Agentic QA System — Complete Implementation Plan

**Stack:** Node.js / TypeScript SaaS · LangGraph · Mem0 · Playwright · React dashboard  
**Version:** 2.0 — covers all edge cases, voice/mic, backend API, scoped feature runs, multi-tenant SaaS architecture

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Memory Architecture (Mem0)](#4-memory-architecture-mem0)
5. [LangGraph State Machine](#5-langgraph-state-machine)
6. [Agent 1 — Explorer](#6-agent-1--explorer)
7. [Agent 2 — Test Case](#7-agent-2--test-case)
8. [Agent 3 — Automation](#8-agent-3--automation)
9. [Agent 4 — Maintenance](#9-agent-4--maintenance)
10. [Agent 5 — API Tester](#10-agent-5--api-tester)
11. [Agent 0 — Scoper (Feature Run Mode)](#11-agent-0--scoper-feature-run-mode)
12. [Frontend Edge Cases — Complete Handling](#12-frontend-edge-cases--complete-handling)
13. [Voice / Mic Input Testing](#13-voice--mic-input-testing)
14. [Backend API Testing — Full Coverage](#14-backend-api-testing--full-coverage)
15. [Test Data Management](#15-test-data-management)
16. [Express API Gateway](#16-express-api-gateway)
17. [React Dashboard](#17-react-dashboard)
18. [Run Modes](#18-run-modes)
19. [Docker & Deployment](#19-docker--deployment)
20. [Rollout Plan](#20-rollout-plan)
21. [What Your QA Team Does After This](#21-what-your-qa-team-does-after-this)
22. [GitHub Codebase Integration](#22-github-codebase-integration)
23. [SaaS Authentication & Authorization](#23-saas-authentication--authorization)
24. [Multi-Tenant Data Model](#24-multi-tenant-data-model)
25. [SaaS Dashboard — Auth & Org Pages](#25-saas-dashboard--auth--org-pages)
26. [SaaS Rollout Plan](#26-saas-rollout-plan)

---

## 1. System Overview

This is a fully standalone service — it has zero code dependency on your main backend. It only needs:

- Network access to your app's staging URL
- A test-mode Express endpoint (`/api/test/seed`) on your main backend
- An Anthropic API key
- A Mem0 API key (or self-hosted Mem0)

### The Five-Agent Pipeline

```
QA Dashboard (React)
       │  manual trigger / approve / triage
       ▼
Express API Gateway  ──SSE streaming──▶  Dashboard
       │
       ▼
LangGraph Orchestrator (StateGraph)
       │
       ├──▶ [0] Scoper        (feature runs only — maps blast radius)
       ├──▶ [1] Explorer      (crawls app, builds app context)
       ├──▶ [2] Test Case     (generates human-readable specs)
       │         │  ← HUMAN CHECKPOINT: QA approves specs
       ├──▶ [3] Automation    (writes & runs Playwright tests)
       ├──▶ [4] Maintenance   (self-heals broken tests, flags real bugs)
       └──▶ [5] API Tester    (runs in parallel — full backend coverage)
       │
       ▼
Mem0 Memory Layer (agent / session / user scopes)
       │
       ▼
Results Store (PostgreSQL)
       │
       ▼
QA Dashboard — results, triage, memory inspector
```

### What "Agentic" Means Here

- Each agent is a LangGraph `StateGraph` subgraph with its own nodes and edges
- Every agent reads from Mem0 before acting and writes back to Mem0 after acting
- The orchestrator uses conditional edges for the human-in-the-loop checkpoint
- The Maintenance agent attempts auto-healing before escalating to humans
- Memory compounds over runs — the system gets measurably smarter over time

---

## 2. Repository Structure

```
agentic-qa-service/
├── src/
│   ├── agents/
│   │   ├── scoper.graph.ts          # Agent 0 — feature scope resolver
│   │   ├── explorer.graph.ts        # Agent 1 — app crawler
│   │   ├── testcase.graph.ts        # Agent 2 — spec generator
│   │   ├── automation.graph.ts      # Agent 3 — test writer & runner
│   │   ├── maintenance.graph.ts     # Agent 4 — self-healer
│   │   └── api-tester.graph.ts      # Agent 5 — backend API tester
│   ├── memory/
│   │   ├── mem0.client.ts           # Typed Mem0 wrapper
│   │   ├── memory.schemas.ts        # What each scope stores
│   │   └── memory.keys.ts           # Canonical query strings
│   ├── tools/
│   │   ├── playwright.tools.ts      # Browser launch, auth, overlays
│   │   ├── voice.tools.ts           # Mic mock, audio injection, error stubs
│   │   ├── api.tools.ts             # HTTP client, schema validator, diff
│   │   ├── db-seeder.tools.ts       # Test data seed/cleanup
│   │   ├── scroll.tools.ts          # Lazy load, infinite scroll, virtual lists
│   │   ├── sse.tools.ts             # SSE streaming to dashboard
│   │   └── github.tools.ts          # Codebase access via GitHub MCP server
│   ├── api/
│   │   ├── routes.ts                # QA pipeline routes
│   │   ├── auth.routes.ts           # Login, register, OAuth, password reset
│   │   ├── org.routes.ts            # Organization CRUD, members, invites
│   │   ├── sse.ts                   # Server-sent events manager
│   │   └── middleware.ts            # Auth, org-scope, RBAC, error handling
│   ├── auth/
│   │   ├── jwt.ts                   # JWT sign/verify, refresh token rotation
│   │   ├── password.ts              # bcrypt hash/compare
│   │   ├── oauth.ts                 # Google + GitHub OAuth handlers
│   │   └── auth.types.ts            # AuthUser, JWTPayload, OAuthProfile types
│   ├── orchestrator.graph.ts        # Main StateGraph
│   ├── state.types.ts               # Shared TypeScript state types
│   └── config.ts                    # Env vars, constants
├── tests/
│   ├── generated/                   # Agent 3 writes here (.spec.ts)
│   ├── specs/                       # Agent 2 writes here (.md)
│   │   ├── feature/                 # New feature specs
│   │   └── regression/              # Blast-radius regression specs
│   ├── fixtures/
│   │   ├── audio/                   # WAV files for voice testing
│   │   │   ├── clear-english.wav
│   │   │   ├── accented-query.wav
│   │   │   ├── silence-3s.wav
│   │   │   ├── background-noise.wav
│   │   │   ├── very-long-utterance.wav
│   │   │   └── non-english.wav
│   │   └── db/                      # JSON seed data per scenario
│   └── .auth/                       # Saved storageState per role
│       ├── admin.json
│       ├── user.json
│       └── viewer.json
├── dashboard/                       # React dashboard (separate Vite app)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Register.tsx
│   │   │   │   ├── ForgotPassword.tsx
│   │   │   │   └── ResetPassword.tsx
│   │   │   ├── org/
│   │   │   │   ├── OrgSettings.tsx
│   │   │   │   ├── Members.tsx
│   │   │   │   └── OrgSwitcher.tsx
│   │   │   ├── RunTrigger.tsx
│   │   │   ├── SpecReview.tsx
│   │   │   ├── RunMonitor.tsx
│   │   │   ├── FailureTriage.tsx
│   │   │   └── MemoryInspector.tsx
│   │   ├── components/
│   │   └── lib/
│   │       ├── auth.ts              # JWT storage, refresh, auth context
│   │       └── api.ts               # Fetch wrapper with auth headers
│   └── package.json
├── docker-compose.yml
├── playwright.config.ts             # Generated dynamically per run
├── .env.example
└── package.json
```

---

## 3. Tech Stack & Dependencies

### Service Dependencies

```bash
# Core framework
npm install @langchain/langgraph @langchain/google-genai @langchain/core

# Memory
npm install mem0ai

# Browser automation
npm install playwright

# API
npm install express cors helmet express-rate-limit
npm install pg  # PostgreSQL for results store
npm install dotenv winston zod

# Authentication (SaaS)
npm install bcrypt jsonwebtoken       # Password hashing + JWT
npm install @types/bcrypt @types/jsonwebtoken  # (devDeps)
npm install nodemailer                # Transactional email (password reset, invites)

# Utilities
npm install ajv  # JSON schema validation for API contract testing
npm install uuid tsx typescript

# GitHub Codebase Integration
npm install @langchain/mcp-adapters   # Bridges GitHub MCP server → LangGraph tools
```

### Dashboard Dependencies

```bash
# Vite + React + TypeScript
npm create vite@latest dashboard -- --template react-ts

npm install @tanstack/react-query
npm install react-router-dom
npm install lucide-react
```

### Dev Dependencies

```bash
npm install -D @types/express @types/pg @types/node @playwright/test
```

### Environment Variables (`.env.example`)

```env
# Google AI Studio (Gemini)
GOOGLE_API_KEY=AIza...

# Mem0
MEM0_API_KEY=m0-...
# OR for self-hosted:
# MEM0_SELF_HOSTED_URL=http://localhost:8000

# Database (results store)
DATABASE_URL=postgresql://user:pass@localhost:5432/agentic_qa

# Service
PORT=4000
NODE_ENV=development  # or "test" or "production"

# App under test (set per run, or default here)
DEFAULT_TARGET_URL=https://staging.yourapp.com

# Test credentials (used by auth setup)
TEST_USER_EMAIL=qa-test@yourapp.com
TEST_USER_PASSWORD=...
TEST_ADMIN_EMAIL=qa-admin@yourapp.com
TEST_ADMIN_PASSWORD=...
TEST_TOTP_SECRET=...  # for MFA flows

# SaaS Authentication
JWT_SECRET=...                         # 256-bit secret for signing access tokens
JWT_REFRESH_SECRET=...                 # Separate secret for refresh tokens
JWT_ACCESS_EXPIRY=15m                  # Short-lived access tokens
JWT_REFRESH_EXPIRY=7d                  # Refresh tokens last 7 days

# OAuth Providers (optional — email/password works without these)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
OAUTH_CALLBACK_URL=https://app.aetherqa.dev/auth/callback

# Transactional Email (password reset, invite emails)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_...
EMAIL_FROM=AetherQA <noreply@aetherqa.dev>

# Legacy dashboard auth (deprecated — replaced by JWT auth)
DASHBOARD_SECRET=...

# GitHub Codebase Integration (read-only access to app source repo)
GITHUB_TOKEN=ghp_...           # Fine-grained PAT: contents:read only
GITHUB_OWNER=your-org
GITHUB_REPO=your-app-repo
GITHUB_DEFAULT_BRANCH=main     # Branch agents read from (typically staging branch)
```

---

## 4. Memory Architecture (Mem0)

Memory is the core differentiator. Three scopes, each with explicit contracts for what gets stored.

### Scope Design

```typescript
// src/memory/mem0.client.ts
import { MemoryClient } from "mem0ai";

const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
const AGENT_ID = "agentic-qa-system";

export const agentMemory = {
  async recall(query: string) {
    const res = await mem0.search(query, { agent_id: AGENT_ID, limit: 10 });
    return res.results.map((r: any) => r.memory).join("\n");
  },
  async learn(fact: string) {
    return mem0.add([{ role: "system", content: fact }], {
      agent_id: AGENT_ID,
    });
  },
  async forget(memoryId: string) {
    return mem0.delete(memoryId);
  },
};

export const sessionMemory = {
  async recall(query: string, runId: string) {
    const res = await mem0.search(query, { run_id: runId, limit: 5 });
    return res.results.map((r: any) => r.memory).join("\n");
  },
  async save(content: string, runId: string) {
    return mem0.add([{ role: "assistant", content }], { run_id: runId });
  },
};

export const userMemory = {
  async recall(query: string, userId: string) {
    const res = await mem0.search(query, { user_id: userId, limit: 5 });
    return res.results.map((r: any) => r.memory).join("\n");
  },
  async save(content: string, userId: string) {
    return mem0.add([{ role: "user", content }], { user_id: userId });
  },
};
```

### What Each Agent Stores and Recalls

```typescript
// src/memory/memory.schemas.ts

// AGENT scope — permanent system knowledge, never expires
export const AGENT_MEMORY_WRITES = {
  explorer: [
    "Known user flows in the app",
    "Overlay patterns (cookie banners, modals, banners)",
    "Auth patterns and redirect URLs",
    "Known fixture IDs for dynamic routes (e.g. /lessons/:id → lesson_42)",
    "Lazy-loaded routes and their scroll triggers",
    "WebSocket / SSE endpoints",
  ],
  testcase: [
    "Approved spec patterns and formats QA prefers",
    "Rejected spec examples and why they were rejected",
    "Flows that always need human review",
    "Blast-radius relationships between modules",
  ],
  automation: [
    "Selector strategies that reliably work",
    "Auth setup steps that are stable",
    "Tests that failed on first generation and why",
    "Voice test fixture → expected outcome mapping",
  ],
  maintenance: [
    "Elements that frequently change between deploys",
    "Successful self-heal patterns",
    "Failures that turned out to be real bugs (never auto-heal these)",
    "Flaky test patterns — tests that pass/fail non-deterministically",
  ],
  apiTester: [
    "Full OpenAPI spec snapshot (for diffing)",
    "Endpoints known to return 500 on certain inputs",
    "Auth scopes required per endpoint",
    "Async endpoints and their expected webhook/side-effect patterns",
  ],
};

// SESSION scope — per run-id, cleaned up after run completes
export const SESSION_MEMORY_WRITES = {
  explorer: "Accessibility snapshot of each scoped route this run",
  scoper: "Feature scope JSON — routes, blast radius, skip list",
  automation: "Which tests passed/failed this run",
  apiTester: "OpenAPI diff result this run",
};

// USER scope — per QA engineer, persists indefinitely
export const USER_MEMORY_WRITES = {
  preferences: "Formatting preferences, BDD vs TDD style",
  alwaysReview: "Flows this QA always wants to manually sign off",
  alwaysRunRegression: "Specific regression suites that must always run",
};
```

---

## 5. LangGraph State Machine

### Shared State Type

```typescript
// src/state.types.ts
import { Annotation } from "@langchain/langgraph";

export const QARunState = Annotation.Root({
  // Run identity
  runId: Annotation<string>(),
  runMode: Annotation<"full" | "smoke" | "feature">(),
  targetUrl: Annotation<string>(),
  qaUserId: Annotation<string>(),

  // Feature scope (feature mode only)
  featureDescription: Annotation<string | null>(),
  scope: Annotation<FeatureScope | null>(),

  // Agent outputs (flow through pipeline)
  appContext: Annotation<Record<string, RouteContext> | null>(),
  testSpecs: Annotation<TestSpec[] | null>(),
  approvedSpecs: Annotation<TestSpec[] | null>(),
  generatedTests: Annotation<GeneratedTest[] | null>(),
  testResults: Annotation<TestResult[] | null>(),
  apiTestResults: Annotation<ApiTestResult[] | null>(),
  healedTests: Annotation<HealedTest[] | null>(),
  escalations: Annotation<Escalation[] | null>(),

  // Memory context (injected at each node)
  agentMemory: Annotation<string>(),
  sessionMemory: Annotation<string>(),
  userMemory: Annotation<string>(),

  // Codebase context (populated by GitHub integration, used by agents)
  codebaseContext: Annotation<CodebaseContext | null>(),

  // Human gate
  specsApproved: Annotation<boolean>(),

  // Control
  currentAgent: Annotation<string>(),
  errors: Annotation<string[]>(),
  startedAt: Annotation<string>(),
});

export type QARunStateType = typeof QARunState.State;

export interface FeatureScope {
  directScope: {
    routes: string[];
    apiEndpoints: string[];
    components: string[];
    testTypes: Array<"UI" | "voice" | "API">;
  };
  blastRadius: {
    routes: string[];
    reason: string;
    riskLevel: "low" | "medium" | "high";
  };
  skip: string[];
}

export interface TestSpec {
  id: string;
  title: string;
  module: string;
  bucket: "feature" | "regression";
  content: string; // Markdown
  testTypes: string[]; // ["UI", "voice", "API"]
  autoApproved: boolean; // true for regression bucket
}

export interface TestResult {
  specId: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  screenshotPath?: string;
  errorMessage?: string;
  failureTrace?: string;
}
```

### Main Orchestrator Graph

```typescript
// src/orchestrator.graph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { QARunState } from "./state.types";
import { runScoper } from "./agents/scoper.graph";
import { runExplorer } from "./agents/explorer.graph";
import { runTestCase } from "./agents/testcase.graph";
import { runAutomation } from "./agents/automation.graph";
import { runMaintenance } from "./agents/maintenance.graph";
import { runApiTester } from "./agents/api-tester.graph";

const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);

const graph = new StateGraph(QARunState)
  // Scoper runs only in feature mode
  .addNode("scoper", runScoper)
  .addNode("explorer", runExplorer)
  .addNode("testcase", runTestCase)
  .addNode("automation", runAutomation)
  .addNode("apiTester", runApiTester)
  .addNode("maintenance", runMaintenance)

  // Entry: feature mode goes through scoper first
  .addConditionalEdges(START, (state) =>
    state.runMode === "feature" ? "scoper" : "explorer",
  )
  .addEdge("scoper", "explorer")
  .addEdge("explorer", "testcase")

  // HUMAN CHECKPOINT: graph suspends until specsApproved = true
  .addConditionalEdges("testcase", (state) =>
    state.specsApproved ? "automation" : "__end__",
  )

  // API tester runs in parallel from START (not after explorer)
  .addEdge(START, "apiTester")

  // Both branches feed into maintenance for unified reporting
  .addEdge("automation", "maintenance")
  .addEdge("apiTester", "maintenance")
  .addEdge("maintenance", END);

export const qaGraph = graph.compile({ checkpointer });
```

---

## 6. Agent 1 — Explorer

### Responsibilities

- Launch headless browser with auth state
- Dismiss overlays before crawling
- Intercept API calls made by the React app
- Capture accessibility tree per scoped route
- Detect special flow types (voice, file upload, WebSocket)
- Write findings to Mem0

### Full Implementation

```typescript
// src/agents/explorer.graph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { chromium, Page } from "playwright";
import { agentMemory, sessionMemory } from "../memory/mem0.client";
import { dismissOverlays } from "../tools/playwright.tools";
import { QARunStateType } from "../state.types";

const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.5-pro", maxOutputTokens: 4000 });

async function recallMemory(state: QARunStateType) {
  const memory = await agentMemory.recall(
    "known user flows overlay patterns auth patterns fixture IDs lazy load routes",
  );
  return { agentMemory: memory };
}

async function browseApp(state: QARunStateType) {
  const routes =
    state.scope?.directScope.routes ??
    (await inferRoutesFromMemory(state.agentMemory));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: "tests/.auth/user.json",
  });

  const routeContexts: Record<string, any> = {};

  for (const route of routes) {
    const resolvedRoute = resolveRouteParams(route, state.agentMemory);
    const page = await context.newPage();
    const apiCalls: string[] = [];
    const wsUrls: string[] = [];

    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        apiCalls.push(`${req.method()} ${new URL(req.url()).pathname}`);
      }
    });
    page.on("websocket", (ws) => wsUrls.push(ws.url()));

    await page.goto(`${state.targetUrl}${resolvedRoute}`);
    await page.waitForLoadState("networkidle");
    await dismissOverlays(page, state.agentMemory);

    const accessibilityTree = await page.accessibility.snapshot();
    const screenshotPath = `runs/${state.runId}/${route.replace(/\//g, "_")}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    routeContexts[route] = {
      accessibilityTree,
      apiCalls: [...new Set(apiCalls)],
      webSockets: wsUrls,
      screenshotPath,
      // Detect special flow types
      hasVoiceInput: await detectVoiceInput(page),
      hasFileUpload: await detectFileUpload(page),
      hasInfiniteScroll: await detectInfiniteScroll(page),
    };

    await page.close();
  }

  await browser.close();
  return { rawBrowserData: routeContexts };
}

async function interpretContext(state: QARunStateType) {
  const response = await llm.invoke([
    {
      role: "system",
      content: `You map React app structures to named user flows for QA test generation.
              From memory: ${state.agentMemory}
              Output: JSON array of user flows with steps, inputs, expected outcomes, and special types.`,
    },
    {
      role: "user",
      content: `Map these routes to user flows:
              ${JSON.stringify(state.rawBrowserData, null, 2)}
              
              For each route, produce:
              {
                "route": "/path",
                "flows": [{ "name": "...", "steps": [...], "expected": "...", "type": "UI|voice|fileUpload" }],
                "apiDependencies": ["GET /api/..."],
                "specialFeatures": ["voice", "infiniteScroll", "webSocket"]
              }`,
    },
  ]);

  const appContext = JSON.parse(response.content as string);

  // Save durable facts to Mem0
  for (const [route, ctx] of Object.entries(appContext)) {
    await agentMemory.learn(
      `Route ${route} has flows: ${JSON.stringify((ctx as any).flows.map((f: any) => f.name))}`,
    );
    if ((ctx as any).specialFeatures?.includes("voice")) {
      await agentMemory.learn(
        `Route ${route} has voice input — requires mic mock or audio injection`,
      );
    }
  }

  await sessionMemory.save(
    `Explored routes: ${JSON.stringify(Object.keys(appContext))}`,
    state.runId,
  );
  return { appContext };
}

// Detect helper functions
async function detectVoiceInput(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const hasMicButton = !!document.querySelector(
      '[aria-label*="mic"], [aria-label*="voice"], [aria-label*="speak"]',
    );
    const hasWebSpeech =
      typeof (window as any).SpeechRecognition !== "undefined" ||
      typeof (window as any).webkitSpeechRecognition !== "undefined";
    return hasMicButton || hasWebSpeech;
  });
}

async function detectFileUpload(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.querySelector('input[type="file"]'));
}

async function detectInfiniteScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const bodyHeight = document.body.scrollHeight;
    return bodyHeight > window.innerHeight * 3;
  });
}

function resolveRouteParams(route: string, memory: string): string {
  // Replace :id, :lessonId etc. with known fixture values from memory
  const knownIds: Record<string, string> = {};
  const matches = memory.match(/route param :(\w+) → (\w+)/g) || [];
  for (const m of matches) {
    const [, param, value] = m.match(/route param :(\w+) → (\w+)/) || [];
    if (param) knownIds[param] = value;
  }
  return route.replace(/:(\w+)/g, (_, param) => knownIds[param] || "1");
}

async function inferRoutesFromMemory(memory: string): Promise<string[]> {
  // In full regression mode, extract all known routes from agent memory
  const matches = memory.match(/Route (\/\S+) has flows/g) || [];
  return matches.map((m) => m.replace("Route ", "").replace(" has flows", ""));
}

async function enrichWithCodebase(state: QARunStateType) {
  // Use GitHub MCP to read the React Router config — discovers routes Explorer may have missed
  // (routes not yet linked in UI, feature-flagged routes, lazy-loaded routes)
  const ghTools = await getGithubTools();
  const getFileContents = ghTools.find((t) => t.name === "get_file_contents");
  const searchCode = ghTools.find((t) => t.name === "search_code");

  if (!getFileContents) return {}; // GitHub integration not configured — skip

  // Find the router config file
  const routerSearch = await searchCode?.invoke({
    q: `repo:${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO} createBrowserRouter Routes filename:*.tsx`,
  });

  const routerFile = routerSearch?.items?.[0]?.path;
  let routerSource = "";

  if (routerFile) {
    const result = await getFileContents?.invoke({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: routerFile,
    });
    routerSource = result?.content
      ? Buffer.from(result.content, "base64").toString("utf-8")
      : "";
  }

  // Save router source to codebase context for Test Case agent to use
  const codebaseContext = {
    routerSource,
    routerFile,
    fetchedAt: new Date().toISOString(),
  };

  // Store so LLM can find routes not yet visible in the running app
  await agentMemory.learn(
    `Codebase router file: ${routerFile} — contains all registered routes including feature-flagged ones`,
  );

  return { codebaseContext };
}

const explorerGraph = new StateGraph(QARunStateType as any)
  .addNode("recallMemory", recallMemory)
  .addNode("browseApp", browseApp)
  .addNode("enrichWithCodebase", enrichWithCodebase) // NEW node
  .addNode("interpretContext", interpretContext)
  .addEdge(START, "recallMemory")
  .addEdge("recallMemory", "browseApp")
  .addEdge("browseApp", "enrichWithCodebase") // NEW edge
  .addEdge("enrichWithCodebase", "interpretContext")
  .addEdge("interpretContext", END);

export const runExplorer = explorerGraph.compile();
```

---

## 7. Agent 2 — Test Case

### Responsibilities

- Take app context from Explorer
- Generate human-readable Markdown specs (NOT code yet)
- Split into `feature` bucket and `regression` bucket
- Tag voice/API/UI type per spec
- Write spec files to `tests/specs/`
- Suspend graph for human review

### Full Implementation

```typescript
// src/agents/testcase.graph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { agentMemory, userMemory } from "../memory/mem0.client";
import * as fs from "fs/promises";
import * as path from "path";
import { QARunStateType, TestSpec } from "../state.types";

const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.5-pro", maxOutputTokens: 6000 });

async function recallPreferences(state: QARunStateType) {
  const [agentCtx, userCtx] = await Promise.all([
    agentMemory.recall(
      "approved spec patterns rejected spec examples blast radius relationships",
    ),
    userMemory.recall(
      "formatting preferences always review flows",
      state.qaUserId,
    ),
  ]);
  return { agentMemory: agentCtx, userMemory: userCtx };
}

async function fetchValidationLogic(state: QARunStateType) {
  // Read Zod schemas, Yup validators, or plain validation functions from source
  // This gives the spec generator access to real validation rules — not inferred from DOM
  const ghTools = await getGithubTools();
  const searchCode = ghTools.find((t) => t.name === "search_code");
  const getFileContents = ghTools.find((t) => t.name === "get_file_contents");

  if (!searchCode || !getFileContents) return {};

  // Find validation schema files relevant to the scoped routes
  const schemaSearch = await searchCode.invoke({
    q: `repo:${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO} z.object schema validation filename:*.ts`,
  });

  const schemaFiles = (schemaSearch?.items ?? []).slice(0, 5); // cap at 5 files
  const schemas: Record<string, string> = {};

  for (const file of schemaFiles) {
    const result = await getFileContents.invoke({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      path: file.path,
    });
    if (result?.content) {
      schemas[file.path] = Buffer.from(result.content, "base64").toString(
        "utf-8",
      );
    }
  }

  return {
    codebaseContext: {
      ...state.codebaseContext,
      validationSchemas: schemas,
    },
  };
}

async function generateSpecs(state: QARunStateType) {
  const scope = state.scope;

  // Build codebase context injection for the prompt
  const codebaseSection = state.codebaseContext?.validationSchemas
    ? `\n\nActual validation schemas from source code:\n${Object.entries(
        state.codebaseContext.validationSchemas,
      )
        .map(([file, src]) => `// ${file}\n${src}`)
        .join("\n\n---\n\n")}
      
      IMPORTANT: Generate edge cases based on THESE actual schema constraints — not inferred from the DOM.
      For example: if a field is z.string().min(3).max(50), generate tests for len=2, len=3, len=50, len=51.`
    : "";

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a QA spec writer. You write clear, human-reviewable test specifications.
              Follow this format strictly:

              # [Test Title]
              **Module:** [module name]
              **Bucket:** feature | regression  
              **Type:** UI | voice | API | UI+API
              **Priority:** critical | high | medium | low
              
              ## Preconditions
              - [what must be true before test starts]
              
              ## Steps
              1. [action]
              2. [action]
              
              ## Expected outcomes
              - [what should happen]
              
              ## Edge cases to cover in this spec
              - [list of variations]

              From previous runs you know:
              ${state.agentMemory}
              
              User preferences: ${state.userMemory}
              ${codebaseSection}`,
    },
    {
      role: "user",
      content: `Generate comprehensive test specs for:
              
              App context: ${JSON.stringify(state.appContext, null, 2)}
              ${scope ? `Feature scope: ${JSON.stringify(scope, null, 2)}` : ""}
              
              Rules:
              - Scoped routes → "feature" bucket
              - Blast radius routes → "regression" bucket (mark autoApproved: true)
              - If route has voice → generate separate voice error state specs
              - Every form must have: happy path + all required fields missing + invalid types
              - Every auth-protected route must have: unauthorized + wrong role specs
              
              Output as JSON array of TestSpec objects.`,
    },
  ]);

  const specs: TestSpec[] = JSON.parse(response.content as string);

  // Write spec files to disk
  for (const spec of specs) {
    const dir = `tests/specs/${spec.bucket}`;
    await fs.mkdir(dir, { recursive: true });
    const filename = `${spec.id}-${spec.title.toLowerCase().replace(/\s+/g, "-")}.md`;
    await fs.writeFile(path.join(dir, filename), spec.content);
  }

  // Save spec patterns to Mem0 for future reference
  await agentMemory.learn(
    `Generated ${specs.length} specs: ${specs.map((s) => s.title).join(", ")}`,
  );

  return { testSpecs: specs, specsApproved: false }; // false → triggers human gate
}

const testCaseGraph = new StateGraph(QARunStateType as any)
  .addNode("recallPreferences", recallPreferences)
  .addNode("fetchValidationLogic", fetchValidationLogic) // NEW node
  .addNode("generateSpecs", generateSpecs)
  .addEdge(START, "recallPreferences")
  .addEdge("recallPreferences", "fetchValidationLogic") // NEW edge
  .addEdge("fetchValidationLogic", "generateSpecs")
  .addEdge("generateSpecs", END);

export const runTestCase = testCaseGraph.compile();
```

---

## 8. Agent 3 — Automation

### Responsibilities

- Take approved specs and generate executable Playwright `.spec.ts` files
- Detect spec type (voice, API, UI) and use correct test template
- Execute tests immediately after generation
- Stream results via SSE to dashboard
- Tag voice tests for sequential worker

### Playwright Config (generated per run)

```typescript
// Generated dynamically at run time: playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/generated",
  fullyParallel: false,
  retries: 1,
  reporter: [["json", { outputFile: `runs/${RUN_ID}/results.json` }]],
  use: {
    baseURL: TARGET_URL,
    storageState: "tests/.auth/user.json",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "voice-tests",
      testMatch: "**/*.voice.spec.ts",
      workers: 1, // MUST be 1 — audio file ref is set at init
      use: {
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
    {
      name: "ui-tests",
      testIgnore: "**/*.voice.spec.ts",
      workers: 4,
    },
  ],
});
```

### Code Generation Strategy

```typescript
// src/agents/automation.graph.ts — core generation node

async function generateTestCode(state: QARunStateType) {
  const codeResults: GeneratedTest[] = [];

  for (const spec of state.approvedSpecs!) {
    // Choose template based on spec type
    const systemPrompt = spec.testTypes.includes("voice")
      ? VOICE_TEST_SYSTEM_PROMPT
      : spec.testTypes.includes("API")
        ? API_TEST_SYSTEM_PROMPT
        : UI_TEST_SYSTEM_PROMPT;

    const response = await llm.invoke([
      {
        role: "system",
        content: systemPrompt + `\nApp memory: ${state.agentMemory}`,
      },
      {
        role: "user",
        content: `Write a Playwright TypeScript test for this spec:\n${spec.content}`,
      },
    ]);

    const code = extractCodeBlock(response.content as string);
    const filename = `${spec.id}-${spec.title.toLowerCase().replace(/\s+/g, "-")}${spec.testTypes.includes("voice") ? ".voice" : ""}.spec.ts`;
    const filepath = `tests/generated/${filename}`;

    await fs.writeFile(filepath, code);
    codeResults.push({ specId: spec.id, filepath, code });
  }

  return { generatedTests: codeResults };
}

// UI test system prompt
const UI_TEST_SYSTEM_PROMPT = `You write Playwright TypeScript tests.
RULES:
- Use ONLY getByRole, getByLabel, getByText, getByPlaceholder, getByTestId locators
- NEVER use CSS selectors, XPath, or nth-child
- Always waitForResponse on the triggered API call after form submissions
- Never use waitForTimeout — use explicit waits
- Each test must be fully isolated — call seedTestData() at the start
- Use storageState for auth — never re-login
- Import: import { test, expect } from "@playwright/test"
- Import: import { seedTestData, dismissOverlays } from "../tools"`;

// Voice test system prompt
const VOICE_TEST_SYSTEM_PROMPT = `You write Playwright TypeScript voice tests.
RULES:
- Always inject speech mock via injectSpeechMock() BEFORE page.goto()
- Import voice tools: import { injectSpeechMock, injectSpeechErrorMock } from "../tools/voice.tools"
- Generate separate test cases for: happy path, no-speech error, not-allowed error, aborted
- Add a describe block for each error type
- Tests are tagged .voice.spec.ts — will run with workers: 1
- Never use parallel execution within voice test files`;

// API test system prompt
const API_TEST_SYSTEM_PROMPT = `You write Supertest-style API tests against an Express backend.
RULES:
- Use native fetch or node:http — no browser
- Every test must include: happy path, missing required fields, wrong types, auth failure (401), wrong role (403)
- Use X-Test-Run: true header on all requests (triggers DB transaction rollback)
- Assert response body shape using ajv schema validation
- For async endpoints, use waitForWebhook() helper
- Import: import { apiRequest, waitForWebhook, validateSchema } from "../tools/api.tools"`;
```

---

## 9. Agent 4 — Maintenance

### Decision Tree

```
Test result arrives
       │
       ├── PASS → record in Mem0, done
       │
       └── FAIL
             │
             ├── Is this a known real bug? (check Mem0)
             │         └── YES → surface to human immediately, skip heal attempt
             │
             ├── Is confidence of fix > 70%? (LLM assesses)
             │         └── YES → apply fix, re-run test, if passes → save to Mem0
             │         └── NO  → escalate to human with AI diagnosis
             │
             └── Is this flaky? (passed in last 3 runs, fails now)
                       └── YES → mark as flaky in Mem0, quarantine from main suite
```

```typescript
// src/agents/maintenance.graph.ts

async function triageFailure(state: QARunStateType) {
  const failures = state.testResults?.filter((r) => r.status === "fail") ?? [];
  const triaged: TriagedFailure[] = [];

  for (const failure of failures) {
    // Check if Mem0 knows this is a real bug
    const knownBug = await agentMemory.recall(
      `known bug ${failure.errorMessage?.substring(0, 100)}`,
    );

    if (knownBug.includes("real bug")) {
      triaged.push({
        ...failure,
        action: "escalate",
        reason: "Known real bug from memory",
      });
      continue;
    }

    // Ask LLM to assess healability
    const assessment = await llm.invoke([
      {
        role: "system",
        content: `You assess whether a Playwright test failure is a selector/locator issue 
                (self-healable) or a real application bug (requires human).
                Output JSON: { "type": "selector|logic|network|realBug", "confidence": 0-100, "explanation": "..." }`,
      },
      {
        role: "user",
        content: `Failed test: ${failure.specId}
                Error: ${failure.errorMessage}
                Trace: ${failure.failureTrace}`,
      },
    ]);

    const { type, confidence, explanation } = JSON.parse(
      assessment.content as string,
    );

    if (type === "selector" && confidence >= 70) {
      triaged.push({ ...failure, action: "heal", confidence, explanation });
    } else if (type === "realBug" || confidence < 40) {
      triaged.push({ ...failure, action: "escalate", confidence, explanation });
      // Remember this so future runs don't waste time trying to heal it
      await agentMemory.learn(
        `Real bug: ${failure.errorMessage?.substring(0, 200)} — escalate always`,
      );
    } else {
      triaged.push({
        ...failure,
        action: "escalate-uncertain",
        confidence,
        explanation,
      });
    }
  }

  return { triaged };
}

async function healSelectors(state: QARunStateType) {
  const toHeal = state.triaged?.filter((f) => f.action === "heal") ?? [];
  const ghTools = await getGithubTools();
  const getFileContents = ghTools.find((t) => t.name === "get_file_contents");

  for (const failure of toHeal) {
    const originalCode = await fs.readFile(failure.filepath, "utf-8");

    // Fetch current accessibility snapshot to find updated selectors
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${state.targetUrl}${failure.route}`);
    const currentSnapshot = await page.accessibility.snapshot();
    await browser.close();

    // NEW: Also fetch the React component source for this route from GitHub
    // This gives the LLM the ground truth on what the new selector should be
    // (testid attributes, aria-labels, role names) — far more reliable than DOM snapshots
    let componentSource = "";
    if (getFileContents && failure.componentPath) {
      const result = await getFileContents.invoke({
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        path: failure.componentPath,
      });
      if (result?.content) {
        componentSource = Buffer.from(result.content, "base64").toString(
          "utf-8",
        );
      }
    }

    const healResponse = await llm.invoke([
      {
        role: "system",
        content: `You fix broken Playwright selectors. 
                Only change selectors — never change test logic or assertions.
                Prefer data-testid attributes over CSS selectors. Prefer getByRole over getByText.
                Output: { "fixedCode": "...", "changesExplained": "...", "componentPath": "..." }`,
      },
      {
        role: "user",
        content: `Broken test:\n${originalCode}
                \nError:\n${failure.errorMessage}
                \nCurrent DOM snapshot:\n${JSON.stringify(currentSnapshot)}
                ${componentSource ? `\nReact component source (ground truth):\n${componentSource}` : ""}
                
                If the component source is available, prefer selectors derived directly from it
                (e.g. data-testid="submit-button" in JSX → getByTestId("submit-button") in test).`,
      },
    ]);

    const { fixedCode, changesExplained, componentPath } = JSON.parse(
      healResponse.content as string,
    );

    // Store the component path so next failure for this test uses it directly
    if (componentPath) {
      failure.componentPath = componentPath;
      await agentMemory.learn(
        `Component path for ${failure.specId}: ${componentPath}`,
      );
    }

    // Write the healed test
    await fs.writeFile(failure.filepath, fixedCode);

    // Re-run to verify the fix actually works
    const reRunResult = await executeTest(failure.filepath, state.targetUrl);

    if (reRunResult.status === "pass") {
      await agentMemory.learn(
        `Self-healed: ${failure.specId} — ${changesExplained}`,
      );
    } else {
      // Healing didn't work — escalate
      failure.action = "escalate";
      failure.healAttempted = true;
      failure.healExplanation = changesExplained;
    }
  }

  return { healedTests: toHeal };
}
```

---

## 10. Agent 5 — API Tester

### Responsibilities

- Fetch OpenAPI spec from `/api-docs/swagger.json`
- Diff against last known spec (stored in Mem0)
- Generate and run tests for: contract, auth, input validation, state isolation, async side effects
- Run in parallel with the frontend agents

### OpenAPI Diff + Contract Testing

```typescript
// src/agents/api-tester.graph.ts

async function fetchAndDiffSpec(state: QARunStateType) {
  const res = await fetch(`${state.targetUrl}/api-docs/swagger.json`);
  const currentSpec = await res.json();

  const lastSpecJson = await agentMemory.recall(
    "OpenAPI spec snapshot last run",
  );
  const lastSpec = lastSpecJson ? JSON.parse(lastSpecJson) : null;

  const diff = lastSpec
    ? computeSpecDiff(lastSpec, currentSpec)
    : { type: "first-run", changes: [] };

  await agentMemory.learn(
    `OpenAPI spec snapshot last run: ${JSON.stringify(currentSpec)}`,
  );

  return { currentSpec, specDiff: diff, specChanged: diff.changes.length > 0 };
}

async function generateApiTests(state: QARunStateType) {
  const { currentSpec, specDiff } = state;
  const tests: ApiTest[] = [];

  // Determine which endpoints to test
  const endpointsToTest = state.specChanged
    ? specDiff.changes.map((c: any) => c.endpoint) // only changed endpoints
    : getAllEndpoints(currentSpec); // full regression

  for (const endpoint of endpointsToTest) {
    const schema = getEndpointSchema(currentSpec, endpoint);

    tests.push(...generateContractTests(endpoint, schema));
    tests.push(...generateAuthTests(endpoint, schema));
    tests.push(...generateInputValidationTests(endpoint, schema));
    tests.push(...generateEdgeCaseTests(endpoint, schema));
  }

  return { apiTests: tests };
}

function generateInputValidationTests(
  endpoint: string,
  schema: any,
): ApiTest[] {
  const { method, path: routePath, requestBody } = schema;
  const tests: ApiTest[] = [];

  if (!requestBody) return tests;

  const bodySchema = requestBody.content["application/json"].schema;
  const requiredFields = bodySchema.required || [];
  const properties = bodySchema.properties || {};

  // For every field, generate the full mutation gauntlet
  for (const [field, fieldSchema] of Object.entries(properties) as any) {
    const mutations = [
      { name: `missing ${field}`, body: omit(validBody, field), expect: 400 },
      {
        name: `null ${field}`,
        body: { ...validBody, [field]: null },
        expect: 400,
      },
      {
        name: `empty string ${field}`,
        body: { ...validBody, [field]: "" },
        expect: 400,
      },
      {
        name: `wrong type for ${field}`,
        body: { ...validBody, [field]: generateWrongType(fieldSchema) },
        expect: 400,
      },
      {
        name: `SQL injection ${field}`,
        body: { ...validBody, [field]: "'; DROP TABLE users;--" },
        expect: 400,
      },
      {
        name: `XSS ${field}`,
        body: { ...validBody, [field]: "<script>alert(1)</script>" },
        expect: 400,
      },
      {
        name: `oversized ${field}`,
        body: { ...validBody, [field]: "a".repeat(10001) },
        expect: 400,
      },
      {
        name: `unicode ${field}`,
        body: { ...validBody, [field]: "💥\u0000𝔘" },
        expect: [200, 400],
      },
    ];

    if (requiredFields.includes(field)) {
      tests.push(
        ...mutations.map((m) => ({
          method,
          path: routePath,
          testName: `${method} ${routePath} — ${m.name}`,
          requestBody: m.body,
          expectedStatus: m.expect,
          headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
        })),
      );
    }
  }

  return tests;
}

// Auth boundary tests — generated for every protected endpoint
function generateAuthTests(endpoint: string, schema: any): ApiTest[] {
  const { method, path: routePath, security } = schema;
  if (!security || security.length === 0) return [];

  return [
    {
      testName: `${method} ${routePath} — no token → 401`,
      method,
      path: routePath,
      headers: { "Content-Type": "application/json", "X-Test-Run": "true" },
      // No Authorization header
      expectedStatus: 401,
    },
    {
      testName: `${method} ${routePath} — expired token → 401`,
      method,
      path: routePath,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${EXPIRED_TEST_TOKEN}`,
        "X-Test-Run": "true",
      },
      expectedStatus: 401,
    },
    {
      testName: `${method} ${routePath} — wrong role → 403`,
      method,
      path: routePath,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VIEWER_TOKEN}`, // lowest privilege role
        "X-Test-Run": "true",
      },
      expectedStatus: 403,
    },
  ];
}
```

---

## 11. Agent 0 — Scoper (Feature Run Mode)

### Responsibilities

- Parse the feature description written by the QA engineer
- Query Mem0 for known app structure
- Map the feature to: direct scope + blast radius + skip list
- Output a scope object that drives all subsequent agents

```typescript
// src/agents/scoper.graph.ts
import { getGithubTools } from "../tools/github.tools";

// NEW: Fetch git diff first — gives Scoper real changed files, not just memory
async function fetchGitDiff(state: QARunStateType) {
  const ghTools = await getGithubTools();
  const compareCommits = ghTools.find((t) => t.name === "compare_files");

  // Get the last two commits on the staging branch to extract changed files
  const listCommits = ghTools.find((t) => t.name === "list_commits");
  const commits = await listCommits?.invoke({
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    sha: process.env.GITHUB_DEFAULT_BRANCH,
    per_page: 2,
  });

  if (!commits || commits.length < 2) {
    return { gitDiff: null }; // fallback: Scoper uses memory only
  }

  const diff = await compareCommits?.invoke({
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    base: commits[1].sha,
    head: commits[0].sha,
  });

  // Extract changed file paths — these seed the blast radius
  const changedFiles: string[] = diff?.files?.map((f: any) => f.filename) ?? [];

  return {
    gitDiff: { changedFiles, base: commits[1].sha, head: commits[0].sha },
  };
}

async function resolveScope(state: QARunStateType) {
  const appKnowledge = await agentMemory.recall(
    "all known modules routes user flows API endpoints blast radius relationships",
  );

  // Check if we've scoped this feature before (incremental re-runs)
  const previousScope = await sessionMemory.recall(
    `scope for feature: ${state.featureDescription?.substring(0, 50)}`,
    state.runId,
  );

  if (previousScope) {
    // Re-run after bug fix — skip scoping, reuse manifest
    return { scope: JSON.parse(previousScope), scopeCacheHit: true };
  }

  // NEW: Feed git diff into the scoping prompt for precise blast radius detection
  const gitDiffContext = state.gitDiff
    ? `\n\nGit diff (actual changed files since last commit):\n${state.gitDiff.changedFiles.join("\n")}\n
       Use these file paths to precisely identify which components and routes changed.
       Changed files override memory-based blast radius guesses — trust the diff.`
    : "";

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a QA scoping expert. Given a feature description and knowledge of 
              an app's structure, you identify:
              1. directScope: exact routes, API endpoints, components this feature touches
              2. blastRadius: existing features that share data/state with this feature
              3. skip: modules with zero overlap (no need to test)
              4. testTypes: which test types are needed [UI, voice, API]
              
              Be conservative with blast radius — better to include too much than miss a regression.
              Known app structure: ${appKnowledge}${gitDiffContext}
              Output as JSON matching FeatureScope type.`,
    },
    {
      role: "user",
      content: `New feature to test: ${state.featureDescription}`,
    },
  ]);

  const scope = JSON.parse(response.content as string);

  // Cache scope in session memory for re-runs
  await sessionMemory.save(
    `scope for feature: ${state.featureDescription?.substring(0, 50)}: ${JSON.stringify(scope)}`,
    state.runId,
  );

  // Save blast radius relationships to agent memory (durable learning)
  await agentMemory.learn(
    `Blast radius: ${scope.directScope.routes.join(",")} affects ${scope.blastRadius.routes.join(",")}`,
  );

  return { scope };
}

// Scoper graph — fetchGitDiff runs first so resolveScope has real diff context
const scoperGraph = new StateGraph(QARunStateType as any)
  .addNode("fetchGitDiff", fetchGitDiff)
  .addNode("resolveScope", resolveScope)
  .addEdge(START, "fetchGitDiff")
  .addEdge("fetchGitDiff", "resolveScope")
  .addEdge("resolveScope", END);

export const runScoper = scoperGraph.compile();
```

---

## 12. Frontend Edge Cases — Complete Handling

### 12.1 Overlay Dismissal

```typescript
// src/tools/playwright.tools.ts

const OVERLAY_PATTERNS = [
  { role: "button", name: /accept|allow|got it|i agree|dismiss|close/i },
  { role: "button", name: /cookie/i },
  { role: "button", name: /continue/i },
];

export async function dismissOverlays(
  page: Page,
  memory: string,
): Promise<void> {
  // Parse known overlays from Mem0 memory
  const memoryOverlays = extractOverlaysFromMemory(memory);
  const allPatterns = [...OVERLAY_PATTERNS, ...memoryOverlays];

  for (const pattern of allPatterns) {
    try {
      const el = page.getByRole(pattern.role as any, {
        name: pattern.name,
        timeout: 1500,
      });
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click();
        await agentMemory.learn(`Known overlay: ${JSON.stringify(pattern)}`);
      }
    } catch {
      /* not present */
    }
  }
}
```

### 12.2 Infinite Scroll & Lazy Loading

```typescript
export async function scrollUntilVisible(
  page: Page,
  targetRole: string,
  name: string,
  maxScrolls = 25,
): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    const el = page.getByRole(targetRole as any, { name });
    if (await el.isVisible().catch(() => false)) return;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
    await page.waitForTimeout(400); // wait for virtual list re-render
  }
  throw new Error(
    `Element "${name}" not found after ${maxScrolls} scroll attempts`,
  );
}

// For virtualized lists (React Window, TanStack)
export async function scrollVirtualListTo(
  page: Page,
  containerSelector: string,
  index: number,
): Promise<void> {
  await page.evaluate(
    ({ sel, idx }) => {
      const container = document.querySelector(sel);
      if (container) container.scrollTop = idx * 50; // estimated row height
    },
    { sel: containerSelector, idx: index },
  );
  await page.waitForTimeout(300);
}
```

### 12.3 WebSocket / Real-Time State

```typescript
export async function mockWebSocket(
  page: Page,
  messages: object[],
): Promise<void> {
  await page.addInitScript((msgs) => {
    const OriginalWebSocket = window.WebSocket;
    (window as any).WebSocket = class MockWS extends EventTarget {
      readyState = 1;
      url: string;

      constructor(url: string) {
        super();
        this.url = url;
        setTimeout(() => {
          this.dispatchEvent(new Event("open"));
          for (const msg of msgs) {
            this.dispatchEvent(
              Object.assign(new Event("message"), {
                data: JSON.stringify(msg),
              }),
            );
          }
        }, 100);
      }

      send() {}
      close() {}
    };
  }, messages);
}

// Wait for SSE event in tests
export async function waitForSSEEvent(
  page: Page,
  eventType: string,
  timeout = 10000,
): Promise<any> {
  return page.evaluate(
    ({ evType, ms }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`SSE event ${evType} not received`)),
          ms,
        );
        document.addEventListener(
          evType,
          (e: any) => {
            clearTimeout(timer);
            resolve(e.detail);
          },
          { once: true },
        );
      });
    },
    { evType: eventType, ms: timeout },
  );
}
```

### 12.4 File Upload Testing

```typescript
export async function testFileUpload(
  page: Page,
  inputSelector: string,
  fixturePath: string,
  expectedResponse: string,
): Promise<void> {
  const fileInput = page.locator(inputSelector);

  // Playwright's setInputFiles works without user gesture in headless mode
  await fileInput.setInputFiles(fixturePath);

  // Wait for upload progress and completion
  await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole("progressbar")).not.toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText(expectedResponse)).toBeVisible();
}

// Boundary tests for file upload
export const FILE_UPLOAD_EDGE_CASES = [
  {
    name: "zero byte file",
    path: "tests/fixtures/empty.txt",
    expectError: true,
  },
  {
    name: "oversized file",
    path: "tests/fixtures/50mb.bin",
    expectError: true,
  },
  {
    name: "wrong MIME type",
    path: "tests/fixtures/script.exe",
    expectError: true,
  },
  {
    name: "valid image",
    path: "tests/fixtures/sample.jpg",
    expectError: false,
  },
  { name: "valid PDF", path: "tests/fixtures/sample.pdf", expectError: false },
];
```

### 12.5 Auth Edge Cases

```typescript
// tests/auth.setup.ts — run once per role, save state
export async function setupAuthForAllRoles(targetUrl: string) {
  const roles = [
    {
      name: "user",
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    },
    {
      name: "admin",
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    },
  ];

  for (const role of roles) {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${targetUrl}/login`);

    // Handle MFA if present
    if (
      await page
        .getByLabel("One-time code")
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      const totp = generateTOTP(process.env.TEST_TOTP_SECRET!);
      await page.getByLabel("One-time code").fill(totp);
      await page.getByRole("button", { name: /verify|continue/i }).click();
    } else {
      await page.getByLabel(/email/i).fill(role.email);
      await page.getByLabel(/password/i).fill(role.password);
      await page.getByRole("button", { name: /sign in|log in/i }).click();
    }

    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await context.storageState({ path: `tests/.auth/${role.name}.json` });
    await browser.close();
  }
}

// Token refresh handling
export async function handleTokenRefresh(page: Page): Promise<void> {
  page.on("response", async (response) => {
    if (response.status() === 401 && response.url().includes("/api/")) {
      // Token expired — re-auth and retry
      await page.evaluate(() => localStorage.removeItem("token"));
      await page.reload();
    }
  });
}
```

### 12.6 Race Conditions & Animation Timing

```typescript
// Rules enforced at test generation time by the Automation agent

// WRONG (never generate this):
// await page.waitForTimeout(2000);
// await expect(element).toBeVisible();

// CORRECT (always generate this form):
// Wait for the API response that triggers the state change
await page.waitForResponse(
  (res) => res.url().includes("/api/submit") && res.status() === 200,
);
// Then assert the resulting UI state
await expect(page.getByText("Success")).toBeVisible();

// For animations — wait for CSS transition to complete
export async function waitForAnimationEnd(
  page: Page,
  selector: string,
): Promise<void> {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    if (!el) return true;
    return (
      getComputedStyle(el).animationPlayState === "paused" ||
      getComputedStyle(el).animationName === "none"
    );
  }, selector);
}
```

---

## 13. Voice / Mic Input Testing

Two strategies based on what your React app uses. Detect which strategy to use during the Explorer phase.

### Strategy A — Web Speech API Mock (most common)

Use this when: `window.SpeechRecognition` or `window.webkitSpeechRecognition` is used directly.

```typescript
// src/tools/voice.tools.ts

/**
 * Inject a fully controllable SpeechRecognition stub before page load.
 * Must be called BEFORE page.goto().
 */
export async function injectSpeechMock(
  page: Page,
  transcript: string,
  options: {
    confidence?: number;
    delayMs?: number;
    interimResults?: boolean;
  } = {},
): Promise<void> {
  const { confidence = 0.95, delayMs = 800, interimResults = false } = options;

  await page.addInitScript(
    ({ transcript, confidence, delayMs, interimResults }) => {
      class MockSpeechRecognition extends EventTarget {
        continuous = false;
        interimResults = interimResults;
        lang = "en-US";
        maxAlternatives = 1;
        onresult: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        onend: (() => void) | null = null;
        onstart: (() => void) | null = null;
        onspeechstart: (() => void) | null = null;
        onspeechend: (() => void) | null = null;

        start() {
          setTimeout(() => {
            this.onstart?.();
            this.onspeechstart?.();
          }, 50);

          if (interimResults) {
            // Simulate word-by-word interim results
            const words = transcript.split(" ");
            words.forEach((word, i) => {
              setTimeout(
                () => {
                  const partialTranscript = words.slice(0, i + 1).join(" ");
                  this.onresult?.({
                    results: [
                      [{ transcript: partialTranscript, confidence: 0.5 }],
                    ],
                    resultIndex: 0,
                    results: {
                      0: [
                        {
                          transcript: partialTranscript,
                          confidence: 0.5,
                          isFinal: false,
                        },
                      ],
                      length: 1,
                    },
                  });
                },
                (delayMs / words.length) * i,
              );
            });
          }

          // Final result
          setTimeout(() => {
            this.onspeechend?.();
            this.onresult?.({
              resultIndex: 0,
              results: {
                0: [{ transcript, confidence, isFinal: true }],
                length: 1,
                item: (i: number) => [
                  { transcript, confidence, isFinal: true },
                ],
              },
            });
            setTimeout(() => this.onend?.(), 100);
          }, delayMs);
        }

        stop() {
          this.onspeechend?.();
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      }

      Object.defineProperty(window, "SpeechRecognition", {
        value: MockSpeechRecognition,
        writable: true,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        value: MockSpeechRecognition,
        writable: true,
      });
    },
    { transcript, confidence, delayMs, interimResults },
  );
}

/**
 * Inject a speech recognition error stub.
 * Use for testing: not-allowed, no-speech, aborted, network, audio-capture errors.
 */
export async function injectSpeechErrorMock(
  page: Page,
  errorType: SpeechError,
): Promise<void> {
  await page.addInitScript((errorType) => {
    class ErrorSpeechRecognition extends EventTarget {
      onerror: ((e: any) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;

      start() {
        setTimeout(() => this.onstart?.(), 50);
        setTimeout(() => {
          this.onerror?.({
            error: errorType,
            message: `Speech recognition error: ${errorType}`,
          });
          this.onend?.();
        }, 300);
      }
      stop() {}
      abort() {}
    }
    (window as any).SpeechRecognition = ErrorSpeechRecognition;
    (window as any).webkitSpeechRecognition = ErrorSpeechRecognition;
  }, errorType);
}

export type SpeechError =
  | "not-allowed"
  | "no-speech"
  | "aborted"
  | "network"
  | "audio-capture"
  | "service-not-allowed";

// Test fixture library — what the Test Case agent generates specs for
export const VOICE_TEST_MATRIX = [
  // Happy path variations
  { type: "happy", transcript: "show me blue running shoes", confidence: 0.97 },
  {
    type: "happy",
    transcript: "what lessons are available today",
    confidence: 0.91,
  },
  // Edge: input characteristics
  {
    type: "edge",
    transcript: "a",
    confidence: 0.99,
    label: "single character",
  },
  {
    type: "edge",
    transcript: "a ".repeat(500),
    confidence: 0.85,
    label: "extremely long",
  },
  { type: "edge", transcript: "", confidence: 0.0, label: "empty transcript" },
  // Error states
  {
    type: "error",
    error: "not-allowed",
    expectedUI: /microphone.*denied|permission/i,
  },
  { type: "error", error: "no-speech", expectedUI: /nothing heard|try again/i },
  { type: "error", error: "aborted", expectedUI: /recording stopped/i },
  { type: "error", error: "network", expectedUI: /unavailable|connection/i },
  { type: "error", error: "audio-capture", expectedUI: /microphone.*problem/i },
];
```

### Strategy B — getUserMedia + Fake Audio Injection

Use this when: your app sends raw audio to your Express backend or a third-party (Deepgram, Whisper, etc.).

```typescript
// src/tools/voice.tools.ts — continued

/**
 * Launch browser with fake audio device.
 * The WAV file path must be set BEFORE the test starts — cannot change mid-test.
 * This forces sequential execution (workers: 1).
 */
export async function launchWithFakeAudio(wavFilePath: string) {
  return chromium.launchPersistentContext("", {
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream", // auto-grants mic permission dialog
      `--use-file-for-fake-audio-capture=${path.resolve(wavFilePath)}%noloop`,
      // %noloop ensures the file plays exactly once, not on repeat
    ],
    permissions: ["microphone"],
  });
}

/**
 * Mock the backend transcription endpoint instead of injecting audio.
 * Use this when testing the app's RESPONSE to transcripts, not the capture itself.
 * Much simpler and parallelizable.
 */
export async function mockTranscriptionEndpoint(
  page: Page,
  transcript: string,
  endpoint = "**/api/transcribe",
): Promise<void> {
  await page.route(endpoint, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        transcript,
        confidence: 0.95,
        words: transcript.split(" ").map((w, i) => ({
          word: w,
          start: i * 0.3,
          end: (i + 1) * 0.3,
          confidence: 0.95,
        })),
      }),
    });
  });
}

// Audio fixture generation helper (run once to create fixture library)
export const AUDIO_FIXTURE_MANIFEST = {
  "clear-english.wav": {
    transcript: "show me blue running shoes",
    lang: "en-US",
  },
  "accented-query.wav": {
    transcript: "what is the weather today",
    lang: "en-IN",
  },
  "silence-3s.wav": { transcript: "", expectError: "no-speech" },
  "background-noise.wav": { transcript: "order pizza", noisy: true },
  "very-long-utterance.wav": {
    transcript: "a ".repeat(200).trim(),
    label: "input overflow",
  },
  "non-english.wav": { transcript: "¿cuál es el clima hoy?", lang: "es-ES" },
  "whispered-input.wav": {
    transcript: "reminder at five pm",
    confidence: 0.62,
  },
};
```

### Generated Voice Test Example

This is the pattern the Automation agent generates for voice specs:

```typescript
// tests/generated/pronunciation-capture.voice.spec.ts
import { test, expect, chromium } from "@playwright/test";
import {
  injectSpeechMock,
  injectSpeechErrorMock,
  mockTranscriptionEndpoint,
  VOICE_TEST_MATRIX,
} from "../tools/voice.tools";
import { seedTestData } from "../tools/db-seeder.tools";

test.describe("Pronunciation capture — happy path", () => {
  test("captures speech and displays phoneme feedback", async ({ page }) => {
    await seedTestData("lesson-with-pronunciation");
    await injectSpeechMock(page, "Buenos días", { confidence: 0.94 });

    await page.goto("/lessons/lesson_42/pronunciation");
    await page.getByRole("button", { name: /start recording|mic/i }).click();

    // Wait for mock to fire and app to process transcript
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/pronunciation/analyze") &&
        res.status() === 200,
    );

    await expect(page.getByTestId("pronunciation-score")).toBeVisible();
    await expect(page.getByTestId("phoneme-feedback")).toBeVisible();
    await expect(page.getByTestId("pronunciation-score")).not.toHaveText("0");
  });
});

test.describe("Pronunciation capture — error states", () => {
  for (const { error, expectedUI } of VOICE_TEST_MATRIX.filter(
    (t) => t.type === "error",
  )) {
    test(`handles ${error} error gracefully`, async ({ page }) => {
      await injectSpeechErrorMock(page, error as any);
      await page.goto("/lessons/lesson_42/pronunciation");
      await page.getByRole("button", { name: /start recording|mic/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("alert")).toHaveText(expectedUI!);
    });
  }
});

test.describe("Pronunciation capture — score edge cases", () => {
  test("score = 0 handled without 500", async ({ page }) => {
    await mockTranscriptionEndpoint(page, ""); // Empty transcript → score 0
    await page.goto("/lessons/lesson_42/pronunciation");
    await page.getByRole("button", { name: /start recording/i }).click();
    await page.waitForResponse((res) =>
      res.url().includes("/api/pronunciation/analyze"),
    );
    // Should show score = 0 UI, not crash
    await expect(page.getByTestId("pronunciation-score")).toHaveText("0");
    await expect(page.getByText("Try again")).toBeVisible();
  });
});
```

---

## 14. Backend API Testing — Full Coverage

### Express Backend Middleware Required

Add this to your main backend. It only activates in test mode:

```typescript
// main-backend/middleware/test-transaction.ts
import { Pool, PoolClient } from "pg";

export function testTransactionMiddleware(pool: Pool) {
  return async (req: any, res: any, next: any) => {
    if (process.env.NODE_ENV !== "test" || !req.headers["x-test-run"]) {
      return next();
    }

    const client: PoolClient = await pool.connect();
    await client.query("BEGIN");

    // Attach to request so controllers can use it
    req.dbClient = client;

    // Always rollback after the response — test state is never persisted
    res.on("finish", async () => {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    });

    next();
  };
}
```

### API Test Execution Engine

```typescript
// src/tools/api.tools.ts
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true });

export async function apiRequest(
  method: string,
  url: string,
  options: {
    body?: object;
    token?: string;
    expectStatus?: number | number[];
    validateSchema?: object;
  } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Test-Run": "true", // triggers DB transaction rollback on backend
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const expectedStatuses = Array.isArray(options.expectStatus)
    ? options.expectStatus
    : options.expectStatus
      ? [options.expectStatus]
      : [200, 201];

  if (!expectedStatuses.includes(res.status)) {
    throw new Error(
      `Expected status ${expectedStatuses.join("|")}, got ${res.status}\n` +
        `URL: ${method} ${url}\n` +
        `Body: ${await res.text()}`,
    );
  }

  if (options.validateSchema) {
    const body = await res.json();
    const validate = ajv.compile(options.validateSchema);
    if (!validate(body)) {
      throw new Error(
        `Schema validation failed:\n${JSON.stringify(validate.errors, null, 2)}`,
      );
    }
    return body;
  }

  return res.json().catch(() => null);
}

// Async endpoint testing — webhook receiver
export function waitForWebhook(
  path: string,
  timeout = 5000,
): Promise<{ body: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Webhook to ${path} not received`)),
      timeout,
    );
    webhookBus.once(path, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Rate limit enforcement test
export async function testRateLimit(
  method: string,
  url: string,
  token: string,
  expectedLimit: number,
) {
  const requests = Array.from({ length: expectedLimit + 10 }, () =>
    apiRequest(method, url, { token, expectStatus: [200, 429] })
      .then(() => 200)
      .catch(() => 429),
  );

  const statuses = await Promise.allSettled(requests);
  const tooMany = statuses.filter(
    (r) => r.status === "fulfilled" && (r as any).value === 429,
  );

  if (tooMany.length === 0) {
    throw new Error(
      `Rate limit of ${expectedLimit} not enforced on ${method} ${url}`,
    );
  }
}
```

### DB Seed Endpoint on Main Backend

```typescript
// main-backend/routes/test.routes.ts
// Mount at: app.use("/api/test", testRouter)
// Guard with NODE_ENV=test check

import { Router } from "express";

const router = Router();

// Gate — this entire router only works in test mode
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    return res.status(404).json({ error: "Not found" });
  }
  next();
});

const SCENARIOS: Record<string, (client: any) => Promise<object>> = {
  "lesson-with-pronunciation": async (client) => {
    const lesson = await client.query(
      "INSERT INTO lessons (title, type) VALUES ($1, $2) RETURNING id",
      ["Test Lesson", "pronunciation"],
    );
    const user = await client.query(
      "INSERT INTO users (email, role) VALUES ($1, $2) RETURNING id",
      ["test-user@qa.com", "student"],
    );
    return { lessonId: lesson.rows[0].id, userId: user.rows[0].id };
  },
  "user-with-streak": async (client) => {
    const user = await client.query(
      "INSERT INTO users (email, streak_count) VALUES ($1, $2) RETURNING id",
      ["streak-user@qa.com", 7],
    );
    return { userId: user.rows[0].id, streak: 7 };
  },
  // ... add more scenarios as your app grows
};

router.post("/seed", async (req, res) => {
  const { scenario } = req.body;
  const seeder = SCENARIOS[scenario];

  if (!seeder) {
    return res.status(400).json({ error: `Unknown scenario: ${scenario}` });
  }

  // Use the transaction client attached by testTransactionMiddleware
  const client = (req as any).dbClient || req.app.get("db");
  const fixtures = await seeder(client);

  res.json(fixtures);
});

export { router as testRouter };
```

---

## 15. Test Data Management

### Principles

1. Every test seeds its own data at start
2. `X-Test-Run` header triggers automatic rollback on the backend
3. No test should ever read data left by another test
4. No production data is ever used — fixture data only
5. Dynamic IDs (from seeds) are passed through test state, never hardcoded

### Seeder Tool

```typescript
// src/tools/db-seeder.tools.ts
export async function seedTestData(
  scenario: string,
  targetUrl: string = process.env.DEFAULT_TARGET_URL!,
): Promise<Record<string, string>> {
  const res = await fetch(`${targetUrl}/api/test/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Run": "true",
    },
    body: JSON.stringify({ scenario }),
  });

  if (!res.ok) {
    throw new Error(
      `Seed failed for scenario "${scenario}": ${await res.text()}`,
    );
  }

  return res.json(); // { lessonId: "42", userId: "17", ... }
}
```

### Fixture Catalog (maintained by Test Case agent, grows over time)

```typescript
// src/tools/fixtures.catalog.ts
// The Test Case agent adds to this as it discovers new data needs

export const FIXTURE_SCENARIOS = {
  // Language learning app scenarios
  "lesson-with-pronunciation":
    "A lesson with pronunciation exercise, no prior attempts",
  "lesson-completed": "A lesson already marked complete with score 85",
  "user-with-streak": "A user with a 7-day streak active",
  "user-streak-at-risk": "A user whose streak expires in 2 hours",
  "vocabulary-set-empty": "A vocabulary module with 0 words added",
  "vocabulary-set-full": "A vocabulary module at max capacity (500 words)",
  "leaderboard-with-10-users":
    "10 users with varying scores for leaderboard testing",
  "premium-user": "A user with premium subscription active",
  "expired-subscription": "A user whose subscription expired yesterday",
};
```

---

## 16. Express API Gateway

```typescript
// src/api/routes.ts
import { Router } from "express";
import { qaGraph } from "../orchestrator.graph";
import { v4 as uuid } from "uuid";
import { sseManager } from "./sse";

const router = Router();

// Start a new QA run
router.post("/runs", async (req, res) => {
  const {
    targetUrl,
    runMode = "full",
    featureDescription,
    qaUserId = "default",
    autoApproveBlastRadius = true,
  } = req.body;

  const runId = uuid();
  const initialState = {
    runId,
    runMode,
    targetUrl,
    featureDescription: featureDescription || null,
    qaUserId,
    specsApproved: false,
    errors: [],
    startedAt: new Date().toISOString(),
  };

  // Start graph asynchronously — it will pause at human checkpoint
  qaGraph
    .stream(initialState, {
      configurable: { thread_id: runId },
    })
    .then(async (stream) => {
      for await (const chunk of stream) {
        sseManager.broadcast(runId, { type: "agent_update", data: chunk });
      }
    })
    .catch((err) => {
      sseManager.broadcast(runId, { type: "error", error: err.message });
    });

  res.json({ runId, status: "started" });
});

// Human approval — resume graph after spec review
router.post("/runs/:runId/approve", async (req, res) => {
  const { runId } = req.params;
  const { approvedSpecs } = req.body;

  // Update state and resume the paused graph
  await qaGraph.updateState(
    { configurable: { thread_id: runId } },
    { specsApproved: true, approvedSpecs },
  );

  // Resume execution
  const stream = await qaGraph.stream(null, {
    configurable: { thread_id: runId },
  });

  for await (const chunk of stream) {
    sseManager.broadcast(runId, { type: "agent_update", data: chunk });
  }

  res.json({ status: "resumed" });
});

// SSE stream for dashboard
router.get("/runs/:runId/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const unsubscribe = sseManager.subscribe(req.params.runId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", unsubscribe);
});

// Get run results
router.get("/runs/:runId/results", async (req, res) => {
  const state = await qaGraph.getState({
    configurable: { thread_id: req.params.runId },
  });
  res.json(state.values);
});

// Memory inspector endpoints
router.get("/memory/agent", async (req, res) => {
  const { query = "all" } = req.query;
  const memories = await agentMemory.recall(query as string);
  res.json({ memories });
});

router.delete("/memory/:memoryId", async (req, res) => {
  await agentMemory.forget(req.params.memoryId);
  res.json({ deleted: true });
});

export { router };
```

---

## 17. React Dashboard

Five views covering the full QA workflow.

### View 1 — Run Trigger

```tsx
// dashboard/src/pages/RunTrigger.tsx
export function RunTrigger() {
  const [mode, setMode] = useState<"full" | "smoke" | "feature">("full");
  const [featureDesc, setFeatureDesc] = useState("");
  const [targetUrl, setTargetUrl] = useState(import.meta.env.VITE_DEFAULT_URL);

  const handleRun = async () => {
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUrl,
        runMode: mode,
        featureDescription: featureDesc,
      }),
    });
    const { runId } = await res.json();
    navigate(`/runs/${runId}/monitor`);
  };

  return (
    <div>
      <h2>New QA Run</h2>
      <input
        value={targetUrl}
        onChange={(e) => setTargetUrl(e.target.value)}
        placeholder="Target URL"
      />

      <div>
        {["full", "smoke", "feature"].map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => setMode(m as any)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {mode === "feature" && (
        <textarea
          placeholder="Describe the new feature: what it does, which routes it adds/changes, which API endpoints it uses..."
          value={featureDesc}
          onChange={(e) => setFeatureDesc(e.target.value)}
          rows={5}
        />
      )}

      <button onClick={handleRun} disabled={mode === "feature" && !featureDesc}>
        Start Run
      </button>
    </div>
  );
}
```

### View 2 — Spec Review (Human Checkpoint)

```tsx
// dashboard/src/pages/SpecReview.tsx
export function SpecReview({ runId }: { runId: string }) {
  const [specs, setSpecs] = useState<TestSpec[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const handleApprove = async () => {
    const approvedSpecs = specs.map((s) => ({
      ...s,
      content: edits[s.id] ?? s.content, // include any QA edits
    }));

    await fetch(`/api/runs/${runId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedSpecs }),
    });
  };

  // Specs split by bucket
  const featureSpecs = specs.filter((s) => s.bucket === "feature");
  const regressionSpecs = specs.filter((s) => s.bucket === "regression");

  return (
    <div>
      <h2>Review Specs</h2>

      <section>
        <h3>New feature specs ({featureSpecs.length}) — requires review</h3>
        {featureSpecs.map((spec) => (
          <SpecCard
            key={spec.id}
            spec={spec}
            editable
            onEdit={(content) =>
              setEdits((prev) => ({ ...prev, [spec.id]: content }))
            }
          />
        ))}
      </section>

      <section>
        <h3>Regression specs ({regressionSpecs.length}) — auto-approved</h3>
        <p>These cover blast-radius areas. Review optional.</p>
        {regressionSpecs.map((spec) => (
          <SpecCard key={spec.id} spec={spec} editable={false} />
        ))}
      </section>

      <button onClick={handleApprove}>Approve &amp; Run Tests</button>
    </div>
  );
}
```

### View 3 — Run Monitor (Live SSE)

```tsx
// dashboard/src/pages/RunMonitor.tsx
export function RunMonitor({ runId }: { runId: string }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);

  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/stream`);
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "agent_update")
        setEvents((prev) => [...prev, event.data]);
      if (event.type === "test_result")
        setResults((prev) => [...prev, event.data]);
    };
    return () => es.close();
  }, [runId]);

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  return (
    <div>
      <h2>Run Monitor</h2>
      <div>
        Pass: {passCount} | Fail: {failCount} | Running: {results.length}
      </div>

      <div className="agent-timeline">
        {events.map((ev, i) => (
          <div key={i} className={`event event--${ev.agent}`}>
            <span className="agent-name">{ev.agent}</span>
            <span>{ev.message}</span>
          </div>
        ))}
      </div>

      <div className="results-grid">
        {results.map((r) => (
          <ResultRow key={r.specId} result={r} />
        ))}
      </div>
    </div>
  );
}
```

### View 4 — Failure Triage

```tsx
// dashboard/src/pages/FailureTriage.tsx
// Shows escalated failures with AI diagnosis and reproduction steps

export function FailureTriage({ runId }: { runId: string }) {
  const escalations = useEscalations(runId);

  return (
    <div>
      <h2>Failures requiring attention ({escalations.length})</h2>
      {escalations.map((e) => (
        <div key={e.specId} className="escalation-card">
          <h3>{e.specTitle}</h3>
          <div className="ai-diagnosis">
            <strong>AI diagnosis:</strong> {e.explanation}
          </div>
          <div className="confidence">Confidence: {e.confidence}%</div>
          {e.healAttempted && (
            <div className="heal-note">
              Auto-heal attempted but failed — selector issue unclear
            </div>
          )}
          <details>
            <summary>Error trace</summary>
            <pre>{e.failureTrace}</pre>
          </details>
          <details>
            <summary>Reproduce with curl</summary>
            <pre>{e.curlCommand}</pre>
          </details>
          <img
            src={e.screenshotPath}
            alt="Failure screenshot"
            style={{ maxWidth: "100%" }}
          />
        </div>
      ))}
    </div>
  );
}
```

### View 5 — Memory Inspector

```tsx
// dashboard/src/pages/MemoryInspector.tsx
export function MemoryInspector() {
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);

  const search = async () => {
    const res = await fetch(
      `/api/memory/agent?query=${encodeURIComponent(query)}`,
    );
    const { memories } = await res.json();
    setMemories(memories);
  };

  const forget = async (memoryId: string) => {
    await fetch(`/api/memory/${memoryId}`, { method: "DELETE" });
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
  };

  return (
    <div>
      <h2>Memory Inspector</h2>
      <p>What the system has learned about your app across all runs.</p>

      <input
        placeholder="Search memories (e.g. 'voice routes', 'flaky selectors', 'known bugs')"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && search()}
      />
      <button onClick={search}>Search</button>

      {memories.map((m) => (
        <div key={m.id} className="memory-item">
          <p>{m.memory}</p>
          <small>{new Date(m.createdAt).toLocaleString()}</small>
          <button onClick={() => forget(m.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

---

## 18. Run Modes

| Mode      | Scoper runs | Explorer scope                    | Specs                      | Human review        | API tests               |
| --------- | ----------- | --------------------------------- | -------------------------- | ------------------- | ----------------------- |
| `full`    | No          | All known routes                  | Full suite                 | All specs           | All endpoints           |
| `smoke`   | No          | Critical flows only (from memory) | ~10 key specs              | All specs           | Critical endpoints only |
| `feature` | Yes         | Scoped + blast radius             | Feature + regression split | Feature bucket only | Changed endpoints only  |

### Smoke Mode — Critical Flows from Memory

For smoke mode, the Explorer queries Mem0 for "critical flows" — these are set by the QA team via the dashboard and stored as user-scoped memory.

```typescript
// In explorer.graph.ts — smoke mode branch
if (state.runMode === "smoke") {
  const criticalFlows = await userMemory.recall(
    "critical flows always run smoke",
    state.qaUserId,
  );
  // Returns something like: "login, checkout, core API health"
  return parseCriticalFlows(criticalFlows);
}
```

---

## 19. Docker & Deployment

```yaml
# docker-compose.yml
version: "3.9"

services:
  agentic-qa:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - MEM0_API_KEY=${MEM0_API_KEY}
      - DATABASE_URL=postgresql://qa:qa@postgres:5432/agentic_qa
    depends_on:
      - postgres
    volumes:
      - ./tests:/app/tests # persists generated tests & auth state
      - ./runs:/app/runs # persists screenshots & traces

  dashboard:
    build: ./dashboard
    ports:
      - "3001:3001"
    environment:
      - VITE_API_URL=http://agentic-qa:4000

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: qa
      POSTGRES_PASSWORD: qa
      POSTGRES_DB: agentic_qa
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./src/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  pgdata:
```

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx tsc

# Install Playwright browsers inside the image
RUN npx playwright install chromium

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Database Schema

```sql
-- src/db/schema.sql

-- ─── SaaS Identity ───────────────────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,                           -- null for OAuth-only users
  name            TEXT NOT NULL,
  avatar_url      TEXT,
  provider        TEXT DEFAULT 'email',           -- 'email' | 'google' | 'github'
  provider_id     TEXT,                           -- OAuth provider user ID
  email_verified  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_provider ON users(provider, provider_id) WHERE provider_id IS NOT NULL;

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,           -- URL-safe identifier
  plan            TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'team'
  max_runs_month  INTEGER NOT NULL DEFAULT 50,    -- usage cap per billing period
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE org_members (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  invited_by      UUID REFERENCES users(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE org_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member',
  token           TEXT NOT NULL UNIQUE,           -- secure random invite token
  invited_by      UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,           -- bcrypt hash of refresh token
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── QA Pipeline Data (org-scoped) ──────────────────────────────────────────

CREATE TABLE qa_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_mode     TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES users(id),
  scope_json   JSONB
);

CREATE INDEX idx_qa_runs_org ON qa_runs(org_id, started_at DESC);

CREATE TABLE test_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES qa_runs(id) ON DELETE CASCADE,
  spec_id         TEXT NOT NULL,
  spec_title      TEXT NOT NULL,
  spec_bucket     TEXT NOT NULL,   -- 'feature' | 'regression'
  status          TEXT NOT NULL,   -- 'pass' | 'fail' | 'skip'
  duration_ms     INTEGER,
  error_message   TEXT,
  failure_trace   TEXT,
  screenshot_path TEXT,
  healed          BOOLEAN DEFAULT FALSE,
  escalated       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_test_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES qa_runs(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  test_name       TEXT NOT NULL,
  status          TEXT NOT NULL,
  status_code     INTEGER,
  duration_ms     INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit & Usage ──────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  action          TEXT NOT NULL,      -- 'run.trigger' | 'specs.approve' | 'memory.delete' | 'member.invite' | ...
  resource_type   TEXT,               -- 'run' | 'spec' | 'memory' | 'member'
  resource_id     TEXT,
  metadata        JSONB,              -- action-specific details
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org ON audit_log(org_id, created_at DESC);

CREATE TABLE usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  run_id          UUID REFERENCES qa_runs(id) ON DELETE CASCADE,
  agent           TEXT NOT NULL,      -- 'explorer' | 'testcase' | 'automation' | 'maintenance' | 'api-tester' | 'scoper'
  tokens_in       INTEGER NOT NULL DEFAULT 0,
  tokens_out      INTEGER NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_org ON usage_logs(org_id, created_at DESC);

-- LangGraph checkpointer tables (auto-created by @langchain/langgraph-checkpoint-postgres)
-- These store paused graph state for human-in-the-loop resumption
```

---

## 20. Rollout Plan

### Week 1 — Foundation

**Goal:** Service runs, Explorer works, no agents yet.

Tasks:

- [ ] Scaffold repo structure (all folders, tsconfig, package.json)
- [ ] Set up Docker Compose (service + dashboard + postgres)
- [ ] Implement Mem0 client with typed scopes
- [ ] Implement Express API gateway (run create, SSE stream)
- [ ] Build Explorer agent — run against staging URL manually
- [ ] Verify accessibility tree output is useful for 3 routes
- [ ] Auth setup — save `storageState` for all roles
- [ ] Dashboard: Run Trigger page only

**Validation:** QA engineer can trigger a run from the dashboard and see the Explorer's app context JSON.

---

### Week 2 — Human-in-the-Loop

**Goal:** Specs generate, QA reviews them, system learns from feedback.

Tasks:

- [ ] Implement Test Case agent — spec generation
- [ ] Implement LangGraph human checkpoint (graph pauses after Agent 2)
- [ ] Implement `POST /runs/:id/approve` endpoint
- [ ] Dashboard: Spec Review page with inline editor
- [ ] Implement Mem0 writes for spec patterns and user preferences
- [ ] Test with real feature: QA reviews AI specs for 3 existing flows

**Validation:** QA team reviews AI-generated specs for familiar features and rates them useful. Iterate on prompts until 80%+ of specs need no edits.

---

### Week 3 — Automation, Voice & GitHub Integration

**Goal:** Tests run, voice works, results stream to dashboard. GitHub codebase access live for Explorer and Test Case.

Tasks:

- [ ] Implement Automation agent — code generation with 3 templates (UI, voice, API)
- [ ] Implement `injectSpeechMock` and `injectSpeechErrorMock`
- [ ] Create audio fixture library (6 WAV files)
- [ ] Set up Playwright config with voice/regular split workers
- [ ] Implement SSE result streaming to dashboard
- [ ] Dashboard: Run Monitor page
- [ ] **GitHub Integration:** Create fine-grained PAT (contents: read only) for app repo
- [ ] **GitHub Integration:** Add `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` to `.env` and Docker secrets
- [ ] **GitHub Integration:** Install `@langchain/mcp-adapters`, implement `github.tools.ts`
- [ ] **GitHub Integration:** Wire `enrichWithCodebase` into Explorer — validate it finds router file
- [ ] **GitHub Integration:** Wire `fetchValidationLogic` into Test Case — validate edge cases improve
- [ ] Run in shadow mode alongside existing QA process — compare results

**Validation:** Agent-generated tests catch the same bugs as manual testing for 3 flows. Spec edge cases reference real Zod constraints from source, not inferred DOM values.

---

### Week 4 — API Tester, Maintenance & Source-Aware Healing

**Goal:** Full pipeline end-to-end, self-healing working, Scoper uses git diff.

Tasks:

- [ ] Implement API Tester agent (contract, auth, input validation tests)
- [ ] Add `testTransactionMiddleware` to main backend
- [ ] Implement `POST /api/test/seed` endpoint on main backend with 5 scenarios
- [ ] Implement Maintenance agent (triage, heal, escalate)
- [ ] **GitHub Integration:** Wire `fetchGitDiff` into Scoper — validate blast radius narrows vs memory-only
- [ ] **GitHub Integration:** Wire `getFileContents` into Maintenance `healSelectors` — validate heal success rate improves
- [ ] Dashboard: Failure Triage page
- [ ] Run full regression — measure pass rate

**Validation:** Full pipeline runs end-to-end. Maintenance agent heals at least 1 real selector breakage without human intervention. Scoper's blast radius matches actual changed files from git diff.

---

### Week 5 — Feature Scoping & Memory Inspector

**Goal:** Scoped runs work, memory is inspectable.

Tasks:

- [ ] Implement Scoper agent
- [ ] Add `runMode: "feature"` to dashboard trigger form
- [ ] Implement blast-radius auto-approval
- [ ] Dashboard: Memory Inspector page
- [ ] Test scoped run against a real new feature in your app
- [ ] Add smoke mode (critical flows from memory)

**Validation:** QA engineer tests a new feature in <10 minutes from trigger to results. Memory inspector shows meaningful learned facts.

---

### Month 2 — Hardening

- [ ] Tune Maintenance agent — track heal success rate in Mem0
- [ ] Add flaky test quarantine (tests that fail intermittently get auto-disabled)
- [ ] Expand fixture scenario catalog as app grows
- [ ] Add token cost monitoring (log LLM calls per run)
- [ ] Tune Explorer to handle all overlay types in your app
- [ ] Write runbook for QA team: how to add memory corrections, how to add fixture scenarios

---

## 21. What Your QA Team Does After This

### Before This System

- Write Playwright test scripts from scratch: 2–4 hours per feature
- Maintain selectors after every UI change: ~40% of QA time
- Manually run regression suites: 2–3 hours per deploy
- Manually write API test cases: 1–2 hours per endpoint group
- Manually test voice features: difficult, often skipped

### After This System

| Task                 | QA time               | System time           |
| -------------------- | --------------------- | --------------------- |
| Feature spec writing | ~10 min (review only) | Agent 2 (~2 min)      |
| Test code authoring  | 0                     | Agent 3 (~3 min)      |
| Regression execution | 0                     | Agents 3+5 (~5 min)   |
| Selector maintenance | 0 (most healed auto)  | Agent 4               |
| API validation       | 0                     | Agent 5               |
| Voice testing        | 0                     | Agent 3 + voice tools |
| Bug triage           | Review AI diagnosis   | Agent 4 diagnosis     |
| Memory correction    | ~5 min per run        | Memory Inspector      |

### QA Team's New Role

1. **Feature spec review** — read AI-generated specs, edit edge cases you know the AI would miss (business logic, domain knowledge)
2. **Approve blast-radius regression** — check that the AI's blast-radius assessment makes sense for the feature
3. **Triage escalated failures** — read the AI diagnosis, look at the screenshot, decide if it's a real bug or a test issue
4. **Maintain fixture scenarios** — when a new entity type is added to the app, add a seed scenario
5. **Correct memory** — if the system learns something wrong (false positive stored as a real bug), delete it via the Memory Inspector
6. **Define critical flows for smoke mode** — set which 10 flows always run in smoke mode

The QA team's value shifts from mechanical execution to quality strategy — deciding _what_ matters and _why_, not _how_ to automate it.

---

_Document version 1.0 — covers: 5-agent LangGraph pipeline, Mem0 3-scope memory, voice/mic testing (Web Speech API mock + getUserMedia injection), backend API contract/validation/auth testing, all frontend edge cases (overlays, lazy load, WebSockets, animations, file upload, auth), feature-scoped runs with blast-radius detection, test data isolation, React dashboard with 5 views, Docker deployment, 5-week rollout plan. Version 2.0 adds SaaS architecture (sections 23–26)._

---

## 22. GitHub Codebase Integration

### Why This Is Separate from CI/CD

CI/CD triggers (webhooks, run-on-push) are about **when** the system runs. This section is about **what the agents know** when they run. Giving agents read access to the source repo changes the quality of every output: specs are grounded in real validation logic, blast radius is computed from actual file diffs, and healed selectors are derived from current JSX — not guessed from DOM snapshots.

### Architecture

```
GitHub (source repo, read-only)
       │
       ▼
GitHub MCP Server              ← Official server: github/github-mcp-server
(runs as Docker sidecar)       ← Communicates via SSE transport on port 8080
       │
       ▼
@langchain/mcp-adapters        ← Bridges MCP tools → LangGraph ToolNode
(MultiServerMCPClient)
       │
       ▼
LangGraph agents               ← Tools available to: Scoper, Explorer, Test Case, Maintenance
```

The GitHub MCP Server is **not** embedded in your QA service container. It runs as a separate sidecar in Docker Compose. This keeps your QA service image lean and lets you update the MCP server independently.

### Auth: Fine-Grained PAT (Recommended over Classic PAT)

Create a fine-grained Personal Access Token in GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.

**Permissions to grant (nothing else):**

- Repository: `Contents` → Read-only
- Repository: `Metadata` → Read-only (required by GitHub for all fine-grained PATs)

**Scope:** Only the single app repo — not all repos under your org.

This is the minimal footprint. The token can read files and commits. It cannot write, open PRs, trigger actions, or read secrets.

### Docker Compose Update

```yaml
# Add to docker-compose.yml

services:
  github-mcp:
    image: ghcr.io/github/github-mcp-server:latest
    ports:
      - "8080:8080"
    environment:
      - GITHUB_PERSONAL_ACCESS_TOKEN=${GITHUB_TOKEN}
    command: ["--transport", "sse", "--port", "8080"]
    # No volumes needed — stateless, reads from GitHub API
    restart: unless-stopped
```

The QA service connects to it at `http://github-mcp:8080/sse` inside the Docker network.

### `src/tools/github.tools.ts` — Full Implementation

```typescript
// src/tools/github.tools.ts
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { StructuredTool } from "@langchain/core/tools";

let cachedTools: StructuredTool[] | null = null;
let mcpClient: MultiServerMCPClient | null = null;

/**
 * Returns typed GitHub MCP tools, initializing the MCP client on first call.
 * Tools are cached — the MCP connection is reused across agent nodes in a run.
 */
export async function getGithubTools(): Promise<StructuredTool[]> {
  if (cachedTools) return cachedTools;

  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      "[github.tools] GITHUB_TOKEN not set — codebase integration disabled",
    );
    return [];
  }

  mcpClient = new MultiServerMCPClient({
    mcpServers: {
      github: {
        transport: "sse",
        url: process.env.GITHUB_MCP_URL ?? "http://github-mcp:8080/sse",
      },
    },
  });

  cachedTools = await mcpClient.getTools();
  return cachedTools;
}

/**
 * Fetch a single file from the configured app repo.
 * Returns decoded UTF-8 string, or null if file not found or GitHub integration disabled.
 */
export async function fetchRepoFile(
  filePath: string,
  ref?: string,
): Promise<string | null> {
  const tools = await getGithubTools();
  const getFileContents = tools.find((t) => t.name === "get_file_contents");
  if (!getFileContents) return null;

  try {
    const result = await getFileContents.invoke({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: filePath,
      ref: ref ?? process.env.GITHUB_DEFAULT_BRANCH ?? "main",
    });

    if (!result?.content) return null;
    // GitHub API returns base64-encoded content
    return Buffer.from(result.content.replace(/\n/g, ""), "base64").toString(
      "utf-8",
    );
  } catch {
    return null;
  }
}

/**
 * List files in a directory of the configured app repo.
 * Returns array of { name, path, type } objects, or [] if unavailable.
 */
export async function listRepoDirectory(
  dirPath: string,
): Promise<Array<{ name: string; path: string; type: string }>> {
  const tools = await getGithubTools();
  const getFileContents = tools.find((t) => t.name === "get_file_contents");
  if (!getFileContents) return [];

  try {
    const result = await getFileContents.invoke({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      path: dirPath,
    });

    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

/**
 * Get changed files between two commits (or HEAD~1..HEAD by default).
 * Returns array of file paths that changed.
 */
export async function getChangedFiles(
  base?: string,
  head?: string,
): Promise<string[]> {
  const tools = await getGithubTools();
  const compareCommits = tools.find((t) => t.name === "compare_files");
  const listCommits = tools.find((t) => t.name === "list_commits");

  if (!compareCommits || !listCommits) return [];

  try {
    let resolvedBase = base;
    let resolvedHead = head;

    if (!resolvedBase || !resolvedHead) {
      const commits = await listCommits.invoke({
        owner: process.env.GITHUB_OWNER!,
        repo: process.env.GITHUB_REPO!,
        sha: process.env.GITHUB_DEFAULT_BRANCH ?? "main",
        per_page: 2,
      });
      if (!commits || commits.length < 2) return [];
      resolvedBase = commits[1].sha;
      resolvedHead = commits[0].sha;
    }

    const diff = await compareCommits.invoke({
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
      base: resolvedBase,
      head: resolvedHead,
    });

    return (diff?.files ?? []).map((f: any) => f.filename as string);
  } catch {
    return [];
  }
}

/**
 * Search for files in the repo matching a query.
 * Returns array of { path, score } objects — capped to avoid token overload.
 */
export async function searchRepoCode(
  query: string,
  maxResults = 5,
): Promise<Array<{ path: string }>> {
  const tools = await getGithubTools();
  const searchCode = tools.find((t) => t.name === "search_code");
  if (!searchCode) return [];

  try {
    const result = await searchCode.invoke({
      q: `repo:${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO} ${query}`,
    });
    return (result?.items ?? [])
      .slice(0, maxResults)
      .map((i: any) => ({ path: i.path }));
  } catch {
    return [];
  }
}

/**
 * Gracefully disconnect the MCP client. Call at end of run to clean up.
 */
export async function closeGithubTools(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    cachedTools = null;
  }
}
```

### Per-Agent Usage Reference

| Agent           | Tool Used                              | What It Fetches                  | Why                                                                                                 |
| --------------- | -------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Scoper (0)      | `getChangedFiles()`                    | Files changed since last commit  | Ground blast radius in real git diff, not memory guesses                                            |
| Explorer (1)    | `searchRepoCode()` + `fetchRepoFile()` | React Router config file         | Discover routes not yet linked in UI (feature flags, lazy routes)                                   |
| Test Case (2)   | `searchRepoCode()` + `fetchRepoFile()` | Zod/Yup validation schema files  | Edge cases based on actual constraints (min/max/regex), not DOM inference                           |
| Maintenance (4) | `fetchRepoFile()`                      | Broken component's `.tsx` source | Read `data-testid` and `aria-label` values directly from JSX — far more reliable than DOM snapshots |

### `src/memory/memory.schemas.ts` Additions

```typescript
// Add to AGENT_MEMORY_WRITES:
codebaseIntegration: [
  "Router config file path in repo (once found, cached)",
  "Component path for each spec (for Maintenance healer)",
  "Validation schema files per module",
  "Confirmed: codebase integration enabled/disabled",
],
```

### Graceful Degradation

The integration is fully optional. If `GITHUB_TOKEN` is not set, `getGithubTools()` returns `[]` and every agent falls back silently to its original DOM/memory-only behavior. No code paths break. This means you can ship the integration incrementally — enable it for one agent at a time and compare output quality.

```typescript
// Pattern used throughout:
const source = await fetchRepoFile(componentPath);
// If GitHub integration is off, source = null → agent skips codebase context step
if (source) {
  // use source in prompt
}
```

### Security Notes

- The PAT scope is `contents: read` only on the single app repo — it cannot write, cannot read other repos, cannot access secrets or Actions logs.
- The GitHub MCP server runs inside the Docker network and is not exposed externally.
- Never log the token. Use Docker secrets or `.env` (gitignored) — never hardcode.
- Rotate the token every 90 days (GitHub will email you before expiry).

---

_Document version 1.1 — adds: GitHub Codebase Integration (Section 22), GitHub MCP Server sidecar, `github.tools.ts` typed wrapper, per-agent codebase context (Scoper git diff, Explorer router discovery, Test Case validation schemas, Maintenance source-aware healing), graceful degradation pattern, fine-grained PAT setup._

---

## 23. SaaS Authentication & Authorization

### Why SaaS

AetherQA transitions from a single-team internal tool to a hosted SaaS product. Multiple organizations sign up, each gets isolated workspaces with their own runs, memory, and team members. This requires: user identity, organization-scoped data, role-based access, and secure token management.

### Auth Architecture

```
Browser (React dashboard)
    │
    ├── POST /auth/login          → { accessToken, refreshToken }
    ├── POST /auth/register       → { accessToken, refreshToken }
    ├── GET  /auth/google         → redirect to Google OAuth
    ├── GET  /auth/github         → redirect to GitHub OAuth
    │
    ▼
Express API Gateway
    │
    ├── authRequired middleware   → validates JWT, attaches user to req
    ├── orgRequired middleware    → validates org membership, attaches org to req
    ├── requireRole("admin")     → checks user's role in current org
    │
    ▼
All /api/* routes now receive req.user and req.org
```

### JWT Token Strategy

- **Access token:** Short-lived (15 min), signed with `JWT_SECRET`. Contains `{ userId, email, name }`. Sent as `Authorization: Bearer <token>`.
- **Refresh token:** Long-lived (7 days), signed with `JWT_REFRESH_SECRET`. Stored in `refresh_tokens` table as a bcrypt hash. Sent via `httpOnly` cookie.
- **Token rotation:** Every refresh request issues a new refresh token and revokes the old one. Detects reuse (stolen refresh tokens) by checking if a token was already revoked.

```typescript
// src/auth/jwt.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { config } from "../config.js";

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry,
  });
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiry,
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwtSecret) as JWTPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, config.jwtRefreshSecret) as { userId: string };
}

export async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function compareRefreshToken(
  token: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
```

### Password Handling

```typescript
// src/auth/password.ts
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### OAuth Flow (Google + GitHub)

Both providers follow the same pattern:

1. Dashboard redirects user to `GET /auth/{provider}` which redirects to the provider's consent screen
2. Provider redirects back to `GET /auth/{provider}/callback` with an authorization code
3. Server exchanges the code for provider tokens, fetches user profile
4. Server finds-or-creates the user in the `users` table
5. Server issues AetherQA JWT tokens and redirects to dashboard

```typescript
// src/auth/oauth.ts
export interface OAuthProfile {
  provider: "google" | "github";
  providerId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export async function exchangeGoogleCode(code: string): Promise<OAuthProfile> {
  // Exchange code → tokens via Google OAuth2 API
  // Fetch user info from https://www.googleapis.com/oauth2/v2/userinfo
  // Return normalized OAuthProfile
}

export async function exchangeGithubCode(code: string): Promise<OAuthProfile> {
  // Exchange code → tokens via GitHub OAuth API
  // Fetch user info from https://api.github.com/user
  // Fetch email from https://api.github.com/user/emails
  // Return normalized OAuthProfile
}
```

### Auth Routes

```typescript
// src/api/auth.routes.ts
import { Router } from "express";
import { z } from "zod";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  orgName: z.string().min(1).max(100).optional(),  // creates org on register
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/register — create user + optional org
router.post("/auth/register", async (req, res) => { /* ... */ });

// POST /auth/login — email + password
router.post("/auth/login", async (req, res) => { /* ... */ });

// POST /auth/refresh — rotate refresh token, issue new access token
router.post("/auth/refresh", async (req, res) => { /* ... */ });

// POST /auth/logout — revoke refresh token
router.post("/auth/logout", async (req, res) => { /* ... */ });

// POST /auth/forgot-password — send reset email
router.post("/auth/forgot-password", async (req, res) => { /* ... */ });

// POST /auth/reset-password — verify token + set new password
router.post("/auth/reset-password", async (req, res) => { /* ... */ });

// GET /auth/google — redirect to Google consent screen
router.get("/auth/google", (req, res) => { /* ... */ });

// GET /auth/google/callback — handle Google OAuth callback
router.get("/auth/google/callback", async (req, res) => { /* ... */ });

// GET /auth/github — redirect to GitHub consent screen
router.get("/auth/github", (req, res) => { /* ... */ });

// GET /auth/github/callback — handle GitHub OAuth callback
router.get("/auth/github/callback", async (req, res) => { /* ... */ });

// GET /auth/me — return current user profile
router.get("/auth/me", authRequired, async (req, res) => { /* ... */ });

export { router as authRouter };
```

### Middleware Stack

```typescript
// src/api/middleware.ts — updated for SaaS

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JWTPayload } from "../auth/jwt.js";
import { pool } from "../db/pool.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { id: string };
      org?: { id: string; slug: string; role: string; plan: string };
    }
  }
}

// Validate JWT and attach user to request
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { ...payload, id: payload.userId };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Validate org membership and attach org to request
// Reads org slug from X-Org-Slug header or :orgSlug route param
export async function orgRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: "Authentication required" }); return; }

  const slug = (req.headers["x-org-slug"] as string) ?? req.params["orgSlug"];
  if (!slug) { res.status(400).json({ error: "Organization slug required" }); return; }

  const result = await pool.query(
    `SELECT o.id, o.slug, o.plan, om.role
     FROM organizations o
     JOIN org_members om ON om.org_id = o.id
     WHERE o.slug = $1 AND om.user_id = $2`,
    [slug, req.user.id],
  );

  if (result.rows.length === 0) {
    res.status(403).json({ error: "Not a member of this organization" });
    return;
  }

  req.org = result.rows[0];
  next();
}

// Role-based access control
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.org) { res.status(403).json({ error: "Organization context required" }); return; }
    if (!roles.includes(req.org.role)) {
      res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
      return;
    }
    next();
  };
}
```

### RBAC Roles

| Role     | Trigger runs | View results | Approve specs | Manage memory | Invite members | Manage billing | Delete org |
| -------- | ------------ | ------------ | ------------- | ------------- | -------------- | -------------- | ---------- |
| `owner`  | Yes          | Yes          | Yes           | Yes           | Yes            | Yes            | Yes        |
| `admin`  | Yes          | Yes          | Yes           | Yes           | Yes            | No             | No         |
| `member` | Yes          | Yes          | Yes           | View only     | No             | No             | No         |

### Security Rules

- **Never store raw passwords** — always bcrypt with cost factor 12
- **Never log tokens** — not in server logs, not in error responses
- **Refresh token rotation** — every use issues a new token and revokes the old one
- **Refresh tokens stored as hashes** — if the DB is compromised, tokens can't be used
- **OAuth state parameter** — always validate to prevent CSRF in OAuth flows
- **Rate limit auth endpoints** — 5 attempts per minute per IP on login/register
- **Password reset tokens** — expire in 1 hour, single use, cryptographically random

---

## 24. Multi-Tenant Data Model

### Tenant Isolation Strategy

Every QA pipeline resource belongs to an organization. Isolation is enforced at the middleware level — all queries include `org_id`.

```
User ─── belongs to ──→ Organization (via org_members)
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                QA Runs   Memory    Usage Logs
                    │
              ┌─────┼─────┐
              ▼     ▼     ▼
          Test    API    Audit
         Results Results  Log
```

### Organization-Scoped Queries

All pipeline routes use the org from middleware:

```typescript
// Before (single-tenant):
const runId = uuid();
await db.query("INSERT INTO qa_runs (id, run_mode, ...) VALUES ($1, $2, ...)", [runId, mode]);

// After (multi-tenant):
const runId = uuid();
await db.query(
  "INSERT INTO qa_runs (id, org_id, run_mode, triggered_by, ...) VALUES ($1, $2, $3, $4, ...)",
  [runId, req.org.id, mode, req.user.id],
);
```

### Memory Isolation

Mem0 memory scoping changes from `qaUserId` to `orgId:userId`:

```typescript
// Before:
await userMemory.recall("critical flows", state.qaUserId);  // "default"

// After:
await userMemory.recall("critical flows", `${state.orgId}:${state.qaUserId}`);
```

Agent-scoped memory becomes org-scoped:

```typescript
// Before:
const AGENT_ID = "aetherqa-system";

// After:
function orgAgentId(orgId: string): string {
  return `aetherqa:${orgId}`;
}
```

This means each organization's agent builds its own knowledge base about their specific app — learned selectors, route structures, failure patterns, etc.

### Organization Lifecycle

1. **Registration:** User signs up → creates personal org (org name = user name, slug = auto-generated)
2. **Create org:** User creates a new org from dashboard → becomes owner
3. **Invite members:** Owner/admin sends email invite with secure token → invitee registers or logs in → joins org
4. **Switch orgs:** User can be a member of multiple orgs. Dashboard sidebar shows org switcher. `X-Org-Slug` header scopes all API calls.
5. **Delete org:** Owner only. Cascades to all runs, results, memory, invites.

### Org Routes

```typescript
// src/api/org.routes.ts

// GET    /orgs                     — list user's organizations
// POST   /orgs                     — create a new organization
// GET    /orgs/:slug               — get org details
// PATCH  /orgs/:slug               — update org (name, settings)
// DELETE /orgs/:slug               — delete org (owner only)
// GET    /orgs/:slug/members       — list members
// POST   /orgs/:slug/invite        — send invite email
// DELETE /orgs/:slug/members/:uid  — remove member (admin+)
// PATCH  /orgs/:slug/members/:uid  — change member role (admin+)
// POST   /orgs/accept-invite       — accept invite token
```

### Updated State Type

```typescript
// src/state.types.ts — additions
export const QARunState = Annotation.Root({
  // Run identity
  runId: Annotation<string>(),
  orgId: Annotation<string>(),         // ← NEW: organization scope
  qaUserId: Annotation<string>(),      // now the actual user ID, not "default"
  triggeredBy: Annotation<string>(),   // ← NEW: user who started the run
  // ... rest unchanged
});
```

### Usage Tracking

Every LLM call logs token counts to `usage_logs`:

```typescript
// Wrap the LLM invoke in each agent:
const response = await llm.invoke(messages);
const usage = response.response_metadata?.usage;

if (usage) {
  await db.query(
    `INSERT INTO usage_logs (org_id, run_id, agent, tokens_in, tokens_out, cost_usd)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      state.orgId,
      state.runId,
      "explorer",
      usage.prompt_tokens ?? 0,
      usage.completion_tokens ?? 0,
      calculateCost(usage),  // model-specific cost lookup
    ],
  );
}
```

### Plan Tiers (for billing UI — no payment processing in MVP)

| Plan   | Runs/month | Agents per run | Members | GitHub integration | Price    |
| ------ | ---------- | -------------- | ------- | ------------------ | -------- |
| Free   | 50         | All 5          | 3       | Yes                | $0       |
| Pro    | 500        | All 5          | 10      | Yes                | $49/mo   |
| Team   | Unlimited  | All 5          | 50      | Yes                | $199/mo  |

Enforcement: check `organizations.max_runs_month` before starting a run. Count runs this billing period. Return 402 if over limit.

---

## 25. SaaS Dashboard — Auth & Org Pages

### Auth Pages

All auth pages live under `dashboard/src/pages/auth/` and use the same design system — Instrument Sans, teal accent, warm off-white background.

#### Login (`Login.tsx`)

```
┌────────────────────────────────────────────────┐
│                                                │
│              AetherQA logo + tagline            │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Email                                   │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Password                                │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [        Sign in        ]  (accent button)    │
│                                                │
│  Forgot password?                              │
│                                                │
│  ──────────── or ────────────                  │
│                                                │
│  [ Continue with Google  ]  (outline button)   │
│  [ Continue with GitHub  ]  (outline button)   │
│                                                │
│  Don't have an account? Sign up                │
│                                                │
└────────────────────────────────────────────────┘
```

#### Register (`Register.tsx`)

Same layout as Login plus: Name field, Organization name field (optional — defaults to personal workspace), password strength indicator.

#### Forgot Password (`ForgotPassword.tsx`)

Email input + submit. Shows confirmation message after submit.

#### Reset Password (`ResetPassword.tsx`)

Reads token from URL query param. New password + confirm password inputs.

### Auth Context (Dashboard)

```typescript
// dashboard/src/lib/auth.ts
import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
  loginWithGithub: () => void;
}

// Access token stored in memory (not localStorage — XSS safe)
// Refresh token stored as httpOnly cookie (CSRF safe)
// On app load: call /auth/refresh to get a new access token
```

### API Client (Dashboard)

```typescript
// dashboard/src/lib/api.ts
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  // Attach current org slug
  const orgSlug = getCurrentOrgSlug();  // from org context
  if (orgSlug) headers["X-Org-Slug"] = orgSlug;

  const res = await fetch(`/api${path}`, { ...options, headers });

  // If 401, try refresh
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      return fetch(`/api${path}`, { ...options, headers });
    }
  }

  return res;
}
```

### Org Switcher

Appears in the dashboard sidebar below the AetherQA logo. Shows current org name with a dropdown to switch.

```
┌─────────────────────┐
│  ▼ Acme Corp        │  ← current org
│  ──────────────     │
│    Acme Corp    ✓   │
│    Personal         │
│    Side Project     │
│  ──────────────     │
│  + Create org       │
└─────────────────────┘
```

Switching orgs sets the `X-Org-Slug` header for all subsequent API calls and refetches dashboard data.

### Org Settings Page (`OrgSettings.tsx`)

Tabs: General | Members | Usage

- **General:** Org name, slug (read-only), plan tier, delete org (owner only)
- **Members:** List members with role badges, invite form (email + role select), remove/change role buttons
- **Usage:** Bar chart of runs this month vs. limit, table of token usage per agent

### Route Protection

```typescript
// dashboard/src/App.tsx — updated routing

function App() {
  return (
    <AuthProvider>
      <OrgProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/register" element={<Register />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />

            {/* Protected — requires auth + org */}
            <Route path="/app/*" element={
              <RequireAuth>
                <RequireOrg>
                  <DashboardLayout />
                </RequireOrg>
              </RequireAuth>
            } />
          </Routes>
        </BrowserRouter>
      </OrgProvider>
    </AuthProvider>
  );
}
```

### Audit Log

Every significant action writes to `audit_log`. Shown in Org Settings > Activity tab (admin+ only).

Actions tracked:
- `run.trigger`, `run.approve`, `run.cancel`
- `memory.delete`, `memory.add_flow`
- `member.invite`, `member.remove`, `member.role_change`
- `org.update`, `org.delete`

---

## 26. SaaS Rollout Plan

These weeks follow the existing Weeks 1–5 pipeline implementation. They can run in parallel with Month 2 hardening tasks.

### Week 6 — Authentication

**Goal:** Users can register, log in, and access the dashboard behind auth.

Tasks:

- [ ] Create `users`, `refresh_tokens` tables in schema.sql
- [ ] Implement `src/auth/jwt.ts` — sign, verify, refresh token rotation
- [ ] Implement `src/auth/password.ts` — bcrypt hash/compare
- [ ] Implement `src/api/auth.routes.ts` — register, login, logout, refresh, me
- [ ] Implement `authRequired` middleware and wire it to all `/api/*` routes
- [ ] Dashboard: Login page, Register page
- [ ] Dashboard: `AuthProvider` context + `apiFetch` wrapper with token management
- [ ] Dashboard: `RequireAuth` route guard — redirect to login if unauthenticated
- [ ] Rate-limit auth endpoints (5 attempts/min/IP)

**Validation:** User registers, logs in, sees dashboard. Unauthenticated requests to `/api/runs` return 401. Refresh token rotation works (access token expires, auto-refreshes).

---

### Week 7 — Multi-Tenancy & Organizations

**Goal:** Each user belongs to an organization. All pipeline data is org-scoped.

Tasks:

- [ ] Create `organizations`, `org_members`, `org_invites` tables
- [ ] Implement `src/api/org.routes.ts` — CRUD, members, invites
- [ ] Implement `orgRequired` and `requireRole` middleware
- [ ] Update `POST /runs` to write `org_id` and `triggered_by` on every run
- [ ] Update all `GET` endpoints to filter by `req.org.id`
- [ ] Update Mem0 scoping — agent memory keyed by org, user memory keyed by `orgId:userId`
- [ ] Add `orgId` to LangGraph state type
- [ ] Dashboard: Org Switcher in sidebar
- [ ] Dashboard: `OrgProvider` context — stores current org, provides `X-Org-Slug`
- [ ] Dashboard: Org Settings page — General + Members tabs
- [ ] Auto-create personal org on registration

**Validation:** Two users in different orgs trigger runs — each sees only their own data. Invite flow works end-to-end. Switching orgs shows different runs/memory.

---

### Week 8 — OAuth, Password Reset, Usage & Audit

**Goal:** Polish auth UX. Track usage. Audit trail.

Tasks:

- [ ] Implement `src/auth/oauth.ts` — Google + GitHub exchange handlers
- [ ] Add OAuth routes to `auth.routes.ts` — redirect + callback for each provider
- [ ] Dashboard: OAuth buttons on Login/Register pages
- [ ] Dashboard: `OAuthCallback.tsx` — handles redirect, stores tokens
- [ ] Implement password reset flow — forgot password email + reset endpoint
- [ ] Set up `nodemailer` transporter with SMTP config
- [ ] Dashboard: Forgot Password + Reset Password pages
- [ ] Create `audit_log`, `usage_logs` tables
- [ ] Implement audit log writes on significant actions
- [ ] Add LLM token usage tracking in each agent
- [ ] Dashboard: Usage tab in Org Settings (runs this month, token costs per agent)
- [ ] Implement plan-based run limits — check `max_runs_month` before starting a run

**Validation:** OAuth login works for Google and GitHub. Password reset email arrives and reset works. Usage page shows real token counts. Audit log records all tracked actions. Free plan user hits 50-run limit and sees a clear error.

---

### Post-Launch Hardening

- [ ] Add Stripe integration for paid plan upgrades (Pro, Team tiers)
- [ ] Add email verification flow (verify email after registration)
- [ ] Implement account deletion (GDPR compliance)
- [ ] Add SSO/SAML support for enterprise customers
- [ ] Add API key authentication for CI/CD integrations (headless runs without dashboard)
- [ ] Rate limiting per org (not just per IP)
- [ ] Add 2FA (TOTP) support
