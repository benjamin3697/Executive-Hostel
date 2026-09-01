import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { authRouter } from "./routes/auth.routes";
import { meRouter } from "./routes/me.routes";
import { roomsRouter } from "./routes/rooms.routes";
import { studentsRouter } from "./routes/students.routes";
import { adminUsersRouter } from "./routes/admin-users.routes";
import { feesRouter } from "./routes/fees.routes";
import { paymentsRouter } from "./routes/payments.routes";
import { applicationsRouter } from "./routes/applications.routes";
import { announcementsRouter } from "./routes/announcements.routes";
import { maintenanceRouter } from "./routes/maintenance.routes";
import { settingsRouter, contactsRouter, guidelinesRouter } from "./routes/settings.routes";
import { reportsRouter } from "./routes/reports.routes";
import { auditRouter } from "./routes/audit.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { academicYearsRouter, semestersRouter } from "./routes/academic.routes";

const app = express();

// Behind a reverse proxy (nginx, Render, Railway, etc.) in production -
// without this, express-rate-limit and req.ip see the proxy's IP for every
// request, not the real client, making the rate limits useless.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: env.corsOrigins.length ? env.corsOrigins : false,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

// Defense in depth: the auth/apply-specific limiters are stricter, but every
// route gets a floor so no single endpoint can be hammered into a DoS.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

// Minimal structured request log - method, path, status, duration, and the
// authenticated user id when present (set by the `authenticate` middleware
// on req.user). Deliberately does NOT log request bodies, since those can
// contain passwords or payment details.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const userId = (req as any).user?.id ?? "-";
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms user=${userId}`);
  });
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/me", meRouter);
app.use("/api/v1/rooms", roomsRouter);
app.use("/api/v1/students", studentsRouter);
app.use("/api/v1/admin/users", adminUsersRouter);
app.use("/api/v1/fees", feesRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/applications", applicationsRouter);
app.use("/api/v1/announcements", announcementsRouter);
app.use("/api/v1/maintenance", maintenanceRouter);
app.use("/api/v1/settings", settingsRouter);
app.use("/api/v1/contacts", contactsRouter);
app.use("/api/v1/guidelines", guidelinesRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/audit-logs", auditRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/academic-years", academicYearsRouter);
app.use("/api/v1/semesters", semestersRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
});

// Centralized error handler - keeps stack traces out of responses.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
});

const server = app.listen(env.port, () => {
  console.log(`Executive Hostel API listening on http://localhost:${env.port}`);
});

// Graceful shutdown - let in-flight requests finish and close the DB pool
// cleanly, so a deploy/restart doesn't drop a payment-verification request
// mid-transaction.
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if something hangs longer than 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
