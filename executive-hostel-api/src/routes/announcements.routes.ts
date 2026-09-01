import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";
import { recordAudit } from "../services/audit.service";
import { notifyByEmailOrSms } from "../services/notify.service";

export const announcementsRouter = Router();
announcementsRouter.use(authenticate);

// Chairperson is explicitly included alongside admin/landlady (docs Section
// 32) but NOT granted anything else here - they can only reach this router,
// never /payments, /students, etc., since those have their own requireRole
// checks that don't list "chairperson".
const canPublish = requireRole("administrator", "landlady", "chairperson");

const createSchema = z.object({
  title: z.string().min(2).max(200),
  message: z.string().min(2).max(5000),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  audienceType: z.enum(["all", "section", "room", "year", "group"]).default("all"),
  audienceRef: z.string().max(100).optional(),
  attachmentUrl: z.string().url().optional(),
}).refine((d) => d.audienceType === "all" || !!d.audienceRef, {
  message: "audienceRef is required unless audienceType is 'all'.",
});

announcementsRouter.post("/", canPublish, async (req: AuthenticatedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const announcement = await prisma.announcement.create({
    data: { ...parsed.data, authorId: req.user!.id },
  });

  await recordAudit({
    actorId: req.user!.id, action: "announcement.published",
    entityType: "Announcement", entityId: announcement.id,
    newValue: { title: announcement.title, priority: announcement.priority, audienceType: announcement.audienceType },
  });

  // Notify affected students. For "all" we don't fan out to every student
  // individually here (could be hundreds, and would burn through the email/
  // SMS free tiers on every routine notice) - the frontend polls
  // GET /announcements instead. Targeted audiences are small enough to
  // notify directly, and get real email/SMS too, but only for
  // important/urgent priority - a "normal" targeted note (e.g. a minor
  // schedule change for one section) still shouldn't ping everyone's phone.
  if (parsed.data.audienceType !== "all") {
    const students = await prisma.student.findMany({
      where: {
        currentRoom: parsed.data.audienceType === "section" ? { section: { id: parsed.data.audienceRef } }
          : parsed.data.audienceType === "room" ? { id: parsed.data.audienceRef }
          : undefined,
        yearOfStudy: parsed.data.audienceType === "year" ? Number(parsed.data.audienceRef) : undefined,
      },
      include: { user: true },
    });
    if (students.length) {
      await prisma.notification.createMany({
        data: students.map((s: { userId: string }) => ({
          recipientId: s.userId, type: "announcement.new",
          payload: { announcementId: announcement.id, title: announcement.title } as any,
        })),
      });

      if (parsed.data.priority !== "normal") {
        await Promise.all(
          students.map((s: { user: { email: string | null; phone: string | null } }) =>
            notifyByEmailOrSms({
              email: s.user.email, phone: s.user.phone,
              subject: `[${parsed.data.priority.toUpperCase()}] ${parsed.data.title}`,
              message: parsed.data.message,
            })
          )
        );
      }
    }
  }

  res.status(201).json(announcement);
});

// ---------------------------------------------------------------------------
// GET / - audience-filtered for students (docs Section 31: "Students should
// only see announcements relevant to them"); admin/landlady/chairperson see
// everything, since they need to review what's been published.
// ---------------------------------------------------------------------------
announcementsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const isStaff = ["administrator", "landlady", "chairperson"].includes(req.user!.role);
  if (isStaff) {
    const announcements = await prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 100 });
    return res.json(announcements);
  }

  const student = await prisma.student.findUnique({
    where: { userId: req.user!.id },
    include: { currentRoom: true },
  });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student profile not found." } });

  const orConditions: any[] = [{ audienceType: "all" }];
  if (student.currentRoom) {
    orConditions.push({ audienceType: "section", audienceRef: student.currentRoom.sectionId });
    orConditions.push({ audienceType: "room", audienceRef: student.currentRoom.id });
  }
  if (student.yearOfStudy) {
    orConditions.push({ audienceType: "year", audienceRef: String(student.yearOfStudy) });
  }

  const announcements = await prisma.announcement.findMany({
    where: { OR: orConditions },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  res.json(announcements);
});

announcementsRouter.get("/:id", async (req, res) => {
  const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!announcement) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Announcement not found." } });
  res.json(announcement);
});
