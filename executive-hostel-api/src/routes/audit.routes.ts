import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";

export const auditRouter = Router();
auditRouter.use(authenticate, requireRole("administrator", "landlady"));

// docs Section 46: "Record who performed action, action, date/time,
// relevant record, previous value, new value" - this is the read side of
// that, with the filters an admin actually needs when investigating a
// payment dispute (Section 47) or reviewing recent activity.
const listQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(), // supports partial match, e.g. "payment." to see all payment-related actions
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

auditRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters." } });
  }
  const { actorId, action, entityType, entityId, dateFrom, dateTo, page, pageSize } = parsed.data;

  const where = {
    actorId,
    entityType,
    entityId,
    action: action ? { contains: action } : undefined,
    createdAt: (dateFrom || dateTo) ? { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(dateTo) : undefined } : undefined,
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { email: true, phone: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ total, page, pageSize, logs });
});

// Convenience: everything logged against one specific record (e.g. a
// payment) in chronological order - the exact view needed to resolve a
// dispute about "who changed what, when" (docs Section 47).
auditRouter.get("/entity/:entityType/:entityId", async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { entityType: req.params.entityType, entityId: req.params.entityId },
    include: { actor: { select: { email: true, phone: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(logs);
});
