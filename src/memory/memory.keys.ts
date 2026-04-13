// Canonical query strings used when recalling from Mem0.
// Using consistent keys ensures recall hits relevant memories across runs.

export const RECALL_KEYS = {
  explorer: {
    agentContext:
      "known user flows overlay patterns auth patterns fixture IDs lazy load routes websocket endpoints",
    routerFile: "codebase router file registered routes feature-flagged routes",
  },
  testcase: {
    agentContext:
      "approved spec patterns rejected spec examples blast radius relationships flows always need human review",
    userPreferences: "formatting preferences always review flows",
  },
  automation: {
    agentContext:
      "selector strategies auth setup stable tests failed generation",
    voiceFixtures: "voice test fixture expected outcome",
  },
  maintenance: {
    agentContext:
      "elements frequently change self-heal patterns real bugs flaky tests",
    componentPaths: "component path for spec",
  },
  apiTester: {
    agentContext:
      "OpenAPI spec snapshot last run endpoints 500 auth scopes async webhook patterns",
  },
  scoper: {
    agentContext:
      "all known modules routes user flows API endpoints blast radius relationships",
    scopeCache: "scope for feature:",
  },
  smoke: {
    criticalFlows: "critical flows always run smoke",
  },
} as const;
