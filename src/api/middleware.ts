import type { Request, Response, NextFunction } from "express";
import type { Pool, PoolClient } from "pg";
import { config } from "../config.js";

// ─── Dashboard auth ───────────────────────────────────────────────────────────
// Simple bearer-token check for the dashboard. Not used in development mode.

export function dashboardAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (config.nodeEnv === "development") {
    next();
    return;
  }

  if (!config.dashboardSecret) {
    next();
    return;
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${config.dashboardSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

// ─── Error handler ────────────────────────────────────────────────────────────

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[error]", message, err);
  res.status(500).json({ error: message });
}

// ─── Request logger ───────────────────────────────────────────────────────────

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}

// ─── Test transaction middleware ──────────────────────────────────────────────
// Wraps requests tagged with X-Test-Run: true in a DB transaction that is always
// rolled back after the response, ensuring zero state pollution between tests.
// Reference implementation for the main backend — this file ships with AetherQA
// so QA teams can copy it directly.

export function testTransactionMiddleware(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (config.nodeEnv !== "test" || !req.headers["x-test-run"]) {
      next();
      return;
    }

    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (err) {
      next(err);
      return;
    }

    await client.query("BEGIN");

    // Attach the transaction client so controllers can use it
    (req as Request & { dbClient: PoolClient }).dbClient = client;

    // Always rollback after the response — test state is never persisted
    res.on("finish", () => {
      client
        .query("ROLLBACK")
        .catch((err: unknown) => {
          console.error("[test-tx] ROLLBACK failed:", err);
        })
        .finally(() => client.release());
    });

    next();
  };
}
