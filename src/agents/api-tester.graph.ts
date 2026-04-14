// Agent 5 — API Tester
// Fetches the app's OpenAPI spec, diffs against last run, generates and executes
// contract/auth/validation tests. Runs in parallel with the UI pipeline from START.

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { agentMemory, sessionMemory } from "../memory/mem0.client.js";
import { RECALL_KEYS } from "../memory/memory.keys.js";
import { QARunStateType, ApiTestResult } from "../state.types.js";
import {
  apiRequest,
  computeSpecDiff,
  getAllEndpoints,
  generateContractTests,
  generateAuthTests,
  generateInputValidationTests,
  type ApiTest,
  type EndpointSchema,
  type SpecDiff,
} from "../tools/api.tools.js";
import { config } from "../config.js";

const llm = new ChatGoogleGenerativeAI({
  model: config.llmModel,
  maxOutputTokens: 6000,
});

// ─── Exported agent function ──────────────────────────────────────────────────

export async function runApiTester(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const memory = await agentMemory.recall(RECALL_KEYS.apiTester.agentContext);

  // Step 1: Fetch OpenAPI spec and diff against last run
  const { currentSpec, specDiff } = await fetchAndDiffSpec(
    state.targetUrl,
    memory,
    state.runId,
  );

  if (!currentSpec) {
    return { currentAgent: "apiTester", apiTestResults: [] };
  }

  // Step 2: Generate tests — focused on changed endpoints if spec changed
  const apiTests = await generateApiTests(
    state,
    currentSpec,
    specDiff,
    memory,
  );

  // Step 3: Execute tests against the target
  const apiTestResults = await runApiTests(apiTests, state.targetUrl);

  // Step 4: Save insights to memory
  await saveMemory(apiTestResults, state.runId);

  return { currentAgent: "apiTester", apiTestResults };
}

// ─── Step 1: fetch spec and diff ─────────────────────────────────────────────

async function fetchAndDiffSpec(
  targetUrl: string,
  agentCtx: string,
  runId: string,
): Promise<{
  currentSpec: Record<string, unknown> | null;
  specDiff: SpecDiff;
}> {
  let currentSpec: Record<string, unknown>;

  try {
    const res = await fetch(`${targetUrl}/api-docs/swagger.json`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    currentSpec = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn(
      "[api-tester] Could not fetch OpenAPI spec:",
      (err as Error).message,
    );
    return { currentSpec: null, specDiff: { type: "first-run", changes: [] } };
  }

  // Recover last spec from Mem0 (stored as JSON in memory string)
  let lastSpec: Record<string, unknown> | null = null;
  try {
    const jsonMatch = agentCtx.match(/\{[\s\S]*"openapi"[\s\S]*\}/);
    if (jsonMatch) lastSpec = JSON.parse(jsonMatch[0]);
  } catch {
    // No prior spec
  }

  const specDiff = lastSpec
    ? computeSpecDiff(lastSpec, currentSpec)
    : { type: "first-run" as const, changes: [] };

  await agentMemory.learn(
    `OpenAPI spec snapshot last run: ${JSON.stringify(currentSpec)}`,
  );

  await sessionMemory.save(
    `API spec diff: ${specDiff.type}, ${specDiff.changes.length} endpoint changes`,
    runId,
  );

  return { currentSpec, specDiff };
}

// ─── Step 2: generate tests ───────────────────────────────────────────────────

async function generateApiTests(
  state: QARunStateType,
  currentSpec: Record<string, unknown>,
  specDiff: SpecDiff,
  memory: string,
): Promise<ApiTest[]> {
  const allEndpoints = getAllEndpoints(currentSpec);
  const specChanged = specDiff.changes.length > 0;

  // If spec changed, prioritize changed endpoints; otherwise run full regression
  const endpointsToTest: EndpointSchema[] = specChanged
    ? allEndpoints.filter((ep) =>
        specDiff.changes.some(
          (c) => c.path === ep.path && c.method === ep.method,
        ),
      )
    : allEndpoints;

  const tests: ApiTest[] = [];

  for (const endpoint of endpointsToTest) {
    tests.push(...generateContractTests(endpoint));
    tests.push(...generateAuthTests(endpoint));
    tests.push(...generateInputValidationTests(endpoint));
  }

  // LLM-generated business logic edge cases
  if (endpointsToTest.length > 0) {
    try {
      const llmTests = await generateLLMEdgeCases(
        endpointsToTest,
        memory,
        state.runId,
      );
      tests.push(...llmTests);
    } catch (err) {
      console.warn(
        "[api-tester] LLM edge case generation failed:",
        (err as Error).message,
      );
    }
  }

  return tests;
}

async function generateLLMEdgeCases(
  endpoints: EndpointSchema[],
  memory: string,
  runId: string,
): Promise<ApiTest[]> {
  const response = await llm.invoke([
    {
      role: "system",
      content: `You generate additional API test cases as a JSON array. Each test:
{
  "testName": string,
  "method": string,
  "path": string,
  "requestBody": object | null,
  "headers": { "Content-Type": "application/json", "X-Test-Run": "true", ... },
  "expectedStatus": number | number[]
}

Rules:
- Always include X-Test-Run: true in headers
- Focus on business logic edge cases: boundary values, state conflicts, concurrency
- Do NOT repeat basic auth tests or missing-field tests
- Output ONLY a JSON array — no prose, no markdown outside the array

Known patterns from memory: ${memory}`,
    },
    {
      role: "user",
      content: `Generate business logic edge cases for:\n${JSON.stringify(
        endpoints.map((ep) => ({
          method: ep.method,
          path: ep.path,
          hasAuth: (ep.security as unknown[] | undefined)?.length ?? 0 > 0,
          hasBody: !!ep.requestBody,
        })),
        null,
        2,
      )}`,
    },
  ]);

  const content = response.content as string;
  const jsonMatch = content.match(/\[[\s\S]+\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as ApiTest[];
  } catch {
    return [];
  }
}

// ─── Step 3: execute tests ────────────────────────────────────────────────────

async function runApiTests(
  tests: ApiTest[],
  baseUrl: string,
): Promise<ApiTestResult[]> {
  const results: ApiTestResult[] = [];

  for (const test of tests) {
    const start = Date.now();
    try {
      await apiRequest(test.method, `${baseUrl}${test.path}`, {
        body: test.requestBody,
        headers: test.headers,
        expectStatus: test.expectedStatus,
        validateSchema: test.validateSchema,
      });

      const expectedCode = Array.isArray(test.expectedStatus)
        ? test.expectedStatus[0]
        : test.expectedStatus;

      results.push({
        endpoint: test.path,
        testName: test.testName,
        status: "pass",
        statusCode: expectedCode,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        endpoint: test.path,
        testName: test.testName,
        status: "fail",
        durationMs: Date.now() - start,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// ─── Step 4: save insights ────────────────────────────────────────────────────

async function saveMemory(
  results: ApiTestResult[],
  runId: string,
): Promise<void> {
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  await agentMemory.learn(
    `API test run: ${passCount} passed, ${failCount} failed of ${results.length} total`,
  );

  // Remember endpoints that returned 500 for future escalation
  const serverErrors = results.filter((r) =>
    r.errorMessage?.includes("500"),
  );
  for (const r of serverErrors) {
    await agentMemory.learn(
      `Endpoint ${r.endpoint} returned 500 — flag in future runs`,
    );
  }

  await sessionMemory.save(
    `API results run ${runId}: ${passCount}/${results.length} passed`,
    runId,
  );
}
