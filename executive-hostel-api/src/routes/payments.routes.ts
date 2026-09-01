import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, AuthenticatedRequest } from "../middleware/authenticate";
import { requireRole, requirePermission, requireSelfOrRole } from "../middleware/authorize";
import { createEvidenceUploadPost, getEvidenceDownloadUrl } from "../lib/storage";
import { getCurrentFeeForStudent, getStudentBalanceSummary, verifyPayment, rejectPayment, requestClarification, correctPayment, PaymentError } from "../services/payment.service";
import { recordAudit } from "../services/audit.service";

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

function handlePaymentError(err: unknown, res: any) {
  if (err instanceof PaymentError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "NO_CHANGE" ? 400 : 409;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  throw err;
}

async function requireOwnStudent(req: AuthenticatedRequest) {
  const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
  if (!student) throw new PaymentError("NOT_FOUND", "No student profile for this account.");
  return student;
}

// ---------------------------------------------------------------------------
// STEP 1 — student checks payment details (docs Section 12)
// ---------------------------------------------------------------------------
paymentsRouter.get("/me/summary", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  try {
    const student = await requireOwnStudent(req);
    const summary = await getStudentBalanceSummary(student.id);
    res.json(summary);
  } catch (err) {
    handlePaymentError(err, res);
  }
});

paymentsRouter.get("/me", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  try {
    const student = await requireOwnStudent(req);
    const payments = await prisma.payment.findMany({
      where: { studentId: student.id },
      include: { evidence: true },
      orderBy: { submittedAt: "desc" },
    });
    res.json(payments);
  } catch (err) {
    handlePaymentError(err, res);
  }
});

// ---------------------------------------------------------------------------
// evidence upload: get a presigned POST so the student's browser uploads
// straight to the bucket (docs Section 13, 58) - the file never touches
// this server. Call this first, upload the file, then POST /payments with
// the returned `key` in the evidence list.
// ---------------------------------------------------------------------------
const uploadUrlSchema = z.object({ fileType: z.enum(["image", "pdf"]) });

paymentsRouter.post("/evidence-upload-url", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  const parsed = uploadUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "fileType must be 'image' or 'pdf'." } });
  }
  try {
    const student = await requireOwnStudent(req);
    const post = await createEvidenceUploadPost({ studentId: student.id, fileType: parsed.data.fileType });
    res.json(post);
  } catch (err) {
    handlePaymentError(err, res);
  }
});

// ---------------------------------------------------------------------------
// STEP 3 — student submits payment evidence -> Payment(status=PENDING)
// (docs Section 13-14). Balance is NOT recalculated here - only on verify.
// ---------------------------------------------------------------------------
const submitPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(["bank", "mobile_money", "other"]),
  paymentDate: z.string().datetime(),
  transactionReference: z.string().max(100).optional(),
  payerName: z.string().max(150).optional(),
  remarks: z.string().max(1000).optional(),
  evidence: z.array(z.object({
    key: z.string().min(1),
    fileType: z.enum(["image", "pdf"]),
  })).min(1, "At least one piece of payment evidence is required."),
});

paymentsRouter.post("/", requireRole("student"), async (req: AuthenticatedRequest, res) => {
  const parsed = submitPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
  }
  try {
    const student = await requireOwnStudent(req);
    const fee = await getCurrentFeeForStudent(student.id);
    const summary = await getStudentBalanceSummary(student.id);

    // Stamp the payment with the student's CURRENT semester enrollment -
    // this is what getStudentBalanceSummary() scopes future balance
    // calculations by, so it's what makes "this payment is for Semester 2,
    // not whatever semester I was in when I paid last time" actually true.
    const semester = student.semesterId
      ? await prisma.semester.findUnique({ where: { id: student.semesterId } })
      : null;

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        roomId: student.currentRoomId ?? undefined,
        accommodationFeeId: fee?.id,
        semesterId: student.semesterId ?? undefined,
        academicYearId: semester?.academicYearId ?? undefined,
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        paymentDate: new Date(parsed.data.paymentDate),
        transactionReference: parsed.data.transactionReference,
        payerName: parsed.data.payerName,
        remarks: parsed.data.remarks,
        status: "pending",
        previousBalance: summary.balance ?? undefined,
        evidence: {
          create: parsed.data.evidence.map((e) => ({ fileUrl: e.key, fileType: e.fileType })),
        },
      },
      include: { evidence: true },
    });

    await recordAudit({
      actorId: req.user!.id, action: "payment.submitted",
      entityType: "Payment", entityId: payment.id,
      newValue: { amount: payment.amount, method: payment.paymentMethod },
    });

    // Admin notification (docs Section 15) - notify everyone who can verify
    // payments: the landlady, plus any administrator holding that permission.
    const verifiers = await prisma.user.findMany({
      where: { OR: [{ role: "landlady" }, { role: "administrator", permissions: { some: { permissionKey: "verify_payments" } } }] },
    });
    await prisma.notification.createMany({
      data: verifiers.map((v: { id: string }) => ({
        recipientId: v.id,
        type: "payment.submitted",
        payload: { paymentId: payment.id, studentName: student.fullName, amount: payment.amount } as any,
      })),
    });

    res.status(201).json(payment);
  } catch (err) {
    handlePaymentError(err, res);
  }
});

