import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { router } from "./api/routes.js";
import { authRouter } from "./api/auth.routes.js";
import { authRequired, requestLogger, errorHandler } from "./api/middleware.js";
import { initCheckpointer } from "./orchestrator.graph.js";
import { config } from "./config.js";

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin:
      config.nodeEnv === "development"
        ? ["http://localhost:3001", "http://localhost:5173"]
        : process.env["DASHBOARD_ORIGIN"] ?? "http://localhost:3001",
    credentials: true,
  }),
);

// ─── Body & cookie parsing ────────────────────────────────────────────────────

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────────────────────

app.use(requestLogger);

// ─── Rate limiters ────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for login/register — 5 attempts per minute per IP
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a minute." },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);

// ─── Health check (public) ────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aetherqa", version: "1.0.0" });
});

// ─── Auth routes (public — no authRequired) ───────────────────────────────────

app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth", authRouter);

// ─── API routes (require valid JWT) ──────────────────────────────────────────

app.use("/api", authRequired, router);

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
