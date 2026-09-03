import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { getStudentBalanceSummary } from "../services/payment.service";

export const reportsRouter = Router();
reportsRouter.use(authenticate, requireRole("administrator", "landlady"));

// Named explicitly rather than relying on inference through Promise.all/map -
// this is what fixed a real bug where `s` in the reduce below got inferred
// as a raw Payment row instead of this summary shape.
type BalanceSummary = Awaited<ReturnType<typeof getStudentBalanceSummary>>;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// GET /reports/occupancy (docs Section 42)
// ---------------------------------------------------------------------------
reportsRouter.get("/occupancy", async (_req, res) => {
  const rooms = await prisma.room.findMany({ include: { section: true, roomType: true } });
  const bySection: Record<string, { total: number; occupied: number; vacant: number; other: number }> = {};
  const byType: Record<string, { total: number; occupied: number; vacant: number }> = {};

  for (const r of rooms as any[]) {
    const sectionName = r.section.name;
    bySection[sectionName] ??= { total: 0, occupied: 0, vacant: 0, other: 0 };
    bySection[sectionName].total++;
    if (r.status === "occupied") bySection[sectionName].occupied++;
    else if (r.status === "vacant") bySection[sectionName].vacant++;
    else bySection[sectionName].other++;

    const typeName = r.roomType.name;
    byType[typeName] ??= { total: 0, occupied: 0, vacant: 0 };
    byType[typeName].total++;
    if (r.status === "occupied") byType[typeName].occupied++;
    else if (r.status === "vacant") byType[typeName].vacant++;
  }

  const totalRooms = rooms.length;
  const occupiedRooms = (rooms as any[]).filter((r) => r.status === "occupied").length;

  res.json({
    totalRooms,
    occupiedRooms,
    vacantRooms: (rooms as any[]).filter((r) => r.status === "vacant").length,
    occupancyRate: totalRooms ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0,
    bySection,
    byType,
  });
});

// ---------------------------------------------------------------------------
// GET /reports/financial (docs Section 42)
// ---------------------------------------------------------------------------
reportsRouter.get("/financial", async (_req, res) => {
  // Financial accommodation totals are resident totals. Applicants and
  // active students without a room have no applicable fee and must not make
  // the people count disagree with the money totals.
  const residents = await prisma.student.findMany({ where: { status: "active", currentRoomId: { not: null }, user: { role: "student" } } });
  const summaries: BalanceSummary[] = await Promise.all(residents.map((s: { id: string }) => getStudentBalanceSummary(s.id)));

  const totals = summaries.reduce(
    (acc: { expected: number; verified: number; pending: number; outstanding: number }, s: BalanceSummary) => ({
      expected: acc.expected + (s.fee ?? 0),
      verified: acc.verified + s.verifiedPaid,
      pending: acc.pending + s.pendingAmount,
      outstanding: acc.outstanding + (s.balance ?? 0),
    }),
    { expected: 0, verified: 0, pending: 0, outstanding: 0 }
  );

  res.json({
    ...totals,
    fullyPaidCount: summaries.filter((s: BalanceSummary) => s.status === "fully_paid").length,
    partiallyPaidCount: summaries.filter((s: BalanceSummary) => s.status === "partially_paid").length,
    outstandingCount: summaries.filter((s: BalanceSummary) => s.status === "outstanding").length,
    activeStudentCount: residents.length,
  });
});

// ---------------------------------------------------------------------------
// GET /reports/outstanding - "Who hasn't paid?" (docs Section 24)
// ?format=csv streams a CSV instead of JSON.
// ---------------------------------------------------------------------------
reportsRouter.get("/outstanding", async (req, res) => {
  const students = await prisma.student.findMany({
    where: { status: "active", user: { role: "student" } },
    include: { currentRoom: { include: { section: true, roomType: true } } },
  });

  const rows = (
    await Promise.all(
      students.map(async (s: any) => {
        const summary: BalanceSummary = await getStudentBalanceSummary(s.id);
        if (summary.status === "fully_paid" || summary.fee === null) return null;
        return {
          student: s.fullName,
          registrationNumber: s.registrationNumber,
          room: s.currentRoom ? `${s.currentRoom.section.name} ${s.currentRoom.roomNumber}` : "-",
          fee: summary.fee,
          paid: summary.verifiedPaid,
          balance: summary.balance,
          status: summary.status,
        };
      })
    )
  ).filter(Boolean) as Record<string, unknown>[];

  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=outstanding-balances.csv");
    return res.send(toCsv(rows));
  }

  res.json({ total: rows.length, students: rows });
});

// ---------------------------------------------------------------------------
// GET /reports/students (docs Section 42)
// ---------------------------------------------------------------------------
reportsRouter.get("/students", async (_req, res) => {
  const students = await prisma.student.findMany({ where: { user: { role: "student" } }, include: { currentRoom: { include: { section: true } } } });

  const byYear: Record<string, number> = {};
  const byCourse: Record<string, number> = {};
  const bySection: Record<string, number> = {};

  for (const s of students as any[]) {
    const year = s.yearOfStudy ? `Year ${s.yearOfStudy}` : "Unspecified";
    byYear[year] = (byYear[year] ?? 0) + 1;
    const course = s.course ?? "Unspecified";
    byCourse[course] = (byCourse[course] ?? 0) + 1;
    const section = s.currentRoom?.section.name ?? "Unassigned";
    bySection[section] = (bySection[section] ?? 0) + 1;
  }

  res.json({ total: students.length, byYear, byCourse, bySection });
});

// ---------------------------------------------------------------------------
// GET /reports/maintenance (docs Section 42)
// ---------------------------------------------------------------------------
reportsRouter.get("/maintenance", async (_req, res) => {
  const grouped = await prisma.maintenanceRequest.groupBy({ by: ["status"], _count: true });
  const byStatus: Record<string, number> = {};
  for (const g of grouped as any[]) byStatus[g.status] = g._count;
  res.json({ byStatus, total: (grouped as any[]).reduce((sum, g) => sum + g._count, 0) });
});
