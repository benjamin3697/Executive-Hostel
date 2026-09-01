import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { approveApplication, decideApplication, ApplicationError } from "../services/application.service";
import { REGISTRATION_NUMBER_REGEX } from "../lib/validation";
import { hashPassword } from "../lib/auth";

export const applicationsRouter = Router();

function handleApplicationError(err: unknown, res: any) {
  if (err instanceof ApplicationError) {
    const status = err.code === "NOT_FOUND" ? 404 : 409;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

// A public form is an easy target for spam submissions - throttle it.
const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many applications submitted from this connection. Try again later or contact the hostel directly." } },
});

// ---------------------------------------------------------------------------
// PUBLIC: submit an application (docs Section 36)
// ---------------------------------------------------------------------------
const applySchema = z.object({
  fullName: z.string().min(2).max(150),
  university: z.string().max(150).optional(),
  registrationNumber: z.string().regex(REGISTRATION_NUMBER_REGEX, "Registration number must be exactly 10 digits (e.g. 2301600084).").optional(),
  course: z.string().max(150).optional(),
  yearOfStudy: z.number().int().min(1).max(8).optional(),
  semesterId: z.string().uuid().optional(),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  preferredSectionId: z.string().uuid().optional(),
  preferredRoomTypeId: z.string().uuid().optional(),
  expectedCheckinDate: z.string().datetime().optional(),
  emergencyContact: z.string().max(150).optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must agree to the Hostel Rules and Regulations to apply." }) }),
});

applicationsRouter.post("/", applyLimiter, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const { termsAccepted, password, ...applicationFields } = parsed.data;
  const application = await prisma.application.create({
    data: {
      ...applicationFields,
      passwordHash: await hashPassword(password),
      expectedCheckinDate: parsed.data.expectedCheckinDate ? new Date(parsed.data.expectedCheckinDate) : undefined,
      university: parsed.data.university ?? "Soroti University",
      termsAcceptedAt: new Date(),
    },
  });
  res.status(201).json({ id: application.id, status: application.status });
});

// ---------------------------------------------------------------------------
// ADMIN: list & review
// ---------------------------------------------------------------------------
applicationsRouter.use(authenticate);

const listQuerySchema = z.object({
  status: z.enum(["submitted", "under_review", "approved", "rejected", "waitlisted", "cancelled"]).optional(),
  section: z.string().uuid().optional(), // preferredSectionId
  roomType: z.string().uuid().optional(), // preferredRoomTypeId
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

applicationsRouter.get("/", requireRole("administrator", "landlady"), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters." } });
  }
  const { status, section, roomType, page, pageSize } = parsed.data;
  const where = { status, preferredSectionId: section, preferredRoomTypeId: roomType };

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where, orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
  ]);

  res.json({ total, page, pageSize, applications: applications.map(({ passwordHash: _passwordHash, ...safeApplication }) => safeApplication) });
});

applicationsRouter.get("/:id", requireRole("administrator", "landlady"), async (req, res) => {
  const application = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!application) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Application not found." } });
  const { passwordHash: _passwordHash, ...safeApplication } = application;
  res.json(safeApplication);
});

// ---------------------------------------------------------------------------
// POST /applications/:id/approve - the interesting one: provisions a real
// student account so the admin can immediately hand off to
// POST /rooms/:id/assign (already built) with the returned studentId.
// ---------------------------------------------------------------------------
applicationsRouter.post("/:id/approve", requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await approveApplication({ applicationId: req.params.id, reviewedBy: req.user!.id });
    res.json(result);
  } catch (err) {
    handleApplicationError(err, res);
  }
});

const decisionSchema = z.object({
  decision: z.enum(["under_review", "rejected", "waitlisted", "cancelled"]),
});

applicationsRouter.post("/:id/decision", requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "decision must be one of under_review, rejected, waitlisted, cancelled. Use /approve for approval." } });
  }
  try {
    const updated = await decideApplication({ applicationId: req.params.id, decision: parsed.data.decision, reviewedBy: req.user!.id });
    res.json(updated);
  } catch (err) {
    handleApplicationError(err, res);
  }
});
