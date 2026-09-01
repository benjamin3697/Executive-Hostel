import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { recordAudit } from "../services/audit.service";
import { getStudentBalanceSummary } from "../services/payment.service";

export const meRouter = Router();
meRouter.use(authenticate);

meRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { student: { include: { currentRoom: { include: { section: true, roomType: true } }, guardians: true } } },
  });
  if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });

  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

// Fields a student is allowed to self-edit. Everything else in the Student
// model (room, status, verified payments, etc.) is intentionally excluded -
// see docs Section 27, "Administrator-Controlled Information".
const profileUpdateSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  course: z.string().max(150).optional(),
  yearOfStudy: z.number().int().min(1).max(8).optional(),
  homeDistrict: z.string().max(100).optional(),
  emergencyContactName: z.string().max(150).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
});

meRouter.patch("/profile", async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== "student") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only student accounts have a profile here." } });
  }
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student profile not found." } });

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: parsed.data,
  });

  await recordAudit({
    actorId: req.user!.id,
    action: "student.profile_updated",
    entityType: "Student",
    entityId: student.id,
    previousValue: student,
    newValue: updated,
  });

  res.json(updated);
});

// ---------------------------------------------------------------------------
// GET /me/dashboard - single aggregate call for the student dashboard
// (docs Section 28: room, payment summary, quick-action data) so the
// frontend isn't making 3+ round trips to render one screen.
// ---------------------------------------------------------------------------
meRouter.get("/dashboard", async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== "student") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only student accounts have a dashboard here." } });
  }
  const student = await prisma.student.findUnique({
    where: { userId: req.user!.id },
    include: { currentRoom: { include: { section: true, roomType: true } } },
  });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student profile not found." } });

  const [paymentSummary, urgentAnnouncements, openMaintenance] = await Promise.all([
    getStudentBalanceSummary(student.id),
    prisma.announcement.findMany({
      where: {
        priority: { in: ["important", "urgent"] },
        OR: [
          { audienceType: "all" },
          student.currentRoom ? { audienceType: "section", audienceRef: student.currentRoom.section.id } : undefined,
          student.currentRoom ? { audienceType: "room", audienceRef: student.currentRoom.id } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    prisma.maintenanceRequest.count({ where: { studentId: student.id, status: { in: ["submitted", "in_progress"] } } }),
  ]);

  res.json({
    student: { id: student.id, fullName: student.fullName, registrationNumber: student.registrationNumber, status: student.status },
    accommodation: student.currentRoom
      ? { section: student.currentRoom.section.name, roomNumber: student.currentRoom.roomNumber, roomType: student.currentRoom.roomType.name }
      : null,
    payment: paymentSummary,
    urgentAnnouncements,
    openMaintenanceRequests: openMaintenance,
  });
});
