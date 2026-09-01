import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

// Mirrors the `RoomStatus` enum in schema.prisma. Once you run
// `npx prisma generate` against a real database, `Prisma.RoomStatus` will
// also be available directly from "@prisma/client" - this local type is
// just so the project type-checks before that first generate runs.
type RoomStatus = "vacant" | "occupied" | "reserved" | "under_maintenance" | "temporarily_unavailable";

export class AllocationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Assigns a vacant room to a student.
 *
 * Runs the checks from docs Section 37 inside a single DB transaction so
 * there's no window where two requests could both see the room as vacant
 * and both succeed - the whole thing commits or nothing does:
 *   1. Room exists
 *   2. Room is vacant (not occupied/maintenance/unavailable; reserved
 *      rooms must be released or explicitly reassigned by an admin first)
 *   3. Student exists and doesn't already have an active room
 *   4. Correct fee snapshot is left for Payments (Phase 6) to reference
 *      via room.roomTypeId - no fee is hardcoded here
 */
export async function assignRoom(params: {
  roomId: string;
  studentId: string;
  assignedBy: string;
}) {
  const { roomId, studentId, assignedBy } = params;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AllocationError("ROOM_NOT_FOUND", "Room does not exist.");
    if (room.status !== "vacant") {
      throw new AllocationError("ROOM_NOT_VACANT", `Room is currently '${room.status}', not vacant.`);
    }
    if (room.currentStudentId) {
      // Belt-and-braces: should be impossible if status is correctly vacant,
      // but the unique constraint is the real backstop - fail loud if this
      // ever happens rather than silently overwriting an occupant.
      throw new AllocationError("ROOM_NOT_VACANT", "Room already has an active occupant.");
    }

    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new AllocationError("STUDENT_NOT_FOUND", "Student does not exist.");
    if (student.currentRoomId) {
      throw new AllocationError("STUDENT_ALREADY_ASSIGNED", "This student already has an active room. Check them out of it first.");
    }
    if (student.status === "checked_out") {
      throw new AllocationError("STUDENT_CHECKED_OUT", "This student's record is checked out. Reactivate before assigning a room.");
    }

    // These two updates + the unique constraints on currentStudentId /
    // currentRoomId are what make "one room = one student" unbreakable
    // even under concurrent requests - a second transaction hitting the
    // same room will fail the vacancy check above or the unique constraint
    // below, whichever it reaches first.
    const updatedRoom = await tx.room.update({
      where: { id: roomId },
      data: { status: "occupied", currentStudentId: studentId },
    });
    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: { currentRoomId: roomId },
    });
    await tx.roomAssignment.create({
      data: { studentId, roomId, assignedBy },
    });
    await tx.auditLog.create({
      data: {
        actorId: assignedBy,
        action: "room.assigned",
        entityType: "Room",
        entityId: roomId,
        newValue: { studentId, roomId } as any,
      },
    });

    return { room: updatedRoom, student: updatedStudent };
  });
}

/**
 * Records a student's physical check-in to a room they've already been
 * assigned (docs Section 38). Separate from assignment because a room can
 * be "Accommodation Confirmed" before the student physically arrives.
 *
 * Guards against duplicate check-ins: if the student's most recent CheckIn
 * is more recent than their most recent CheckOut (i.e. they're currently
 * checked in), this refuses rather than silently creating a second CheckIn
 * row for the same stay - important since nothing in the UI currently
 * prevents an admin from clicking "Check In" twice.
 */
