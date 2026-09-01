import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requirePermission } from "../middleware/authorize";
import { recordAudit } from "../services/audit.service";

export const academicYearsRouter = Router();
export const semestersRouter = Router();

academicYearsRouter.use(authenticate, requireRole("administrator", "landlady"));
semestersRouter.use(authenticate, requireRole("administrator", "landlady"));

// ---------------------------------------------------------------------------
// Academic Years
// ---------------------------------------------------------------------------
academicYearsRouter.get("/", async (_req, res) => {
  const years = await prisma.academicYear.findMany({ include: { semesters: true }, orderBy: { label: "desc" } });
  res.json(years);
});

const yearSchema = z.object({ label: z.string().min(4).max(20) }); // e.g. "2024/2025"

academicYearsRouter.post("/", requirePermission("manage_settings"), async (req: AuthenticatedRequest, res) => {
  const parsed = yearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "label is required, e.g. '2024/2025'." } });
  }
  const existing = await prisma.academicYear.findUnique({ where: { label: parsed.data.label } });
  if (existing) {
    return res.status(409).json({ error: { code: "ALREADY_EXISTS", message: "This academic year already exists." } });
  }
  const year = await prisma.academicYear.create({ data: parsed.data });
  await recordAudit({ actorId: req.user!.id, action: "academic_year.created", entityType: "AcademicYear", entityId: year.id });
  res.status(201).json(year);
});

// ---------------------------------------------------------------------------
// Semesters - includes `type` (regular | recess), which is what
// getCurrentFeeForStudent() uses to find the right fee.
// ---------------------------------------------------------------------------
semestersRouter.get("/", async (req, res) => {
  const academicYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined;
  const semesters = await prisma.semester.findMany({
    where: { academicYearId },
    include: { academicYear: true },
    orderBy: [{ academicYear: { label: "desc" } }, { startDate: "asc" }],
  });
  res.json(semesters);
});

const semesterSchema = z.object({
  academicYearId: z.string().uuid(),
  label: z.string().min(1).max(40), // e.g. "Semester 1", "Recess"
  type: z.enum(["regular", "recess"]).default("regular"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

semestersRouter.post("/", requirePermission("manage_settings"), async (req: AuthenticatedRequest, res) => {
  const parsed = semesterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const year = await prisma.academicYear.findUnique({ where: { id: parsed.data.academicYearId } });
  if (!year) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Academic year not found." } });

  const semester = await prisma.semester.create({
    data: {
      academicYearId: parsed.data.academicYearId,
      label: parsed.data.label,
      type: parsed.data.type,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    },
  });
  await recordAudit({ actorId: req.user!.id, action: "semester.created", entityType: "Semester", entityId: semester.id });
  res.status(201).json(semester);
});
