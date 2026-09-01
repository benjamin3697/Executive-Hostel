import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requirePermission } from "../middleware/authorize";
import { hashPassword } from "../lib/auth";
import { recordAudit } from "../services/audit.service";

export const adminUsersRouter = Router();
adminUsersRouter.use(authenticate);

// Only the landlady, or an administrator explicitly granted "manage_users",
// can provision staff accounts - this is deliberately not open to every
// administrator by default (docs Section 45/32: permissions are granular).
const canManageUsers = [requireRole("landlady"), requirePermission("manage_users")];

// requireRole/requirePermission each fully reject on failure, so we can't
// simply chain them as "OR" - build a small combinator instead.
function anyOf(...guards: Array<(req: AuthenticatedRequest, res: any, next: any) => any>) {
  return (req: AuthenticatedRequest, res: any, next: any) => {
    let index = 0;
    const tryNext = () => {
      if (index >= guards.length) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions." } });
      }
      const guard = guards[index++];
      guard(req, { status: () => ({ json: tryNext }) } as any, next);
    };
    tryNext();
  };
}

const manageUsersGuard = anyOf(requireRole("landlady"), requirePermission("manage_users"));

// ---------------------------------------------------------------------------
// GET /admin/users - list staff accounts (not students - use /students for those)
// ---------------------------------------------------------------------------
adminUsersRouter.get("/", manageUsersGuard, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ["administrator", "landlady", "chairperson"] } },
    select: { id: true, email: true, phone: true, role: true, isActive: true, createdAt: true, permissions: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// ---------------------------------------------------------------------------
// POST /admin/users - provision a new staff account
// ---------------------------------------------------------------------------
const createStaffSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8),
  role: z.enum(["administrator", "landlady", "chairperson"]),
  permissions: z.array(z.string()).optional(),
}).refine((d) => d.email || d.phone, { message: "Provide an email or phone number." });

adminUsersRouter.post("/", manageUsersGuard, async (req: AuthenticatedRequest, res) => {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  const { email, phone, password, role, permissions } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean) as any },
  });
  if (existing) {
    return res.status(409).json({ error: { code: "ALREADY_EXISTS", message: "An account with this email or phone already exists." } });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email, phone, passwordHash, role,
      permissions: permissions?.length
        ? { create: permissions.map((permissionKey) => ({ permissionKey, grantedBy: req.user!.id })) }
        : undefined,
    },
    include: { permissions: true },
  });

  await recordAudit({
    actorId: req.user!.id, action: "user.staff_created",
    entityType: "User", entityId: user.id,
    newValue: { role, permissions },
  });

  const { passwordHash: _omit, ...safeUser } = user;
  res.status(201).json(safeUser);
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id/permissions - grant/revoke granular permissions
// Body: { grant?: string[], revoke?: string[] }
// ---------------------------------------------------------------------------
const permissionsSchema = z.object({
  grant: z.array(z.string()).optional(),
  revoke: z.array(z.string()).optional(),
});

adminUsersRouter.patch("/:id/permissions", manageUsersGuard, async (req: AuthenticatedRequest, res) => {
  const parsed = permissionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid input." } });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, include: { permissions: true } });
  if (!target) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });

  const { grant = [], revoke = [] } = parsed.data;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (revoke.length) {
      await tx.userPermission.deleteMany({ where: { userId: target.id, permissionKey: { in: revoke } } });
    }
    for (const permissionKey of grant) {
      await tx.userPermission.upsert({
        where: { userId_permissionKey: { userId: target.id, permissionKey } },
        update: {},
        create: { userId: target.id, permissionKey, grantedBy: req.user!.id },
      });
    }
  });

  await recordAudit({
    actorId: req.user!.id, action: "user.permissions_changed",
    entityType: "User", entityId: target.id,
    previousValue: { permissions: target.permissions.map((p: { permissionKey: string }) => p.permissionKey) },
    newValue: { grant, revoke },
  });

  const updated = await prisma.user.findUnique({ where: { id: target.id }, include: { permissions: true } });
  res.json(updated);
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id/deactivate - disable an account without deleting it
// ---------------------------------------------------------------------------
adminUsersRouter.patch("/:id/deactivate", manageUsersGuard, async (req: AuthenticatedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  if (target.id === req.user!.id) {
    return res.status(400).json({ error: { code: "INVALID_ACTION", message: "You cannot deactivate your own account." } });
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
  await recordAudit({ actorId: req.user!.id, action: "user.deactivated", entityType: "User", entityId: target.id });
  res.json({ id: updated.id, isActive: updated.isActive });
});
