// What each agent stores and recalls from Mem0.
// These are canonical descriptions used to guide the agents' memory operations.

// AGENT scope — permanent system knowledge, never expires
export const AGENT_MEMORY_WRITES = {
  explorer: [
    "Known user flows in the app",
    "Overlay patterns (cookie banners, modals, banners)",
    "Auth patterns and redirect URLs",
    "Known fixture IDs for dynamic routes (e.g. /lessons/:id → lesson_42)",
    "Lazy-loaded routes and their scroll triggers",
    "WebSocket / SSE endpoints",
    "Codebase router file path and registered routes",
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
} as const;

// SESSION scope — per run-id, cleaned up after run completes
export const SESSION_MEMORY_WRITES = {
  explorer: "Accessibility snapshot of each scoped route this run",
  scoper: "Feature scope JSON — routes, blast radius, skip list",
  automation: "Which tests passed/failed this run",
  apiTester: "OpenAPI diff result this run",
} as const;

// USER scope — per QA engineer, persists indefinitely
export const USER_MEMORY_WRITES = {
  preferences: "Formatting preferences, BDD vs TDD style",
  alwaysReview: "Flows this QA always wants to manually sign off",
  alwaysRunRegression: "Specific regression suites that must always run",
  criticalFlows: "Critical flows to run in smoke mode",
} as const;
