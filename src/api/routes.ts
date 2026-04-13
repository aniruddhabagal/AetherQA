import { Router } from "express";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { qaGraph } from "../orchestrator.graph.js";
import { agentMemory } from "../memory/mem0.client.js";
import { sseManager } from "./sse.js";
import { config } from "../config.js";

const router = Router();

// ─── Input schemas ────────────────────────────────────────────────────────────

const StartRunSchema = z.object({
  targetUrl: z.string().url().optional(),
  runMode: z.enum(["full", "smoke", "feature"]).default("full"),
  featureDescription: z.string().optional(),
  qaUserId: z.string().default("default"),
  autoApproveBlastRadius: z.boolean().default(true),
});

const ApproveSpecsSchema = z.object({
  approvedSpecs: z.array(z.unknown()),
});

// ─── POST /runs — start a new QA run ─────────────────────────────────────────

router.post("/runs", async (req, res) => {
  const parsed = StartRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const {
    targetUrl = config.defaultTargetUrl,
    runMode,
    featureDescription,
    qaUserId,
  } = parsed.data;

  const runId = uuid();
  const initialState = {
    runId,
    runMode,
    targetUrl,
    featureDescription: featureDescription ?? null,
    qaUserId,
    specsApproved: false,
    agentMemory: "",
    sessionMemory: "",
    userMemory: "",
    errors: [],
    startedAt: new Date().toISOString(),
    scope: null,
    gitDiff: null,
    rawBrowserData: null,
    appContext: null,
    testSpecs: null,
    approvedSpecs: null,
    generatedTests: null,
    testResults: null,
    apiTestResults: null,
    healedTests: null,
    escalations: null,
    codebaseContext: null,
    currentAgent: "",
  };

  // Run the graph asynchronously
  void (async () => {
    try {
      const stream = await qaGraph.stream(initialState, {
        configurable: { thread_id: runId },
      });
      for await (const chunk of stream) {
        sseManager.broadcast(runId, { type: "agent_update", data: chunk });
      }
      sseManager.broadcast(runId, { type: "run_complete", runId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sseManager.broadcast(runId, { type: "error", error: message });
    }
  })();

  res.json({ runId, status: "started" });
});

// ─── POST /runs/:runId/approve — resume after human spec review ───────────────

router.post("/runs/:runId/approve", async (req, res) => {
  const { runId } = req.params;
  const parsed = ApproveSpecsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { approvedSpecs } = parsed.data;

  try {
    await qaGraph.updateState(
      { configurable: { thread_id: runId } },
      { specsApproved: true, approvedSpecs },
    );

    void (async () => {
      try {
        const stream = await qaGraph.stream(null, {
          configurable: { thread_id: runId },
        });
        for await (const chunk of stream) {
          sseManager.broadcast(runId, { type: "agent_update", data: chunk });
        }
        sseManager.broadcast(runId, { type: "run_complete", runId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sseManager.broadcast(runId, { type: "error", error: message });
      }
    })();

    res.json({ status: "resumed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ─── GET /runs/:runId/stream — SSE stream for dashboard ──────────────────────

router.get("/runs/:runId/stream", (req, res) => {
  const { runId } = req.params;
  const unsubscribe = sseManager.pipe(runId, res);
  req.on("close", unsubscribe);
});

// ─── GET /runs/:runId/results — full run state ────────────────────────────────

router.get("/runs/:runId/results", async (req, res) => {
  const { runId } = req.params;
  try {
    const state = await qaGraph.getState({
      configurable: { thread_id: runId },
    });
    res.json(state.values ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: message });
  }
});

// ─── GET /memory/agent — memory inspector ────────────────────────────────────

router.get("/memory/agent", async (req, res) => {
  const query = (req.query["query"] as string | undefined) ?? "all";
  const memories = await agentMemory.recall(query);
  res.json({ memories });
});

// ─── DELETE /memory/:memoryId — delete a memory entry ────────────────────────

router.delete("/memory/:memoryId", async (req, res) => {
  const { memoryId } = req.params;
  await agentMemory.forget(memoryId);
  res.json({ deleted: true });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aetherqa", version: "1.0.0" });
});

export { router };
