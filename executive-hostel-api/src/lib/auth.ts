import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "./env";

// ---- Passwords ----
// argon2id: the recommended variant, resistant to both GPU-cracking and side-channel attacks.
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// ---- JWT access tokens ----
export interface AccessTokenPayload {
  sub: string; // user id
  role: string;
  permissions: string[];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // jsonwebtoken's types want a `StringValue` literal (e.g. "15m") rather than
  // a plain string for expiresIn, even though a plain string is what it
  // actually accepts at runtime - cast at this one boundary rather than
  // weakening env.ts's typing everywhere else.
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessTtl as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

// ---- Refresh tokens ----
// Refresh tokens are opaque random strings; only their hash is stored in the DB
// (RefreshToken.tokenHash), so a leaked database dump doesn't hand out live sessions.
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + env.jwtRefreshTtlDays);
  return d;
}
