import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// Every route so far has been CREATING notifications (payment submitted,
// room assigned, announcement published, etc.) but nothing let anyone
// actually read them back - this closes that loop.
notificationsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const unreadOnly = req.query.unread === "true";
  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.user!.id, isRead: unreadOnly ? false : undefined },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = await prisma.notification.count({ where: { recipientId: req.user!.id, isRead: false } });
  res.json({ unreadCount, notifications });
});

notificationsRouter.patch("/:id/read", async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.recipientId !== req.user!.id) {
    // Same response whether it doesn't exist or belongs to someone else -
    // don't confirm/deny the existence of another user's notification.
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found." } });
  }
  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.json(updated);
});

notificationsRouter.patch("/read-all", async (req: AuthenticatedRequest, res) => {
  await prisma.notification.updateMany({ where: { recipientId: req.user!.id, isRead: false }, data: { isRead: true } });
  res.status(204).send();
});
