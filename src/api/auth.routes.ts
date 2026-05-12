import { Router } from "express";
import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/jwt.js";
import { authRequired } from "./middleware.js";
import type { Request, Response } from "express";

const router = Router();

const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100),
  orgName: z.string().min(1).max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: REFRESH_EXPIRY_MS,
    path: "/auth",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie("refreshToken", { path: "/auth" });
}

// ─── Token issuance ───────────────────────────────────────────────────────────

async function issueTokens(
  res: Response,
  userId: string,
  email: string,
  name: string,
): Promise<string> {
  const jti = uuid();
  const refreshToken = signRefreshToken(userId, jti);
  const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);

  await pool.query(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [jti, userId, tokenHash, expiresAt],
  );

  setRefreshCookie(res, refreshToken);
  return signAccessToken({ userId, email, name });
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password, name } = parsed.data;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
    [email, passwordHash, name],
  );
  const user = result.rows[0] as { id: string; email: string; name: string };

  const accessToken = await issueTokens(res, user.id, user.email, user.name);
  res.status(201).json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = result.rows[0] as
    | { id: string; email: string; name: string; password_hash: string | null }
    | undefined;

  if (!user || !user.password_hash) {
    // Constant-time response to prevent email enumeration
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const accessToken = await issueTokens(res, user.id, user.email, user.name);
  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies["refreshToken"] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  let payload: { userId: string; jti: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Rotate: atomically delete the old token and verify it existed
  const deleted = await pool.query(
    "DELETE FROM refresh_tokens WHERE id = $1 AND user_id = $2 AND token_hash = $3 AND expires_at > NOW() RETURNING id",
    [payload.jti, payload.userId, tokenHash],
  );

  if (deleted.rows.length === 0) {
    // Token reuse or expiry — revoke all tokens for this user as a precaution
    await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [payload.userId]);
    clearRefreshCookie(res);
    res.status(401).json({ error: "Refresh token invalid or already used" });
    return;
  }

  const userResult = await pool.query(
    "SELECT id, email, name FROM users WHERE id = $1",
    [payload.userId],
  );
  const user = userResult.rows[0] as { id: string; email: string; name: string } | undefined;
  if (!user) {
    clearRefreshCookie(res);
    res.status(401).json({ error: "User not found" });
    return;
  }

  const accessToken = await issueTokens(res, user.id, user.email, user.name);
  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies["refreshToken"] as string | undefined;

  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await pool.query("DELETE FROM refresh_tokens WHERE id = $1", [payload.jti]);
    } catch {
      // Token already invalid — ignore
    }
  }

  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", authRequired, async (req: Request, res: Response): Promise<void> => {
  const result = await pool.query(
    "SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1",
    [req.user!.userId],
  );
  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});

export { router as authRouter };
