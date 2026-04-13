import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { chromium, Page } from "playwright";
import { agentMemory, sessionMemory } from "../memory/mem0.client.js";
import { RECALL_KEYS } from "../memory/memory.keys.js";
import {
  dismissOverlays,
  takeScreenshot,
} from "../tools/playwright.tools.js";
import { getGithubTools } from "../tools/github.tools.js";
import { QARunState, QARunStateType, RouteContext } from "../state.types.js";
import { config } from "../config.js";

const llm = new ChatAnthropic({
  model: config.llmModel,
  maxTokens: 4000,
});

// ─── Node: recallMemory ───────────────────────────────────────────────────────

async function recallMemory(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const memory = await agentMemory.recall(RECALL_KEYS.explorer.agentContext);
  return { agentMemory: memory, currentAgent: "explorer" };
}

// ─── Node: browseApp ──────────────────────────────────────────────────────────

async function browseApp(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const routes =
    state.scope?.directScope.routes ?? (await inferRoutesFromMemory(state.agentMemory));

  // In full mode with no memory, start with root
  const targetRoutes = routes.length > 0 ? routes : ["/"];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: await resolveStorageState(),
  });

  const routeContexts: Record<string, RouteContext> = {};

  for (const route of targetRoutes) {
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

    try {
      await page.goto(`${state.targetUrl}${resolvedRoute}`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      await dismissOverlays(page, state.agentMemory);

      // page.ariaSnapshot() replaces the removed page.accessibility API (Playwright ≥ 1.46)
      const accessibilityTree = await page.ariaSnapshot();
      const screenshotPath = await takeScreenshot(page, state.runId, resolvedRoute);

      routeContexts[route] = {
        accessibilityTree,
        apiCalls: [...new Set(apiCalls)],
        webSockets: wsUrls,
        screenshotPath,
        hasVoiceInput: await detectVoiceInput(page),
        hasFileUpload: await detectFileUpload(page),
        hasInfiniteScroll: await detectInfiniteScroll(page),
      };
    } catch (err) {
      console.error(`Explorer: failed to browse ${route}:`, (err as Error).message);
      routeContexts[route] = {
        accessibilityTree: null,
        apiCalls: [],
        webSockets: [],
        screenshotPath: "",
        hasVoiceInput: false,
        hasFileUpload: false,
        hasInfiniteScroll: false,
      };
    }

    await page.close();
  }

  await context.close();
  await browser.close();

  return { rawBrowserData: routeContexts };
}

// ─── Node: enrichWithCodebase ─────────────────────────────────────────────────
// Week 3: reads React Router config from GitHub MCP to discover all registered routes.
// In Week 1, GitHub tools return empty — this node is a no-op.

async function enrichWithCodebase(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  const ghTools = await getGithubTools();
  if (ghTools.length === 0) return {}; // GitHub not configured — skip

  const getFileContents = ghTools.find((t) => t.name === "get_file_contents");
  const searchCode = ghTools.find((t) => t.name === "search_code");

  if (!getFileContents || !searchCode) return {};

  const routerSearch = await searchCode.invoke({
    q: `repo:${config.github.owner}/${config.github.repo} createBrowserRouter Routes filename:*.tsx`,
  });

  const routerFile = (routerSearch as any)?.items?.[0]?.path as string | undefined;
  let routerSource = "";

  if (routerFile) {
    const result = await getFileContents.invoke({
      owner: config.github.owner,
      repo: config.github.repo,
      path: routerFile,
    });
    routerSource = (result as any)?.content
      ? Buffer.from((result as any).content, "base64").toString("utf-8")
      : "";
  }

  if (routerFile) {
    await agentMemory.learn(
      `Codebase router file: ${routerFile} — contains all registered routes including feature-flagged ones`,
    );
  }

  return {
    codebaseContext: {
      routerSource,
      routerFile,
      fetchedAt: new Date().toISOString(),
    },
  };
}

// ─── Node: interpretContext ───────────────────────────────────────────────────

