import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { router } from "./api/routes.js";
import { requestLogger, errorHandler } from "./api/middleware.js";
import { initCheckpointer } from "./orchestrator.graph.js";
import { config } from "./config.js";

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────

app.use(
  helmet({
    // SSE endpoints require no content-security-policy restrictions
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin:
      config.nodeEnv === "development"
        ? ["http://localhost:3001", "http://localhost:5173"]
        : process.env.DASHBOARD_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  }),
);

app.use(
  rateLimit({
    windowMs: 60_000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: "1mb" }));

// ─── Logging ──────────────────────────────────────────────────────────────────

app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api", router);

// ─── Error handling ───────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await initCheckpointer();
    console.log("[aetherqa] LangGraph checkpointer ready");
  } catch (err) {
    console.warn(
      "[aetherqa] Checkpointer init failed (is Postgres running?):",
      (err as Error).message,
    );
  }

  app.listen(config.port, () => {
    console.log(`[aetherqa] Service running on http://localhost:${config.port}`);
    console.log(`[aetherqa] Environment: ${config.nodeEnv}`);
    console.log(`[aetherqa] Default target: ${config.defaultTargetUrl}`);
  });
}

void start();
