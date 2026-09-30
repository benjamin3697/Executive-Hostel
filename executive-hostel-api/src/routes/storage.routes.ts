import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { createStorageUploadUrl } from "../lib/storage";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole } from "../middleware/authorize";

export const storageRouter = Router();
storageRouter.use(authenticate);

const uploadUrlSchema = z.object({
  purpose: z.enum(["payment-evidence", "maintenance-photos"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]),
  contentLength: z.number().int().positive(),
});

storageRouter.post("/upload-url", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  const parsed = uploadUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Unsupported upload type." } });
  }
  if (parsed.data.purpose === "maintenance-photos" && parsed.data.contentType === "application/pdf") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Maintenance uploads must be images." } });
  }
  if (parsed.data.contentLength > env.s3MaxUploadBytes) {
    return res.status(413).json({ error: { code: "FILE_TOO_LARGE", message: "The file exceeds the configured upload size limit." } });
  }

  const student = await prisma.student.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
  if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student profile not found." } });

  const upload = await createStorageUploadUrl({
    studentId: student.id,
    purpose: parsed.data.purpose,
    contentType: parsed.data.contentType,
    contentLength: parsed.data.contentLength,
  });
  res.json(upload);
});