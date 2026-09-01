import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { assignRoom, checkInStudent, checkOutStudent, setRoomStatus, AllocationError } from "../services/room-allocation.service";

export const roomsRouter = Router();

function handleAllocationError(err: unknown, res: any) {
  if (err instanceof AllocationError) {
    return res.status(409).json({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

// ---------------------------------------------------------------------------
// PUBLIC: available rooms only, no occupant information (docs Section 35)
// ---------------------------------------------------------------------------
roomsRouter.get("/available", async (req, res) => {
  const section = typeof req.query.section === "string" ? req.query.section : undefined;
  const rooms = await prisma.room.findMany({
    where: {
      status: "vacant",
      section: section ? { name: section } : undefined,
    },
    select: {
      id: true,
      roomNumber: true,
      section: { select: { name: true } },
      roomType: { select: { name: true } },
    },
    orderBy: [{ section: { name: "asc" } }, { roomNumber: "asc" }],
  });
  res.json(rooms.map((r: { id: string; roomNumber: string; section: { name: string }; roomType: { name: string } }) => ({
    id: r.id,
    section: r.section.name,
    roomNumber: r.roomNumber,
    roomType: r.roomType.name,
    status: "available",
  })));
});

// ---------------------------------------------------------------------------
// ADMIN: full room grid with filters + occupant names (docs Section 6, 48)
// ---------------------------------------------------------------------------
roomsRouter.get("/", authenticate, requireRole("administrator", "landlady"), async (req, res) => {
  const { section, type, status } = req.query as Record<string, string | undefined>;
  const rooms = await prisma.room.findMany({
    where: {
      section: section ? { name: section } : undefined,
      roomType: type ? { name: type } : undefined,
      status: status as any,
    },
    include: {
      section: true,
      roomType: true,
      currentStudent: { select: { id: true, fullName: true, registrationNumber: true } },
    },
    orderBy: [{ section: { name: "asc" } }, { roomNumber: "asc" }],
  });
  res.json(rooms);
});

roomsRouter.get("/:id", authenticate, requireRole("administrator", "landlady"), async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: {
      section: true,
      roomType: true,
      currentStudent: true,
      assignments: { orderBy: { assignedAt: "desc" }, take: 10 },
    },
  });
  if (!room) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Room not found." } });
  res.json(room);
});

// ---------------------------------------------------------------------------
// ADMIN ACTIONS
// ---------------------------------------------------------------------------
const assignSchema = z.object({ studentId: z.string().uuid() });

roomsRouter.post("/:id/assign", authenticate, requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "studentId is required." } });
  }
  try {
    const result = await assignRoom({ roomId: req.params.id, studentId: parsed.data.studentId, assignedBy: req.user!.id });
    res.status(200).json(result);
  } catch (err) {
    handleAllocationError(err, res);
  }
});

const checkInSchema = z.object({
  studentId: z.string().uuid(),
  checkInDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  roomConditionNotes: z.string().max(1000).optional(),
});

roomsRouter.post("/:id/checkin", authenticate, requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  try {
    const result = await checkInStudent({
      studentId: parsed.data.studentId,
      recordedBy: req.user!.id,
      checkInDate: parsed.data.checkInDate ? new Date(parsed.data.checkInDate) : new Date(),
      notes: parsed.data.notes,
      roomConditionNotes: parsed.data.roomConditionNotes,
    });
    res.status(200).json(result);
  } catch (err) {
    handleAllocationError(err, res);
  }
});

const checkOutSchema = z.object({
  studentId: z.string().uuid(),
  checkOutDate: z.string().datetime().optional(),
  reason: z.string().max(1000).optional(),
  outstandingBalance: z.number().nonnegative().optional(),
  roomConditionNotes: z.string().max(1000).optional(),
  clearanceStatus: z.enum(["pending", "cleared", "disputed"]).optional(),
});

roomsRouter.post("/:id/checkout", authenticate, requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = checkOutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  try {
    const result = await checkOutStudent({
      studentId: parsed.data.studentId,
      recordedBy: req.user!.id,
      checkOutDate: parsed.data.checkOutDate ? new Date(parsed.data.checkOutDate) : new Date(),
      reason: parsed.data.reason,
      outstandingBalance: parsed.data.outstandingBalance,
      roomConditionNotes: parsed.data.roomConditionNotes,
      clearanceStatus: parsed.data.clearanceStatus,
    });
    res.status(200).json(result);
  } catch (err) {
    handleAllocationError(err, res);
  }
});

const statusSchema = z.object({
  status: z.enum(["vacant", "reserved", "under_maintenance", "temporarily_unavailable"]),
});

roomsRouter.patch("/:id/status", authenticate, requireRole("administrator", "landlady"), async (req: AuthenticatedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "status must be one of vacant, reserved, under_maintenance, temporarily_unavailable." } });
  }
  try {
    const updated = await setRoomStatus({ roomId: req.params.id, status: parsed.data.status, actorId: req.user!.id });
    res.json(updated);
  } catch (err) {
    handleAllocationError(err, res);
  }
});
