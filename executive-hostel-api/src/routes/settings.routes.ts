import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requirePermission } from "../middleware/authorize";
import { recordAudit } from "../services/audit.service";

export const settingsRouter = Router();

// Keys shown on the payment-info screen. Anything not on this list stays
// admin-only even if someone adds it to system_settings later (docs Section
// 11: "Never expose payment account information that has not been
// configured by the hostel" - this allowlist is what keeps that true even
// as new setting keys get added over time).
const PAYMENT_SETTING_KEYS = [
  "bank_name", "bank_account_name", "bank_account_number", "bank_branch",
  "mobile_money_number", "payment_instructions", "payment_deadline",
];

// IMPORTANT: this is deliberately NOT public. Bank account and mobile money
// details are exactly the kind of information a scammer would want a public,
// unauthenticated endpoint for - someone could stand up a lookalike
// "how to pay" page using real hostel account details pulled straight from
// this API. Only logged-in students who have actually been assigned a room
// (i.e. have something to pay for) can see it, plus staff for reference.
settingsRouter.get(
  "/payment-info",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    const isStaff = req.user!.role === "administrator" || req.user!.role === "landlady";
    if (!isStaff) {
      if (req.user!.role !== "student") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Payment information is only available to enrolled residents." } });
      }
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student?.currentRoomId) {
        return res.status(403).json({
          error: { code: "NO_ROOM_ASSIGNED", message: "Payment information becomes available once you've been assigned a room. Contact hostel administration if you believe this is an error." },
        });
      }
    }

    const rows = await prisma.systemSetting.findMany({ where: { key: { in: PAYMENT_SETTING_KEYS } } });
    const map: Record<string, string | null> = {};
    for (const key of PAYMENT_SETTING_KEYS) map[key] = null; // explicit null, not silently missing, for unconfigured fields
    for (const row of rows) map[row.key] = row.value;
    res.json(map);
  }
);

settingsRouter.get(
  "/",
  authenticate,
  requireRole("administrator", "landlady"),
  async (_req, res) => {
    const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    res.json(rows);
  }
);

const upsertSchema = z.object({
  settings: z.array(z.object({ key: z.string().min(1).max(80), value: z.string().max(2000).nullable() })).min(1),
});

settingsRouter.patch(
  "/",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_settings"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Body must be { settings: [{ key, value }] }." } });
    }
    for (const { key, value } of parsed.data.settings) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: req.user!.id },
        create: { key, value, updatedBy: req.user!.id },
      });
    }
    await recordAudit({ actorId: req.user!.id, action: "settings.updated", newValue: parsed.data.settings });
    res.status(204).send();
  }
);

// ---------------------------------------------------------------------------
// Contacts (docs Section 33)
// ---------------------------------------------------------------------------
export const contactsRouter = Router();

contactsRouter.get("/", async (_req, res) => {
  const contacts = await prisma.contact.findMany();
  res.json(contacts);
});

const contactSchema = z.object({
  label: z.string().min(1).max(80),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(500).optional(),
});

contactsRouter.post(
  "/",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_settings"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
    }
    const contact = await prisma.contact.create({ data: parsed.data });
    await recordAudit({ actorId: req.user!.id, action: "contact.created", entityType: "Contact", entityId: contact.id });
    res.status(201).json(contact);
  }
);

contactsRouter.patch(
  "/:id",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_settings"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = contactSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid input." } });
    }
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Contact not found." } });
    const updated = await prisma.contact.update({ where: { id: req.params.id }, data: parsed.data });
    await recordAudit({ actorId: req.user!.id, action: "contact.updated", entityType: "Contact", entityId: existing.id, previousValue: existing, newValue: updated });
    res.json(updated);
  }
);

contactsRouter.delete(
  "/:id",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_settings"),
  async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Contact not found." } });
    await prisma.contact.delete({ where: { id: req.params.id } });
    await recordAudit({ actorId: req.user!.id, action: "contact.deleted", entityType: "Contact", entityId: existing.id, previousValue: existing });
    res.status(204).send();
  }
);

// ---------------------------------------------------------------------------
// Hostel Guidelines (docs Section 41) - editable content, grouped by category
// ---------------------------------------------------------------------------
export const guidelinesRouter = Router();

guidelinesRouter.get("/", async (_req, res) => {
  const rows = await prisma.hostelGuideline.findMany({ orderBy: { category: "asc" } });
  res.json(rows);
});

const guidelineSchema = z.object({
  category: z.string().min(1).max(60),
  content: z.string().min(1).max(20000),
});

guidelinesRouter.post(
  "/",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_settings"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = guidelineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
    }
    const row = await prisma.hostelGuideline.create({ data: { ...parsed.data, updatedBy: req.user!.id } });
    await recordAudit({ actorId: req.user!.id, action: "guideline.created", entityType: "HostelGuideline", entityId: row.id });
    res.status(201).json(row);
  }
);

guidelinesRouter.patch(
  "/:id",
  authenticate,
  requireRole("administrator", "landlady"),
  requirePermission("manage_settings"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = guidelineSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid input." } });
    }
    const existing = await prisma.hostelGuideline.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Guideline not found." } });
    const updated = await prisma.hostelGuideline.update({ where: { id: req.params.id }, data: { ...parsed.data, updatedBy: req.user!.id } });
    await recordAudit({ actorId: req.user!.id, action: "guideline.updated", entityType: "HostelGuideline", entityId: existing.id, previousValue: existing, newValue: updated });
    res.json(updated);
  }
);
