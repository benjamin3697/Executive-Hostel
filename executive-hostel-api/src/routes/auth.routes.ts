import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  hashPassword, verifyPassword, signAccessToken,
  generateRefreshToken, hashToken, refreshTokenExpiry,
} from "../lib/auth";
import { sendPasswordResetEmail } from "../lib/mailer";
import { sendPasswordResetSms } from "../lib/sms";
import { REGISTRATION_NUMBER_REGEX } from "../lib/validation";
import { recordAudit } from "../services/audit.service";

export const authRouter = Router();

// Login/register are the highest-value brute-force targets in this system -
// throttle harder than the rest of the API (docs Section 9).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
});

const registerSchema = z.object({
  fullName: z.string().min(2).max(150),
  registrationNumber: z.string().regex(REGISTRATION_NUMBER_REGEX, "Registration number must be exactly 10 digits (e.g. 2301600084 - the first 2 digits are your entry year)."),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must agree to the Hostel Rules and Regulations." }) }),
}).refine((d) => d.email || d.phone, { message: "Provide an email or phone number." });

// Self-registration always creates a `student` account. Administrator,
// landlady, and chairperson accounts are provisioned by an existing
// administrator (see me.routes.ts / a future admin/users route) -
// never through this public endpoint.
authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const { fullName, registrationNumber, email, phone, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any },
  });
  if (existing) {
    return res.status(409).json({ error: { code: "ALREADY_EXISTS", message: "An account with this email or phone already exists." } });
  }
  const existingReg = await prisma.student.findUnique({ where: { registrationNumber } });
  if (existingReg) {
    return res.status(409).json({ error: { code: "ALREADY_EXISTS", message: "This registration number is already registered." } });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const u = await tx.user.create({
      data: { email, phone, passwordHash, role: "student" },
    });
    await tx.student.create({
      data: { userId: u.id, fullName, registrationNumber, email, phone, status: "applicant", termsAcceptedAt: new Date() },
    });
    return u;
  });

  await recordAudit({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id });

  res.status(201).json({ id: user.id, role: user.role });
});

const loginSchema = z.object({
  identifier: z.string().min(2), // email or phone
  password: z.string().min(1),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide identifier and password." } });
  }
  const { identifier, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
    include: { permissions: true },
  });

  // Same generic error whether the account doesn't exist or the password is
  // wrong - don't leak which one it was.
  const genericError = { error: { code: "INVALID_CREDENTIALS", message: "Incorrect email/phone or password." } };
  if (!user || !user.isActive) {
    return res.status(401).json(genericError);
  }

  // Per-account lockout (docs Section 57) - independent of the IP-based
  // authLimiter above, so rotating IPs doesn't bypass it.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({
      error: { code: "ACCOUNT_LOCKED", message: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` },
    });
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    const lockingNow = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockingNow ? 0 : attempts, // reset counter once a lockout is applied
        lockedUntil: lockingNow ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : undefined,
      },
    });
    await recordAudit({
      actorId: user.id,
      action: lockingNow ? "auth.account_locked" : "auth.login_failed",
      entityType: "User", entityId: user.id,
    });
    return res.status(401).json(genericError);
  }

  // Successful login clears any prior failed-attempt count.
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    permissions: user.permissions.map((p: { permissionKey: string }) => p.permissionKey),
  });

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiry() },
  });

  await recordAudit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });

  res.json({ accessToken, refreshToken, role: user.role });
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

authRouter.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "refreshToken is required." } });
  }
  const tokenHash = hashToken(parsed.data.refreshToken);
  const record = await prisma.refreshToken.findFirst({
    where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    include: { user: { include: { permissions: true } } },
  });
  if (!record) {
    return res.status(401).json({ error: { code: "TOKEN_INVALID", message: "Refresh token is invalid or expired. Please log in again." } });
  }

  // Rotate: revoke the used token, issue a new one. Limits the blast radius
  // if a refresh token is ever intercepted.
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
  const newRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: record.userId, tokenHash: hashToken(newRefreshToken), expiresAt: refreshTokenExpiry() },
  });

  const accessToken = signAccessToken({
    sub: record.user.id,
    role: record.user.role,
    permissions: record.user.permissions.map((p: { permissionKey: string }) => p.permissionKey),
  });

  res.json({ accessToken, refreshToken: newRefreshToken });
});

authRouter.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(parsed.data.refreshToken) },
      data: { revoked: true },
    });
  }
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Password reset (docs Section 57). Two-step: request generates a token
// tied to the account; confirm consumes it to set a new password.
//
// IMPORTANT: this deliberately does NOT return the reset token in the API
// response, and always returns the same generic success message whether or
// not the account exists - both are there to prevent account enumeration on
// a public, unauthenticated endpoint.
//
// Delivery: email via Resend if the account has one on file, otherwise SMS
// via Africa's Talking to the phone number on file (lib/mailer.ts,
// lib/sms.ts). If neither provider is configured (blank API keys), the
// message is logged to the server console instead of sent - fine for local
// dev, not for production.
// ---------------------------------------------------------------------------
const resetRequestSchema = z.object({ identifier: z.string().min(2) });
const RESET_TOKEN_TTL_MINUTES = 60;

authRouter.post("/password-reset/request", authLimiter, async (req, res) => {
  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Provide an email or phone number." } });
  }
  const genericResponse = { message: "If an account exists for that email or phone, a password reset link has been sent." };

  const user = await prisma.user.findFirst({ where: { OR: [{ email: parsed.data.identifier }, { phone: parsed.data.identifier }] } });
  if (!user || !user.isActive) {
    // Same response either way - don't reveal whether the account exists.
    return res.json(genericResponse);
  }

  const token = generateRefreshToken(); // reuses the same secure-random-token helper; unrelated token *type*, same generation approach
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000) },
  });
  await recordAudit({ actorId: user.id, action: "auth.password_reset_requested", entityType: "User", entityId: user.id });

  if (user.email) {
    await sendPasswordResetEmail(user.email, token);
  } else if (user.phone) {
    await sendPasswordResetSms(user.phone, token);
  }

  res.json(genericResponse);
});

const resetConfirmSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

authRouter.post("/password-reset/confirm", authLimiter, async (req, res) => {
  const parsed = resetConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
  });
  if (!record) {
    return res.status(400).json({ error: { code: "TOKEN_INVALID", message: "This reset link is invalid or has expired. Request a new one." } });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { used: true } });
    // Revoke every existing session - if someone else triggered this reset
    // maliciously, this cuts off the legitimate owner's stale tokens too,
    // but that's the safer failure mode: force a fresh login everywhere.
    await tx.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } });
  });

  await recordAudit({ actorId: record.userId, action: "auth.password_reset_completed", entityType: "User", entityId: record.userId });

  res.json({ message: "Password updated. Please log in with your new password." });
});
