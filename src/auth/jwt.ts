import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { config } from "../config.js";

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
}

export interface RefreshPayload {
  userId: string;
  jti: string;
}

export function signAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiry as StringValue,
  });
}

export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign({ userId, jti }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiry as StringValue,
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwtSecret) as JWTPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as RefreshPayload;
}
