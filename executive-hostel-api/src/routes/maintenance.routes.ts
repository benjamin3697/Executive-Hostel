import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requireSelfOrRole } from "../middleware/authorize";
import { recordAudit } from "../services/audit.service";
import { notifyByEmailOrSms } from "../services/notify.service";

export const maintenanceRouter = Router();
maintenanceRouter.use(authenticate);

const CATEGORIES = ["electricity", "water", "plumbing", "door_lock", "lighting", "furniture", "cleaning", "internet", "other"] as const;

// ---------------------------------------------------------------------------
// POST / - student submits a request against their own current room.
// Reuses createEvidenceUploadPost-style flow isn't needed here since photos
// are optional and lower-stakes than payment evidence; imageUrl is just a
// bucket key the client uploads beforehand via the same presigned-upload
// pattern as payments (POST /payments/evidence-upload-url works generically -
// it isn't payment-specific despite the route living under /payments).
// ---------------------------------------------------------------------------
const createSchema = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().min(3).max(2000),
  imageUrl: z.string().max(500).optional(),
});

maintenanceRouter.post("/", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student profile not found." } });
  if (!student.currentRoomId) {
    return res.status(409).json({ error: { code: "NO_ROOM_ASSIGNED", message: "You need an assigned room before submitting a maintenance request." } });
  }

  const request = await prisma.maintenanceRequest.create({
    data: {
      studentId: student.id,
      roomId: student.currentRoomId,
      category: parsed.data.category,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      status: "submitted",
    },
  });

  await recordAudit({ actorId: req.user!.id, action: "maintenance.submitted", entityType: "MaintenanceRequest", entityId: request.id });

  // Notify admins/landlady - same pattern as payment submission.
  const admins = await prisma.user.findMany({ where: { OR: [{ role: "landlady" }, { role: "administrator" }] } });
  await prisma.notification.createMany({
    data: admins.map((a: { id: string }) => ({
      recipientId: a.id, type: "maintenance.submitted",
      payload: { requestId: request.id, category: request.category } as any,
    })),
  });

  res.status(201).json(request);
});

maintenanceRouter.get("/me", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student profile not found." } });
  const requests = await prisma.maintenanceRequest.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

// ---------------------------------------------------------------------------
// ADMIN: list & manage
// ---------------------------------------------------------------------------
const listQuerySchema = z.object({
  status: z.enum(["submitted", "in_progress", "resolved", "closed"]).optional(),
  category: z.enum(CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

maintenanceRouter.get("/", requireRole("administrator", "landlady"), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters." } });
  }
  const { status, category, page, pageSize } = parsed.data;
  const where = { status, category };

  const [total, requests] = await Promise.all([
    prisma.maintenanceRequest.count({ where }),
    prisma.maintenanceRequest.findMany({
      where,
      include: { student: { select: { fullName: true } }, room: { include: { section: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
  ]);

  res.json({ total, page, pageSize, requests });
});

async function ownerUserIdForRequestParam(req: AuthenticatedRequest): Promise<string | null> {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id }, include: { student: true } });
  return request?.student.userId ?? null;
}

maintenanceRouter.get(
  "/:id",
  requireSelfOrRole(ownerUserIdForRequestParam, "administrator", "landlady"),
  async (req, res) => {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: { student: true, room: { include: { section: true } } },
    });
    if (!request) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Maintenance request not found." } });
    res.json(request);
  }
);

const statusSchema = z.object({ status: z.enum(["in_progress", "resolved", "closed"]) });

maintenanceRouter.patch("/:id/status", requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "status must be one of in_progress, resolved, closed." } });
  }
  const existing = await prisma.maintenanceRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Maintenance request not found." } });

  const updated = await prisma.maintenanceRequest.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });

  await recordAudit({
    actorId: req.user!.id, action: "maintenance.status_changed",
    entityType: "MaintenanceRequest", entityId: existing.id,
    previousValue: { status: existing.status }, newValue: { status: parsed.data.status },
  });

  const student = await prisma.student.findUnique({ where: { id: existing.studentId }, include: { user: true } });
  if (student) {
    await prisma.notification.create({
      data: { recipientId: student.userId, type: "maintenance.status_changed", payload: { requestId: existing.id, status: parsed.data.status } as any },
    });
    await notifyByEmailOrSms({
      email: student.user.email, phone: student.user.phone,
      subject: "Maintenance request update",
      message: `Your maintenance request (${existing.category.replace(/_/g, " ")}) is now "${parsed.data.status.replace(/_/g, " ")}".`,
    });
  }

  res.json(updated);
});
