// Agent 4 — Maintenance
// Triages test failures: escalates known real bugs immediately, attempts to
// self-heal selector/locator breakages using the current DOM and React source,
// and records outcomes in Mem0 for compounding improvement.

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { chromium } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import { agentMemory, sessionMemory } from "../memory/mem0.client.js";
import { RECALL_KEYS } from "../memory/memory.keys.js";
import { getGithubTools } from "../tools/github.tools.js";
import {
  QARunStateType,
  HealedTest,
  Escalation,
  TestResult,
} from "../state.types.js";
import { config } from "../config.js";

const llm = new ChatGoogleGenerativeAI({
  model: config.llmModel,
  maxOutputTokens: 6000,
});

// ─── Internal types ───────────────────────────────────────────────────────────

interface TriagedFailure extends TestResult {
  filepath: string;
  route: string;
  componentPath?: string;
  action: "heal" | "escalate" | "escalate-uncertain";
  confidence?: number;
  explanation?: string;
  healAttempted?: boolean;
  healExplanation?: string;
}

// ─── Exported agent function ──────────────────────────────────────────────────

export async function runMaintenance(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const memory = await agentMemory.recall(RECALL_KEYS.maintenance.agentContext);

  const failures = (state.testResults ?? []).filter(
    (r) => r.status === "fail",
  );

  if (failures.length === 0) {
    // All tests passed — record clean run
    await agentMemory.learn(
      `Clean run ${state.runId}: all ${state.testResults?.length ?? 0} tests passed`,
    );
    return {
      currentAgent: "maintenance",
      healedTests: [],
      escalations: [],
    };
  }

  // Step 1: Triage each failure
  const triaged = await triageFailures(failures, state, memory);

  // Step 2: Attempt to heal selector-type failures
  const healedTests = await healSelectors(triaged, state, memory);

  // Step 3: Collect escalations from failures that weren't healed
  const escalations = collectEscalations(triaged);

  // Step 4: Persist memory
  await saveMemory(healedTests, escalations, state.runId);

  return {
    currentAgent: "maintenance",
    healedTests,
    escalations,
  };
}

// ─── Step 1: triage ───────────────────────────────────────────────────────────

async function triageFailures(
  failures: TestResult[],
  state: QARunStateType,
  memory: string,
): Promise<TriagedFailure[]> {
  const triaged: TriagedFailure[] = [];

  for (const failure of failures) {
    // Look up generated test filepath by specId
    const generatedTest = (state.generatedTests ?? []).find(
      (g) => g.specId === failure.specId,
    );
    const filepath = generatedTest?.filepath ?? "";

    // Derive route from specId (best-effort — agents can improve this heuristic)
    const route = deriveRouteFromSpecId(failure.specId, memory);

    // Check Mem0 for known real bugs matching this error signature
    const knownBugMemory = await agentMemory.recall(
      `real bug ${failure.errorMessage?.slice(0, 80) ?? ""}`,
    );

    if (knownBugMemory.toLowerCase().includes("real bug") && knownBugMemory.includes(failure.specId)) {
      triaged.push({
        ...failure,
        filepath,
        route,
        action: "escalate",
        explanation: "Known real bug from memory — skip heal attempt",
      });
      continue;
    }

    // Retrieve component path from memory if previously resolved
    const componentPathMemory = await agentMemory.recall(
      `${RECALL_KEYS.maintenance.componentPaths} ${failure.specId}`,
    );
    const componentPathMatch = componentPathMemory.match(
      /Component path for [^:]+:\s*(\S+)/,
    );
    const componentPath = componentPathMatch?.[1];

    // Ask LLM to classify the failure
    let action: TriagedFailure["action"] = "escalate-uncertain";
    let confidence = 0;
    let explanation = "LLM classification unavailable";

    try {
      const assessment = await llm.invoke([
        {
          role: "system",
          content: `You classify Playwright test failures. Output JSON only:
{ "type": "selector" | "logic" | "network" | "realBug", "confidence": 0-100, "explanation": string }

- "selector": a locator/getByRole/getByLabel is broken because the UI changed (self-healable)
- "logic": test assertion logic is wrong (self-healable with care)
- "network": flaky network / timeout (retry, not a code issue)
- "realBug": the app itself is broken (escalate immediately)

Be conservative — when in doubt, classify as "realBug" to avoid masking production issues.`,
        },
        {
          role: "user",
          content: `Test: ${failure.specId}
Error: ${failure.errorMessage ?? ""}
Trace: ${(failure.failureTrace ?? "").slice(0, 600)}`,
        },
      ]);

      const parsed = JSON.parse(assessment.content as string) as {
        type: string;
        confidence: number;
        explanation: string;
      };

      confidence = parsed.confidence;
      explanation = parsed.explanation;

      if (parsed.type === "selector" && confidence >= 70) {
        action = "heal";
      } else if (parsed.type === "realBug" || confidence < 40) {
        action = "escalate";
        await agentMemory.learn(
          `Real bug: ${failure.errorMessage?.slice(0, 200) ?? ""} — escalate always`,
        );
      } else {
        action = "escalate-uncertain";
      }
    } catch (err) {
      console.warn("[maintenance] LLM triage failed:", (err as Error).message);
    }

    triaged.push({
      ...failure,
      filepath,
      route,
      componentPath,
      action,
      confidence,
      explanation,
    });
  }

  return triaged;
}

