// Agent 3 — Automation
// Takes approved specs, generates Playwright .spec.ts files via LLM,
// executes them, and streams results to the dashboard via SSE.

import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import { agentMemory } from "../memory/mem0.client.js";
import { RECALL_KEYS } from "../memory/memory.keys.js";
import { sseManager } from "../api/sse.js";
import {
  QARunState,
  QARunStateType,
  GeneratedTest,
  TestResult,
} from "../state.types.js";
import { config } from "../config.js";

const llm = new ChatGoogleGenerativeAI({
  model: config.llmModel,
  maxOutputTokens: 8000,
});

// ─── System prompts ───────────────────────────────────────────────────────────

const UI_TEST_SYSTEM_PROMPT = `You write Playwright TypeScript tests.
RULES:
- Use ONLY getByRole, getByLabel, getByText, getByPlaceholder, getByTestId locators
- NEVER use CSS selectors, XPath, or nth-child
- Always waitForResponse on the triggered API call after form submissions
- Never use waitForTimeout — use explicit waits
- Each test must be fully isolated — call seedTestData() at the start
- Use storageState for auth — never re-login inside tests
- Import: import { test, expect } from "@playwright/test"
- Import seedTestData: import { seedTestData } from "../tools/db-seeder.tools"
- Start every test body with: await seedTestData("<scenario>");

Output ONLY a TypeScript code block — no explanation, no markdown commentary outside the code block.`;

const VOICE_TEST_SYSTEM_PROMPT = `You write Playwright TypeScript voice tests.
RULES:
- Always inject speech mock via injectSpeechMock() BEFORE page.goto()
- Import voice tools: import { injectSpeechMock, injectSpeechErrorMock } from "../../src/tools/voice.tools"
- Generate separate describe blocks for: happy path, no-speech error, not-allowed error, aborted
- Tests are tagged .voice.spec.ts — will run with workers: 1
- Never use parallel execution within voice test files
- Never use waitForTimeout — wait for specific responses or elements
- Call seedTestData() at the start of each test

Output ONLY a TypeScript code block — no explanation, no markdown commentary outside the code block.`;

const API_TEST_SYSTEM_PROMPT = `You write API integration tests using Node's native fetch.
RULES:
- Use native fetch — no browser, no Playwright page object
- Every test must include: happy path, missing required fields, wrong types, auth failure (401), wrong role (403)
- Use X-Test-Run: true header on all requests (triggers DB transaction rollback)
- Assert response body shape using explicit property checks
- Import: import { test, expect } from "@playwright/test"
- The BASE_URL is available via process.env.BASE_URL or "http://localhost:4000"

Output ONLY a TypeScript code block — no explanation, no markdown commentary outside the code block.`;

// ─── Node: recallMemory ───────────────────────────────────────────────────────

async function recallMemory(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const memory = await agentMemory.recall(RECALL_KEYS.automation.agentContext);
  return { agentMemory: memory, currentAgent: "automation" };
}

// ─── Node: generateTestCode ───────────────────────────────────────────────────

async function generateTestCode(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const specs = state.approvedSpecs ?? [];

  if (specs.length === 0) {
    console.warn("[automation] No approved specs — skipping code generation");
    return { generatedTests: [], currentAgent: "automation" };
  }

  await fs.mkdir("tests/generated", { recursive: true });

  const generatedTests: GeneratedTest[] = [];

  for (const spec of specs) {
    const isVoice = spec.testTypes.includes("voice");
    const isApi = spec.testTypes.includes("API");

    const systemPrompt = isVoice
      ? VOICE_TEST_SYSTEM_PROMPT
      : isApi
        ? API_TEST_SYSTEM_PROMPT
        : UI_TEST_SYSTEM_PROMPT;

    sseManager.broadcast(state.runId, {
      type: "agent_update",
      data: {
        agent: "automation",
        message: `Generating test code for: ${spec.title}`,
        specId: spec.id,
      },
    });

    let code = "";
    try {
      const response = await llm.invoke([
        {
          role: "system",
          content: `${systemPrompt}\n\nApp memory from prior runs:\n${state.agentMemory}`,
        },
        {
          role: "user",
          content: `Write a complete Playwright TypeScript test file for this spec:\n\n${spec.content}`,
        },
      ]);

      code = extractCodeBlock(response.content as string);
    } catch (err) {
      console.error(
        `[automation] LLM error generating ${spec.id}:`,
        (err as Error).message,
      );
      // Write a failing placeholder so the run doesn't silently skip
      code = buildPlaceholderTest(spec.id, spec.title, (err as Error).message);
    }

    const suffix = isVoice ? ".voice" : "";
    const safeName = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `${spec.id}-${safeName}${suffix}.spec.ts`;
    const filepath = path.join("tests", "generated", filename);

    await fs.writeFile(filepath, code);

    const testType: "UI" | "voice" | "API" = isVoice
      ? "voice"
      : isApi
        ? "API"
        : "UI";

    generatedTests.push({ specId: spec.id, filepath, testType });
  }

  await agentMemory.learn(
    `Run ${state.runId}: generated ${generatedTests.length} test files`,
  );

  return { generatedTests, currentAgent: "automation" };
}

// ─── Node: runTests ───────────────────────────────────────────────────────────