export async function checkInStudent(params: {
  studentId: string;
  recordedBy: string;
  checkInDate: Date;
  notes?: string;
  roomConditionNotes?: string;
}) {
  const { studentId, recordedBy, checkInDate, notes, roomConditionNotes } = params;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new AllocationError("STUDENT_NOT_FOUND", "Student does not exist.");
    if (!student.currentRoomId) {
      throw new AllocationError("NO_ROOM_ASSIGNED", "Student must be assigned a room before check-in.");
    }

    const [lastCheckIn, lastCheckOut] = await Promise.all([
      tx.checkIn.findFirst({ where: { studentId }, orderBy: { checkInDate: "desc" } }),
      tx.checkOut.findFirst({ where: { studentId }, orderBy: { checkOutDate: "desc" } }),
    ]);
    const alreadyCheckedIn = lastCheckIn && (!lastCheckOut || lastCheckIn.checkInDate > lastCheckOut.checkOutDate);
    if (alreadyCheckedIn) {
      throw new AllocationError("ALREADY_CHECKED_IN", "This student is already checked in - no action needed.");
    }

    const checkIn = await tx.checkIn.create({
      data: { studentId, roomId: student.currentRoomId, checkInDate, notes, roomConditionNotes, recordedBy },
    });
    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: { status: "active" },
    });
    await tx.auditLog.create({
      data: { actorId: recordedBy, action: "student.checked_in", entityType: "Student", entityId: studentId },
    });

    return { checkIn, student: updatedStudent };
  });
}

/**
 * Releases a student from their room (docs Section 39). Preserves history:
 * the RoomAssignment row is closed (releasedAt set), never deleted, and
 * past payments/assignments remain queryable for authorized admins.
 */
export async function checkOutStudent(params: {
  studentId: string;
  recordedBy: string;
  checkOutDate: Date;
  reason?: string;
  outstandingBalance?: number;
  roomConditionNotes?: string;
  clearanceStatus?: "pending" | "cleared" | "disputed";
}) {
  const { studentId, recordedBy, checkOutDate, reason, outstandingBalance, roomConditionNotes, clearanceStatus } = params;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new AllocationError("STUDENT_NOT_FOUND", "Student does not exist.");
    if (!student.currentRoomId) {
      throw new AllocationError("NO_ROOM_ASSIGNED", "Student does not currently occupy a room.");
    }
    const roomId = student.currentRoomId;

    const checkOut = await tx.checkOut.create({
      data: {
        studentId, roomId, checkOutDate, reason,
        outstandingBalance: outstandingBalance ?? undefined,
        roomConditionNotes,
        clearanceStatus: clearanceStatus ?? "pending",
        recordedBy,
      },
    });

    await tx.roomAssignment.updateMany({
      where: { studentId, roomId, releasedAt: null },
      data: { releasedAt: new Date() },
    });

    await tx.room.update({
      where: { id: roomId },
      data: { status: "vacant", currentStudentId: null },
    });
    const updatedStudent = await tx.student.update({
      where: { id: studentId },
      data: { currentRoomId: null, status: "checked_out" },
    });

    await tx.auditLog.create({
      data: {
        actorId: recordedBy, action: "student.checked_out",
        entityType: "Student", entityId: studentId,
        newValue: { roomId, checkOutDate } as any,
      },
    });

    return { checkOut, student: updatedStudent };
  });
}

/**
 * Direct room status change (e.g. into/out of maintenance) - NOT for
 * occupying or vacating via a student, which must go through assignRoom /
 * checkOutStudent so the student<->room link stays consistent.
 */
export async function setRoomStatus(params: { roomId: string; status: RoomStatus; actorId: string }) {
  const { roomId, status, actorId } = params;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AllocationError("ROOM_NOT_FOUND", "Room does not exist.");
    if (room.currentStudentId) {
      throw new AllocationError("ROOM_OCCUPIED", "Check the current occupant out before changing this room's status.");
    }
    if (status === "occupied") {
      throw new AllocationError("INVALID_STATUS_CHANGE", "Rooms become 'occupied' only via room assignment, not a direct status change.");
    }
    const updated = await tx.room.update({ where: { id: roomId }, data: { status } });
    await tx.auditLog.create({
      data: {
        actorId, action: "room.status_changed", entityType: "Room", entityId: roomId,
        previousValue: { status: room.status } as any,
        newValue: { status } as any,
      },
    });
    return updated;
  });
}
