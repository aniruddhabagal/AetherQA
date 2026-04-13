// Agent 2 — Test Case Generator
// Generates human-reviewable Markdown specs from Explorer app context.
// Graph pauses after this agent (interruptAfter: ["testcase"] in orchestrator).

import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as fs from "fs/promises";
import * as path from "path";
import { agentMemory, userMemory } from "../memory/mem0.client.js";
import { getGithubTools } from "../tools/github.tools.js";
import { RECALL_KEYS } from "../memory/memory.keys.js";
import { QARunState, QARunStateType, TestSpec } from "../state.types.js";
import { config } from "../config.js";

const llm = new ChatGoogleGenerativeAI({
  model: config.llmModel,
  maxOutputTokens: 6000,
});

// ─── Node: recallPreferences ──────────────────────────────────────────────────

async function recallPreferences(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const [agentCtx, userCtx] = await Promise.all([
    agentMemory.recall(RECALL_KEYS.testcase.agentContext),
    userMemory.recall(RECALL_KEYS.testcase.userPreferences, state.qaUserId),
  ]);
  return { agentMemory: agentCtx, userMemory: userCtx, currentAgent: "testcase" };
}

// ─── Node: fetchValidationLogic ───────────────────────────────────────────────
// Week 3: reads Zod schemas from GitHub to generate schema-accurate edge cases.
// In Week 2, GitHub tools return empty — this node is a no-op.

async function fetchValidationLogic(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const ghTools = await getGithubTools();
  if (ghTools.length === 0) return {}; // GitHub not configured — skip

  const searchCode = ghTools.find((t) => t.name === "search_code");
  const getFileContents = ghTools.find((t) => t.name === "get_file_contents");

  if (!searchCode || !getFileContents) return {};

  const schemaSearch = await searchCode.invoke({
    q: `repo:${config.github.owner}/${config.github.repo} z.object schema validation filename:*.ts`,
  });

  const schemaFiles = (
    (schemaSearch as { items?: Array<{ path: string }> })?.items ?? []
  ).slice(0, 5);

  const schemas: Record<string, string> = {};

  for (const file of schemaFiles) {
    const result = await getFileContents.invoke({
      owner: config.github.owner,
      repo: config.github.repo,
      path: file.path,
    });
    if ((result as { content?: string })?.content) {
      schemas[file.path] = Buffer.from(
        (result as { content: string }).content,
        "base64",
      ).toString("utf-8");
    }
  }

  if (Object.keys(schemas).length === 0) return {};

  return {
    codebaseContext: {
      ...(state.codebaseContext ?? { fetchedAt: new Date().toISOString() }),
      validationSchemas: schemas,
    },
  };
}

// ─── Node: generateSpecs ──────────────────────────────────────────────────────

async function generateSpecs(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  if (!state.appContext || Object.keys(state.appContext).length === 0) {
    console.warn("[testcase] No app context available — returning empty specs");
    return { testSpecs: [], specsApproved: false };
  }

  const codebaseSection = state.codebaseContext?.validationSchemas
    ? `\n\nActual validation schemas from source code:\n${Object.entries(
        state.codebaseContext.validationSchemas,
      )
        .map(([file, src]) => `// ${file}\n${src}`)
        .join("\n\n---\n\n")}

IMPORTANT: Generate edge cases based on THESE actual schema constraints — not inferred from the DOM.
Example: if a field is z.string().min(3).max(50), generate tests for len=2, len=3, len=50, len=51.`
    : "";

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a QA spec writer. You write clear, human-reviewable test specifications in Markdown.

Each spec uses this format:

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
${codebaseSection}

Output ONLY a valid JSON array — no markdown wrapper, no commentary. Each element:
{
  "id": "tc-001",
  "title": "Short spec title",
  "module": "module-name",
  "bucket": "feature" | "regression",
  "content": "<full Markdown spec>",
  "testTypes": ["UI"] | ["voice"] | ["API"] | ["UI", "API"],
  "autoApproved": false | true
}`,
    },
    {
      role: "user",
      content: `Generate comprehensive test specs for this app context:

${JSON.stringify(state.appContext, null, 2)}
${state.scope ? `\nFeature scope: ${JSON.stringify(state.scope, null, 2)}` : ""}

Rules:
- Scoped/new routes → "feature" bucket, autoApproved: false
- Blast radius / regression routes → "regression" bucket, autoApproved: true
- If a route has voice input → generate an additional separate voice error-state spec
- Every form must have: happy path + all required fields missing + invalid types
- Every auth-protected route must have: unauthorized + wrong role specs
- IDs must be sequential: "tc-001", "tc-002", etc.

Return ONLY the JSON array.`,
    },
  ]);

  let specs: TestSpec[] = [];

  try {
    const raw = (response.content as string).trim();
    const json = raw.startsWith("```")
      ? raw.replace(/```(?:json)?\n?/g, "").trim()
      : raw;
    const parsed = JSON.parse(json) as unknown[];

    specs = parsed.map((item, idx) => {
      const s = item as Partial<TestSpec>;
      return {
        id: s.id ?? `tc-${String(idx + 1).padStart(3, "0")}`,
        title: s.title ?? `Spec ${idx + 1}`,
        module: s.module ?? "unknown",
        bucket: s.bucket === "regression" ? "regression" : "feature",
        content: s.content ?? "",
        testTypes: Array.isArray(s.testTypes) ? s.testTypes : ["UI"],
        autoApproved: s.autoApproved === true,
      };
    });
  } catch {
    console.error("[testcase] Failed to parse LLM spec output — returning empty specs");
    specs = [];
  }

  // Write spec Markdown files to disk
  for (const spec of specs) {
    const dir = path.join("tests", "specs", spec.bucket);
    await fs.mkdir(dir, { recursive: true });
    const safeName = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await fs.writeFile(path.join(dir, `${spec.id}-${safeName}.md`), spec.content);
  }

  // Write durable spec patterns to Mem0
  if (specs.length > 0) {
    await agentMemory.learn(
      `Generated ${specs.length} specs for run ${state.runId}: ${specs
        .map((s) => s.title)
        .join(", ")}`,
    );
  }

  return { testSpecs: specs, specsApproved: false };
}

// ─── Graph ────────────────────────────────────────────────────────────────────

const testCaseGraph = new StateGraph(QARunState)
  .addNode("recallPreferences", recallPreferences)
  .addNode("fetchValidationLogic", fetchValidationLogic)
  .addNode("generateSpecs", generateSpecs)
  .addEdge(START, "recallPreferences")
  .addEdge("recallPreferences", "fetchValidationLogic")
  .addEdge("fetchValidationLogic", "generateSpecs")
  .addEdge("generateSpecs", END);

export const runTestCase = testCaseGraph.compile();