async function runTests(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const generated = state.generatedTests ?? [];

  if (generated.length === 0) {
    return { testResults: [], currentAgent: "automation" };
  }

  const resultsDir = path.join("runs", state.runId);
  await fs.mkdir(resultsDir, { recursive: true });

  const resultsJsonPath = path.join(resultsDir, "results.json");

  sseManager.broadcast(state.runId, {
    type: "agent_update",
    data: {
      agent: "automation",
      message: `Running ${generated.length} generated tests…`,
    },
  });

  // Run UI/API tests and voice tests separately to respect worker constraints.
  // Voice project uses workers:1 (mic mock is process-wide).
  const uiFiles = generated
    .filter((t) => t.testType !== "voice")
    .map((t) => t.filepath);
  const voiceFiles = generated
    .filter((t) => t.testType === "voice")
    .map((t) => t.filepath);

  await runPlaywright(uiFiles, resultsJsonPath, state.runId, false);
  await runPlaywright(voiceFiles, resultsJsonPath, state.runId, true);

  // Parse combined results
  const testResults = await parsePlaywrightResults(
    resultsJsonPath,
    state.runId,
  );

  // Broadcast individual results as they are read
  for (const result of testResults) {
    sseManager.broadcast(state.runId, {
      type: "test_result",
      data: result,
    });
  }

  return { testResults, currentAgent: "automation" };
}

// ─── Graph ────────────────────────────────────────────────────────────────────

const automationGraph = new StateGraph(QARunState)
  .addNode("recallMemory", recallMemory)
  .addNode("generateTestCode", generateTestCode)
  .addNode("runTests", runTests)
  .addEdge(START, "recallMemory")
  .addEdge("recallMemory", "generateTestCode")
  .addEdge("generateTestCode", "runTests")
  .addEdge("runTests", END);

export const runAutomation = automationGraph.compile();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCodeBlock(raw: string): string {
  // Strip ```typescript or ``` fences
  const fenced = raw.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Return as-is if no fence found (LLM returned plain code)
  return raw.trim();
}

function buildPlaceholderTest(
  specId: string,
  title: string,
  errorMessage: string,
): string {
  return `// Auto-generated placeholder — LLM code gen failed for ${specId}
// Error: ${errorMessage.slice(0, 200)}
import { test } from "@playwright/test";

test("${title} — generation failed", async () => {
  throw new Error("Test code generation failed: ${errorMessage.slice(0, 100).replace(/"/g, "'")}");
});
`;
}

/**
 * Spawn a Playwright test run and append JSON results to the results file.
 * Streams stdout/stderr to the SSE channel so the dashboard sees live output.
 */
async function runPlaywright(
  files: string[],
  resultsJsonPath: string,
  runId: string,
  voiceMode: boolean,
): Promise<void> {
  if (files.length === 0) return;

  const args = [
    "playwright",
    "test",
    ...files,
    "--reporter=json",
    `--output=runs/${runId}/artifacts`,
    voiceMode ? "--project=voice-tests" : "--project=ui-tests",
  ];

  return new Promise((resolve) => {
    const proc = spawn("npx", args, {
      shell: true,
      env: { ...process.env },
    });

    const outputChunks: string[] = [];

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      outputChunks.push(text);
      // Stream raw lines to SSE
      for (const line of text.split("\n").filter(Boolean)) {
        sseManager.broadcast(runId, {
          type: "test_output",
          data: { line, voiceMode },
        });
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split("\n").filter(Boolean)) {
        sseManager.broadcast(runId, {
          type: "test_output",
          data: { line, level: "stderr", voiceMode },
        });
      }
    });

    proc.on("close", async () => {
      // Playwright JSON reporter writes to stdout when --reporter=json
      const rawOutput = outputChunks.join("");
      try {
        // Find the JSON blob (Playwright may print logs before the JSON)
        const jsonStart = rawOutput.indexOf("{");
        if (jsonStart !== -1) {
          const jsonStr = rawOutput.slice(jsonStart);
          JSON.parse(jsonStr); // validate before writing
          await fs.writeFile(resultsJsonPath, jsonStr);
        }
      } catch {
        // Non-JSON output — ignore; parsePlaywrightResults handles missing file
      }
      resolve();
    });
  });
}

interface PlaywrightJsonResult {
  suites?: PlaywrightSuite[];
  stats?: { startTime?: string };
}

interface PlaywrightSuite {
  title?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

interface PlaywrightSpec {
  title?: string;
  id?: string;
  ok?: boolean;
  tests?: PlaywrightTest[];
}

interface PlaywrightTest {
  results?: Array<{
    status?: string;
    duration?: number;
    error?: { message?: string; stack?: string };
    attachments?: Array<{ name: string; path?: string; contentType: string }>;
  }>;
}

async function parsePlaywrightResults(
  resultsJsonPath: string,
  runId: string,
): Promise<TestResult[]> {
  let raw: PlaywrightJsonResult;
  try {
    const content = await fs.readFile(resultsJsonPath, "utf-8");
    raw = JSON.parse(content) as PlaywrightJsonResult;
  } catch {
    console.warn(`[automation] No results JSON at ${resultsJsonPath}`);
    return [];
  }

  const results: TestResult[] = [];

  function walkSuites(suites: PlaywrightSuite[], specIdPrefix: string): void {
    for (const suite of suites) {
      if (suite.suites) walkSuites(suite.suites, specIdPrefix);
      if (suite.specs) {
        for (const spec of suite.specs) {
          const testResult = spec.tests?.[0];
          const lastResult = testResult?.results?.[testResult.results.length - 1];

          const status =
            spec.ok === true
              ? "pass"
              : spec.ok === false
                ? "fail"
                : "skip";

          const screenshotAttachment = lastResult?.attachments?.find(
            (a) => a.name === "screenshot",
          );

          results.push({
            specId: spec.id ?? specIdPrefix,
            status: status as "pass" | "fail" | "skip",
            durationMs: lastResult?.duration ?? 0,
            screenshotPath: screenshotAttachment?.path,
            errorMessage: lastResult?.error?.message,
            failureTrace: lastResult?.error?.stack,
          });
        }
      }
    }
  }

  if (raw.suites) walkSuites(raw.suites, runId);

  return results;
}
