import { Annotation } from "@langchain/langgraph";

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface RouteContext {
  accessibilityTree: unknown;
  apiCalls: string[];
  webSockets: string[];
  screenshotPath: string;
  hasVoiceInput: boolean;
  hasFileUpload: boolean;
  hasInfiniteScroll: boolean;
  flows?: UserFlow[];
  specialFeatures?: string[];
  apiDependencies?: string[];
}

export interface UserFlow {
  name: string;
  steps: string[];
  expected: string;
  type: "UI" | "voice" | "fileUpload" | "API";
}

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
  content: string;
  testTypes: string[];
  autoApproved: boolean;
}

export interface GeneratedTest {
  specId: string;
  filepath: string;
  testType: "UI" | "voice" | "API";
}

export interface TestResult {
  specId: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  screenshotPath?: string;
  errorMessage?: string;
  failureTrace?: string;
}

export interface ApiTestResult {
  endpoint: string;
  testName: string;
  status: "pass" | "fail";
  statusCode?: number;
  durationMs: number;
  errorMessage?: string;
}

export interface HealedTest {
  specId: string;
  filepath: string;
  action: "healed" | "escalate";
  healAttempted: boolean;
  healExplanation?: string;
  errorMessage?: string;
  componentPath?: string;
}

export interface Escalation {
  specId: string;
  reason: string;
  errorMessage: string;
  screenshotPath?: string;
}

export interface CodebaseContext {
  routerSource?: string;
  routerFile?: string;
  validationSchemas?: Record<string, string>;
  fetchedAt: string;
}

// ─── LangGraph State ──────────────────────────────────────────────────────────

export const QARunState = Annotation.Root({
  // Run identity
  runId: Annotation<string>(),
  runMode: Annotation<"full" | "smoke" | "feature">(),
  targetUrl: Annotation<string>(),
  qaUserId: Annotation<string>(),

  // Feature scope (feature mode only)
  featureDescription: Annotation<string | null>(),
  scope: Annotation<FeatureScope | null>(),

  // Git diff (populated by Scoper in feature mode)
  gitDiff: Annotation<{ changedFiles: string[]; base: string; head: string } | null>(),

  // Agent outputs (flow through pipeline)
  rawBrowserData: Annotation<Record<string, RouteContext> | null>(),
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

  // Codebase context (populated by GitHub integration in Week 3)
  codebaseContext: Annotation<CodebaseContext | null>(),

  // Human gate
  specsApproved: Annotation<boolean>(),

  // Control
  currentAgent: Annotation<string>(),
  errors: Annotation<string[]>(),
  startedAt: Annotation<string>(),
});

export type QARunStateType = typeof QARunState.State;
