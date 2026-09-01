import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requirePermission } from "../middleware/authorize";
import { recordAudit } from "../services/audit.service";

export const feesRouter = Router();

// ---------------------------------------------------------------------------
// GET /fees/current - the fee currently in effect per room type.
// Public-safe: fee amounts aren't sensitive, and prospective applicants
// need to see them (docs Section 9/55).
// ---------------------------------------------------------------------------
feesRouter.get("/current", async (_req, res) => {
  const roomTypes = await prisma.roomType.findMany();
  const results = await Promise.all(
    roomTypes.map(async (rt: { id: string; name: string }) => {
      const fee = await prisma.accommodationFee.findFirst({
        where: { roomTypeId: rt.id, effectiveDate: { lte: new Date() } },
        orderBy: { effectiveDate: "desc" },
      });
      return { roomType: rt.name, roomTypeId: rt.id, amount: fee?.amount ?? null, effectiveDate: fee?.effectiveDate ?? null };
    })
  );
  res.json(results);
});

// ---------------------------------------------------------------------------
// GET /fees/history - full fee history, for admins reconciling old payments
// ---------------------------------------------------------------------------
feesRouter.get("/history", authenticate, requireRole("administrator", "landlady"), async (req, res) => {
  const roomTypeId = typeof req.query.roomTypeId === "string" ? req.query.roomTypeId : undefined;
  const fees = await prisma.accommodationFee.findMany({
    where: { roomTypeId },
    include: { roomType: true, academicYear: true, semester: true },
    orderBy: { effectiveDate: "desc" },
  });
  res.json(fees);
});

// ---------------------------------------------------------------------------
// POST /fees - create a new effective-dated fee row. This NEVER updates an
// existing row - old payments keep referencing the AccommodationFee that
// was in effect when they were made, so a fee increase never silently
// changes what a past semester's residents were charged (docs Section 55).
// ---------------------------------------------------------------------------
const createFeeSchema = z.object({
  roomTypeId: z.string().uuid(),
  amount: z.number().positive(),
  academicYearId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  effectiveDate: z.string().datetime().optional(), // defaults to now
});

feesRouter.post(
  "/",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_fees"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createFeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
    }
    const roomType = await prisma.roomType.findUnique({ where: { id: parsed.data.roomTypeId } });
    if (!roomType) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Room type not found." } });
    }

    const fee = await prisma.accommodationFee.create({
      data: {
        roomTypeId: parsed.data.roomTypeId,
        amount: parsed.data.amount,
        academicYearId: parsed.data.academicYearId,
        semesterId: parsed.data.semesterId,
        effectiveDate: parsed.data.effectiveDate ? new Date(parsed.data.effectiveDate) : new Date(),
        createdBy: req.user!.id,
      },
    });

    await recordAudit({
      actorId: req.user!.id, action: "fee.created",
      entityType: "AccommodationFee", entityId: fee.id,
      newValue: fee,
    });

    res.status(201).json(fee);
  }
);