// ─── Step 2: self-heal ────────────────────────────────────────────────────────

async function healSelectors(
  triaged: TriagedFailure[],
  state: QARunStateType,
  _memory: string,
): Promise<HealedTest[]> {
  const toHeal = triaged.filter((f) => f.action === "heal" && f.filepath);
  const healed: HealedTest[] = [];

  const ghTools = await getGithubTools();
  const getFileContents = ghTools.find((t) => t.name === "get_file_contents");

  for (const failure of toHeal) {
    // Read the broken test file
    let originalCode: string;
    try {
      originalCode = await fs.readFile(failure.filepath, "utf-8");
    } catch {
      // File missing — escalate
      triaged.find((f) => f.specId === failure.specId)!.action = "escalate";
      continue;
    }

    // Capture current DOM accessibility snapshot for the relevant route
    let currentSnapshot: unknown = null;
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`${state.targetUrl}${failure.route}`);
      await page.waitForLoadState("networkidle");
      // page.accessibility is available in Playwright but typed loosely
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currentSnapshot = await (page as any).accessibility?.snapshot() ?? null;
      await browser.close();
    } catch (err) {
      console.warn("[maintenance] DOM snapshot failed:", (err as Error).message);
    }

    // Optionally fetch the React component source from GitHub
    let componentSource = "";
    if (getFileContents && failure.componentPath) {
      try {
        const result = await getFileContents.invoke({
          owner: process.env.GITHUB_OWNER,
          repo: process.env.GITHUB_REPO,
          path: failure.componentPath,
        });
        if ((result as any)?.content) {
          componentSource = Buffer.from(
            (result as any).content,
            "base64",
          ).toString("utf-8");
        }
      } catch {
        // GitHub unavailable — proceed with DOM snapshot only
      }
    }

    // Ask LLM to fix the selectors
    let fixedCode = "";
    let changesExplained = "";
    let resolvedComponentPath = failure.componentPath ?? "";

    try {
      const healResponse = await llm.invoke([
        {
          role: "system",
          content: `You fix broken Playwright selectors.
Rules:
- ONLY change selectors — never change test logic or assertions
- Prefer data-testid attributes over text/role when available in component source
- Prefer getByRole over getByText for semantic elements
- Output JSON: { "fixedCode": string, "changesExplained": string, "componentPath": string }
  where componentPath is the likely React file path (empty string if unknown)`,
        },
        {
          role: "user",
          content: `Broken test:
${originalCode}

Error: ${failure.errorMessage ?? ""}
Failure trace: ${(failure.failureTrace ?? "").slice(0, 400)}

Current DOM snapshot:
${JSON.stringify(currentSnapshot ?? {}, null, 2).slice(0, 2000)}
${
  componentSource
    ? `\nReact component source (use this as ground truth for selectors):\n${componentSource.slice(0, 3000)}`
    : ""
}`,
        },
      ]);

      const parsed = JSON.parse(healResponse.content as string) as {
        fixedCode: string;
        changesExplained: string;
        componentPath: string;
      };

      fixedCode = parsed.fixedCode;
      changesExplained = parsed.changesExplained;
      if (parsed.componentPath) {
        resolvedComponentPath = parsed.componentPath;
        await agentMemory.learn(
          `Component path for ${failure.specId}: ${resolvedComponentPath}`,
        );
      }
    } catch (err) {
      console.warn("[maintenance] LLM heal failed:", (err as Error).message);
      healed.push({
        specId: failure.specId,
        filepath: failure.filepath,
        action: "escalate",
        healAttempted: true,
        healExplanation: "LLM heal failed",
        errorMessage: failure.errorMessage,
        componentPath: resolvedComponentPath,
      });
      triaged.find((f) => f.specId === failure.specId)!.action = "escalate";
      continue;
    }

    // Write the healed test
    await fs.writeFile(failure.filepath, fixedCode);

    // Re-run to verify the fix
    const reRunStatus = await executeTest(failure.filepath, state.targetUrl);

    if (reRunStatus === "pass") {
      await agentMemory.learn(
        `Self-healed: ${failure.specId} — ${changesExplained}`,
      );
      healed.push({
        specId: failure.specId,
        filepath: failure.filepath,
        action: "healed",
        healAttempted: true,
        healExplanation: changesExplained,
        componentPath: resolvedComponentPath,
      });
    } else {
      // Healing didn't work — restore original and escalate
      await fs.writeFile(failure.filepath, originalCode);
      triaged.find((f) => f.specId === failure.specId)!.action = "escalate";
      healed.push({
        specId: failure.specId,
        filepath: failure.filepath,
        action: "escalate",
        healAttempted: true,
        healExplanation: `Heal attempted but re-run still failed: ${changesExplained}`,
        errorMessage: failure.errorMessage,
        componentPath: resolvedComponentPath,
      });
    }
  }

  return healed;
}