async function interpretContext(
  state: QARunStateType,
): Promise<Partial<QARunStateType>> {
  if (!state.rawBrowserData || Object.keys(state.rawBrowserData).length === 0) {
    return { appContext: {} };
  }

  const codebaseSection = state.codebaseContext?.routerSource
    ? `\n\nRouter source from codebase:\n${state.codebaseContext.routerSource}`
    : "";

  const response = await llm.invoke([
    {
      role: "system",
      content: `You map React app structures to named user flows for QA test generation.
From memory: ${state.agentMemory}
${codebaseSection}
Output ONLY valid JSON — an object keyed by route path.`,
    },
    {
      role: "user",
      content: `Map these routes to user flows:
${JSON.stringify(state.rawBrowserData, null, 2)}

For each route, produce:
{
  "<route>": {
    "flows": [{ "name": "...", "steps": ["..."], "expected": "...", "type": "UI|voice|fileUpload|API" }],
    "apiDependencies": ["GET /api/..."],
    "specialFeatures": ["voice", "infiniteScroll", "webSocket"]
  }
}

Return ONLY the JSON object.`,
    },
  ]);

  let appContext: Record<string, RouteContext> = {};

  try {
    const raw = (response.content as string).trim();
    const json = raw.startsWith("```")
      ? raw.replace(/```(?:json)?\n?/g, "").trim()
      : raw;
    const interpreted = JSON.parse(json) as Record<string, Partial<RouteContext>>;

    // Merge LLM interpretation with raw browser data
    for (const [route, ctx] of Object.entries(interpreted)) {
      appContext[route] = {
        ...(state.rawBrowserData[route] ?? {
          accessibilityTree: null,
          apiCalls: [],
          webSockets: [],
          screenshotPath: "",
          hasVoiceInput: false,
          hasFileUpload: false,
          hasInfiniteScroll: false,
        }),
        ...ctx,
      } as RouteContext;

      // Write durable facts to Mem0
      if (ctx.flows && ctx.flows.length > 0) {
        await agentMemory.learn(
          `Route ${route} has flows: ${JSON.stringify(ctx.flows.map((f) => f.name))}`,
        );
      }
      if (ctx.specialFeatures?.includes("voice")) {
        await agentMemory.learn(
          `Route ${route} has voice input — requires mic mock or audio injection`,
        );
      }
    }
  } catch {
    // LLM returned non-JSON — fall back to raw browser data
    appContext = state.rawBrowserData;
  }

  await sessionMemory.save(
    `Explored routes: ${JSON.stringify(Object.keys(appContext))}`,
    state.runId,
  );

  return { appContext };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveStorageState(): Promise<string | undefined> {
  const statePath = "tests/.auth/user.json";
  try {
    const { access } = await import("fs/promises");
    await access(statePath);
    return statePath;
  } catch {
    return undefined;
  }
}

async function detectVoiceInput(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const hasMicButton = !!document.querySelector(
      '[aria-label*="mic"], [aria-label*="voice"], [aria-label*="speak"]',
    );
    const w = window as unknown as Record<string, unknown>;
    const hasWebSpeech =
      typeof w["SpeechRecognition"] !== "undefined" ||
      typeof w["webkitSpeechRecognition"] !== "undefined";
    return hasMicButton || hasWebSpeech;
  });
}

async function detectFileUpload(page: Page): Promise<boolean> {
  return page.evaluate(
    () => !!document.querySelector('input[type="file"]'),
  );
}

async function detectInfiniteScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.body.scrollHeight > window.innerHeight * 3,
  );
}

function resolveRouteParams(route: string, memory: string): string {
  const knownIds: Record<string, string> = {};
  const matches = memory.match(/route param :(\w+) → (\w+)/g) ?? [];
  for (const m of matches) {
    const parts = m.match(/route param :(\w+) → (\w+)/);
    if (parts) knownIds[parts[1]] = parts[2];
  }
  return route.replace(/:(\w+)/g, (_, param: string) => knownIds[param] ?? "1");
}

async function inferRoutesFromMemory(memory: string): Promise<string[]> {
  const matches = memory.match(/Route (\/\S+) has flows/g) ?? [];
  return matches.map((m) =>
    m.replace("Route ", "").replace(" has flows", ""),
  );
}

// ─── Graph ────────────────────────────────────────────────────────────────────

const explorerGraph = new StateGraph(QARunState)
  .addNode("recallMemory", recallMemory)
  .addNode("browseApp", browseApp)
  .addNode("enrichWithCodebase", enrichWithCodebase)
  .addNode("interpretContext", interpretContext)
  .addEdge(START, "recallMemory")
  .addEdge("recallMemory", "browseApp")
  .addEdge("browseApp", "enrichWithCodebase")
  .addEdge("enrichWithCodebase", "interpretContext")
  .addEdge("interpretContext", END);

export const runExplorer = explorerGraph.compile();