// ---------------------------------------------------------------------------
// ADMIN: verification queue with filters (docs Section 23)
// ---------------------------------------------------------------------------
const listQuerySchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "clarification_requested"]).optional(),
  section: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

paymentsRouter.get("/", requireRole("administrator", "landlady"), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid query parameters." } });
  }
  const { status, section, dateFrom, dateTo, page, pageSize } = parsed.data;

  const where = {
    status,
    submittedAt: (dateFrom || dateTo) ? { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(dateTo) : undefined } : undefined,
    room: section ? { section: { name: section } } : undefined,
  };

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        student: { select: { fullName: true, registrationNumber: true } },
        room: { include: { section: true } },
        evidence: true,
      },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ total, page, pageSize, payments });
});

// ---------------------------------------------------------------------------
// Detail + evidence view — student who owns it, or admin/landlady
// ---------------------------------------------------------------------------
async function ownerUserIdForPaymentParam(req: AuthenticatedRequest): Promise<string | null> {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { student: true } });
  return payment?.student.userId ?? null;
}

paymentsRouter.get(
  "/:id",
  requireSelfOrRole(ownerUserIdForPaymentParam, "administrator", "landlady"),
  async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { student: true, room: { include: { section: true } }, evidence: true },
    });
    if (!payment) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment not found." } });

    const evidenceWithUrls = await Promise.all(
      payment.evidence.map(async (e: { fileUrl: string }) => ({ ...e, downloadUrl: await getEvidenceDownloadUrl(e.fileUrl) }))
    );

    res.json({ ...payment, evidence: evidenceWithUrls });
  }
);

// ---------------------------------------------------------------------------
// STEP 6 — approve / reject / request clarification (docs Section 16-19)
// ---------------------------------------------------------------------------
paymentsRouter.post(
  "/:id/verify",
  requireRole("administrator", "landlady"),
  requirePermission("verify_payments"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await verifyPayment({ paymentId: req.params.id, verifiedBy: req.user!.id, adminRemarks: req.body?.adminRemarks });
      res.json(updated);
    } catch (err) {
      handlePaymentError(err, res);
    }
  }
);

const reasonSchema = z.object({ reason: z.string().min(3, "A rejection reason is required (docs Section 18).") });

paymentsRouter.post(
  "/:id/reject",
  requireRole("administrator", "landlady"),
  requirePermission("verify_payments"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = reasonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "reason is required." } });
    }
    try {
      const updated = await rejectPayment({ paymentId: req.params.id, rejectedBy: req.user!.id, reason: parsed.data.reason });
      res.json(updated);
    } catch (err) {
      handlePaymentError(err, res);
    }
  }
);

const clarifySchema = z.object({ message: z.string().min(3, "Explain what additional information is needed.") });

paymentsRouter.post(
  "/:id/request-clarification",
  requireRole("administrator", "landlady"),
  requirePermission("verify_payments"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = clarifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "message is required." } });
    }
    try {
      const updated = await requestClarification({ paymentId: req.params.id, requestedBy: req.user!.id, message: parsed.data.message });
      res.json(updated);
    } catch (err) {
      handlePaymentError(err, res);
    }
  }
);

// ---------------------------------------------------------------------------
// Correction (docs Section 47) - the ONLY way to change a verified
// payment's amount. Same permission as verify/reject/clarify, since it's
// the same trust boundary (whoever can verify a payment can correct one).
// ---------------------------------------------------------------------------
const correctSchema = z.object({
  reason: z.string().min(5, "Explain why this payment is being corrected."),
  newAmount: z.number().positive(),
});

paymentsRouter.post(
  "/:id/correct",
  requireRole("administrator", "landlady"),
  requirePermission("verify_payments"),
  async (req: AuthenticatedRequest, res) => {
    const parsed = correctSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." } });
    }
    try {
      const updated = await correctPayment({
        paymentId: req.params.id, correctedBy: req.user!.id,
        reason: parsed.data.reason, newAmount: parsed.data.newAmount,
      });
      res.json(updated);
    } catch (err) {
      handlePaymentError(err, res);
    }
  }
);
