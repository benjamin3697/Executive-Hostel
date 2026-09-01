import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requireSelfOrRole } from "../middleware/authorize";
import { recordAudit } from "../services/audit.service";
import { getStudentBalanceSummary } from "../services/payment.service";

export const studentsRouter = Router();
studentsRouter.use(authenticate);

// ---------------------------------------------------------------------------
// GET /students - admin/landlady search & filter (docs Section 48)
// Supports: q (name/reg/phone), section, roomType, status, year, course,
// semesterId, and paymentStatus (computed, not a DB column - see below).
// Each row includes a `payment` summary (fee/paid/balance/status) so the
// admin table can show "amount demanded" and "amount paid" without a
// separate request per student.
// ---------------------------------------------------------------------------
const listQuerySchema = z.object({
  q: z.string().optional(),
  section: z.string().optional(),
  roomType: z.string().optional(),
  status: z.enum(["applicant", "active", "checked_out", "suspended"]).optional(),
  year: z.coerce.number().int().optional(),
  course: z.string().optional(),
  semesterId: z.string().uuid().optional(),
  paymentStatus: z.enum(["fully_paid", "partially_paid", "outstanding", "no_active_accommodation"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100), // 100 comfortably covers the hostel's full 72-room capacity in one page
});

studentsRouter.get("/", requireRole("administrator", "landlady"), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters." } });
  }
  const { q, section, roomType, status, year, course, semesterId, paymentStatus, page, pageSize } = parsed.data;

  const where = {
    status,
    yearOfStudy: year,
    semesterId,
    course: course ? { contains: course, mode: "insensitive" as const } : undefined,
    currentRoom: (section || roomType) ? {
      section: section ? { name: section } : undefined,
      roomType: roomType ? { name: roomType } : undefined,
    } : undefined,
    OR: q ? [
      { fullName: { contains: q, mode: "insensitive" as const } },
      { registrationNumber: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q } },
    ] : undefined,
  };

  // paymentStatus is computed per-student (fee vs. verified payments), not
  // a stored column, so it can't be filtered in SQL. At this hostel's scale
  // (max ~72 active residents) we fetch the DB-filtered page, compute each
  // row's balance, then filter/report against that in-memory - simpler than
  // maintaining a denormalized status column that could drift out of sync
  // with the real payment data. Trade-off: combining paymentStatus with
  // pagination can return fewer than `pageSize` rows on a given page; not a
  // practical issue while total residents comfortably fit on one page.
  const students = await prisma.student.findMany({
    where,
    include: { currentRoom: { include: { section: true, roomType: true } }, semester: { include: { academicYear: true } } },
    orderBy: { fullName: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const withPayment = await Promise.all(
    students.map(async (s: { id: string }) => ({ ...s, payment: await getStudentBalanceSummary(s.id) }))
  );

  const filtered = paymentStatus
    ? withPayment.filter((s: { payment: { status: string } }) => s.payment.status === paymentStatus)
    : withPayment;

  const total = paymentStatus ? filtered.length : await prisma.student.count({ where });

  res.json({ total, page, pageSize, students: filtered });
});

// ---------------------------------------------------------------------------
// GET /students/:id - admin/landlady, or the student themself
// ---------------------------------------------------------------------------
async function ownerUserIdForStudentParam(req: AuthenticatedRequest): Promise<string | null> {
  const student = await prisma.student.findUnique({ where: { id: req.params.id }, select: { userId: true } });
  return student?.userId ?? null;
}

studentsRouter.get(
  "/:id",
  requireSelfOrRole(ownerUserIdForStudentParam, "administrator", "landlady"),
  async (req, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        currentRoom: { include: { section: true, roomType: true } },
        semester: { include: { academicYear: true } },
        guardians: true,
        payments: { orderBy: { submittedAt: "desc" }, take: 10 },
        assignments: { orderBy: { assignedAt: "desc" }, take: 10 },
      },
    });
    if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found." } });
    res.json(student);
  }
);

// ---------------------------------------------------------------------------
// PATCH /students/:id - admin-only fields (docs Section 27: room, fees,
// payment status, check-in/out dates, role are explicitly NOT editable
// through this route - those change only through their own dedicated
// endpoints/services, each with its own audit trail).
// ---------------------------------------------------------------------------
const adminUpdateSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  course: z.string().max(150).optional(),
  yearOfStudy: z.number().int().min(1).max(8).optional(),
  status: z.enum(["applicant", "active", "checked_out", "suspended"]).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  homeDistrict: z.string().max(100).optional(),
});

studentsRouter.patch("/:id", requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = adminUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const existing = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found." } });

  const updated = await prisma.student.update({ where: { id: req.params.id }, data: parsed.data });

  await recordAudit({
    actorId: req.user!.id,
    action: "student.admin_updated",
    entityType: "Student",
    entityId: existing.id,
    previousValue: existing,
    newValue: updated,
  });

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /students/:id/enroll - admin enrolls a student into a semester.
// This is what getCurrentFeeForStudent() and getStudentBalanceSummary()
// key off of - enrolling into a new semester resets which payments count
// toward the student's current balance (they scope to Payment.semesterId,
// which is stamped at submission time from this field).
// ---------------------------------------------------------------------------
const enrollSchema = z.object({ semesterId: z.string().uuid() });

studentsRouter.post("/:id/enroll", requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "semesterId is required." } });
  }
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found." } });

  const semester = await prisma.semester.findUnique({ where: { id: parsed.data.semesterId }, include: { academicYear: true } });
  if (!semester) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Semester not found." } });

  const updated = await prisma.student.update({ where: { id: student.id }, data: { semesterId: semester.id } });

  await recordAudit({
    actorId: req.user!.id, action: "student.enrolled",
    entityType: "Student", entityId: student.id,
    previousValue: { semesterId: student.semesterId },
    newValue: { semesterId: semester.id, semesterLabel: semester.label, academicYear: semester.academicYear.label },
  });

  res.json(updated);
});