// ─── Step 3: collect escalations ─────────────────────────────────────────────

function collectEscalations(triaged: TriagedFailure[]): Escalation[] {
  return triaged
    .filter((f) => f.action === "escalate" || f.action === "escalate-uncertain")
    .map((f) => ({
      specId: f.specId,
      reason: f.explanation ?? "Unknown failure — requires human review",
      errorMessage: f.errorMessage ?? "",
      screenshotPath: f.screenshotPath,
    }));
}

// ─── Step 4: save memory ──────────────────────────────────────────────────────

async function saveMemory(
  healedTests: HealedTest[],
  escalations: Escalation[],
  runId: string,
): Promise<void> {
  const healedCount = healedTests.filter((h) => h.action === "healed").length;
  const escalatedCount = escalations.length;

  await agentMemory.learn(
    `Maintenance run ${runId}: ${healedCount} self-healed, ${escalatedCount} escalated`,
  );

  await sessionMemory.save(
    `Maintenance: ${healedCount} healed, ${escalatedCount} escalations`,
    runId,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveRouteFromSpecId(specId: string, memory: string): string {
  // Try to find a route associated with this spec from memory
  const routeMatch = memory.match(
    new RegExp(`spec[^\\n]*${specId}[^\\n]*route[^\\n]*(\/\\S+)`, "i"),
  );
  if (routeMatch) return routeMatch[1];

  // Fallback: derive from specId naming pattern (e.g. "login-001" → "/login")
  const parts = specId.toLowerCase().split(/[-_]/);
  if (parts.length > 0) return `/${parts[0]}`;

  return "/";
}

async function executeTest(
  filepath: string,
  targetUrl: string,
): Promise<"pass" | "fail"> {
  return new Promise((resolve) => {
    const relativePath = path.relative(process.cwd(), filepath);
    const child = spawn(
      "npx",
      ["playwright", "test", relativePath, "--reporter=line"],
      {
        env: { ...process.env, BASE_URL: targetUrl },
        stdio: "pipe",
      },
    );

    child.on("close", (code) => {
      resolve(code === 0 ? "pass" : "fail");
    });

    child.on("error", () => resolve("fail"));
  });
}
