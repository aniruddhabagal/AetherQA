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
      console.error(`[run:${runId}] Graph error:`, message);
      // Write error into the checkpoint so it shows up in GET /runs/:id/results
      try {
        await qaGraph.updateState(
          { configurable: { thread_id: runId } },
          { errors: [message] },
        );
      } catch {
        // updateState can fail if checkpoint was never written — ignore
      }
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

// ─── POST /api/test/seed — reference test data seeder ────────────────────────
// Provides isolated fixture data for each test run. Only active in test mode.
// Each scenario is wrapped in the transaction from testTransactionMiddleware
// (X-Test-Run: true header triggers auto-rollback after the response).
// This implementation covers AetherQA's own test infra. Main backend teams
// should copy this pattern into their own test.routes.ts.

const SEED_SCENARIOS: Record<
  string,
  (client: import("pg").PoolClient | null) => Promise<Record<string, string>>
> = {
  "lesson-with-pronunciation": async (client) => {
    if (!client) return { lessonId: "fixture-lesson-1", userId: "fixture-user-1" };
    const lesson = await client.query(
      "INSERT INTO lessons (title, type) VALUES ($1, $2) RETURNING id",
      ["Test Lesson", "pronunciation"],
    );
    const user = await client.query(
      "INSERT INTO users (email, role) VALUES ($1, $2) RETURNING id",
      ["test-pronunciation@qa.local", "student"],
    );
    return {
      lessonId: String(lesson.rows[0].id),
      userId: String(user.rows[0].id),
    };
  },
  "lesson-completed": async (client) => {
    if (!client) return { lessonId: "fixture-lesson-2", userId: "fixture-user-2" };
    const user = await client.query(
      "INSERT INTO users (email, role) VALUES ($1, $2) RETURNING id",
      ["test-completed@qa.local", "student"],
    );
    const lesson = await client.query(
      "INSERT INTO lessons (title, type, score) VALUES ($1, $2, $3) RETURNING id",
      ["Completed Lesson", "reading", 85],
    );
    await client.query(
      "INSERT INTO lesson_completions (user_id, lesson_id, score) VALUES ($1, $2, $3)",
      [user.rows[0].id, lesson.rows[0].id, 85],
    );
    return {
      lessonId: String(lesson.rows[0].id),
      userId: String(user.rows[0].id),
    };
  },
  "user-with-streak": async (client) => {
    if (!client) return { userId: "fixture-user-3", streak: "7" };
    const user = await client.query(
      "INSERT INTO users (email, streak_count) VALUES ($1, $2) RETURNING id",
      ["test-streak@qa.local", 7],
    );
    return { userId: String(user.rows[0].id), streak: "7" };
  },
  "user-streak-at-risk": async (client) => {
    if (!client) return { userId: "fixture-user-4", streak: "3", expiresAt: "" };
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const user = await client.query(
      "INSERT INTO users (email, streak_count, streak_expires_at) VALUES ($1, $2, $3) RETURNING id",
      ["test-streak-risk@qa.local", 3, expiresAt],
    );
    return { userId: String(user.rows[0].id), streak: "3", expiresAt };
  },
  "vocabulary-set-empty": async (client) => {
    if (!client) return { vocabSetId: "fixture-vocab-1" };
    const set = await client.query(
      "INSERT INTO vocabulary_sets (name, word_count) VALUES ($1, $2) RETURNING id",
      ["Empty Set", 0],
    );
    return { vocabSetId: String(set.rows[0].id) };
  },
  "vocabulary-set-full": async (client) => {
    if (!client) return { vocabSetId: "fixture-vocab-2" };
    const set = await client.query(
      "INSERT INTO vocabulary_sets (name, word_count) VALUES ($1, $2) RETURNING id",
      ["Full Set", 500],
    );
    return { vocabSetId: String(set.rows[0].id) };
  },
  "leaderboard-with-10-users": async (client) => {
    if (!client) return { count: "10", firstUserId: "" };
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const u = await client.query(
        "INSERT INTO users (email, score) VALUES ($1, $2) RETURNING id",
        [`leaderboard-${i}@qa.local`, (10 - i) * 100],
      );
      ids.push(String(u.rows[0].id));
    }
    return { count: "10", firstUserId: ids[0] ?? "" };
  },
  "premium-user": async (client) => {
    if (!client) return { userId: "fixture-user-premium", tier: "premium" };
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const user = await client.query(
      "INSERT INTO users (email, subscription_tier, subscription_expires_at) VALUES ($1, $2, $3) RETURNING id",
      ["test-premium@qa.local", "premium", expiresAt],
    );
    return { userId: String(user.rows[0].id), tier: "premium" };
  },
  "expired-subscription": async (client) => {
    if (!client) return { userId: "fixture-user-expired", tier: "premium", expiredAt: "" };
    const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const user = await client.query(
      "INSERT INTO users (email, subscription_tier, subscription_expires_at) VALUES ($1, $2, $3) RETURNING id",
      ["test-expired@qa.local", "premium", expiredAt],
    );
    return { userId: String(user.rows[0].id), tier: "premium", expiredAt };
  },
};

router.post("/test/seed", async (req, res) => {
  if (config.nodeEnv !== "test") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { scenario } = req.body as { scenario?: string };
  if (!scenario || typeof scenario !== "string") {
    res.status(400).json({ error: "scenario is required" });
    return;
  }

  const seeder = SEED_SCENARIOS[scenario];
  if (!seeder) {
    res.status(400).json({
      error: `Unknown scenario: "${scenario}"`,
      available: Object.keys(SEED_SCENARIOS),
    });
    return;
  }

  try {
    // Use the transaction client attached by testTransactionMiddleware if present,
    // otherwise fall back to null (seeder returns static fixture IDs)
    const dbClient =
      (req as unknown as { dbClient?: import("pg").PoolClient }).dbClient ?? null;
    const fixtures = await seeder(dbClient);
    res.json(fixtures);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ─── GET /health ──────────────────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aetherqa", version: "1.0.0" });
});

export { router };
