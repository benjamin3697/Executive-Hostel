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

academicYearsRouter.patch("/:id", requirePermission("manage_settings"), async (req: AuthenticatedRequest, res) => {
  const parsed = yearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "label is required, e.g. '2024/2025'." } });
  const existing = await prisma.academicYear.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Academic year not found." } });
  const duplicate = await prisma.academicYear.findFirst({ where: { label: parsed.data.label, id: { not: existing.id } } });
  if (duplicate) return res.status(409).json({ error: { code: "ALREADY_EXISTS", message: "This academic year already exists." } });
  const updated = await prisma.academicYear.update({ where: { id: existing.id }, data: parsed.data });
  await recordAudit({ actorId: req.user!.id, action: "academic_year.updated", entityType: "AcademicYear", entityId: existing.id, previousValue: existing, newValue: updated });
  res.json(updated);
});

academicYearsRouter.delete("/:id", requirePermission("manage_settings"), async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.academicYear.findUnique({ where: { id: req.params.id }, include: { semesters: true } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Academic year not found." } });
  const feeCount = await prisma.accommodationFee.count({ where: { academicYearId: existing.id } });
  if (existing.semesters.length || feeCount) {
    return res.status(409).json({ error: { code: "IN_USE", message: "This academic year cannot be deleted while it has semesters or fees. Edit it instead, or remove those records first." } });
  }
  await prisma.academicYear.delete({ where: { id: existing.id } });
  await recordAudit({ actorId: req.user!.id, action: "academic_year.deleted", entityType: "AcademicYear", entityId: existing.id, previousValue: existing });
  res.status(204).send();
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

const semesterUpdateSchema = semesterSchema.partial().omit({ academicYearId: true });

semestersRouter.patch("/:id", requirePermission("manage_settings"), async (req: AuthenticatedRequest, res) => {
  const parsed = semesterUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  const existing = await prisma.semester.findUnique({ where: { id: req.params.id }, include: { academicYear: true } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Semester not found." } });
  const updated = await prisma.semester.update({
    where: { id: existing.id },
    data: { ...parsed.data, startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined, endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined },
    include: { academicYear: true },
  });
  await recordAudit({ actorId: req.user!.id, action: "semester.updated", entityType: "Semester", entityId: existing.id, previousValue: existing, newValue: updated });
  res.json(updated);
});

semestersRouter.delete("/:id", requirePermission("manage_settings"), async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.semester.findUnique({ where: { id: req.params.id }, include: { academicYear: true } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Semester not found." } });
  const [studentCount, paymentCount, feeCount, applicationCount] = await Promise.all([
    prisma.student.count({ where: { semesterId: existing.id } }),
    prisma.payment.count({ where: { semesterId: existing.id } }),
    prisma.accommodationFee.count({ where: { semesterId: existing.id } }),
    prisma.application.count({ where: { semesterId: existing.id } }),
  ]);
  if (studentCount || paymentCount || feeCount || applicationCount) {
    return res.status(409).json({ error: { code: "IN_USE", message: "This semester cannot be deleted while it has students, payments, fees, or applications linked to it." } });
  }
  await prisma.semester.delete({ where: { id: existing.id } });
  await recordAudit({ actorId: req.user!.id, action: "semester.deleted", entityType: "Semester", entityId: existing.id, previousValue: existing });
  res.status(204).send();
});
