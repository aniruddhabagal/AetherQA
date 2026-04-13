import type { Request, Response, NextFunction } from "express";
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
