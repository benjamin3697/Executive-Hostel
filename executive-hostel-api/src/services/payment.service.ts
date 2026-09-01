import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { notifyByEmailOrSms } from "./notify.service";

// Local shape for the .then() destructuring below - same reasoning as
// elsewhere in this project: this sandbox can't run `prisma generate`
// against a real schema, so implicit `any` shows up on destructured
// Promise.then() results that would otherwise be correctly inferred once
// you run `npx prisma generate` for real. Both fields are read-only here.
interface PaymentWithStudentContact {
  updated: Record<string, unknown> & { amount: unknown };
  student: { user: { email: string | null; phone: string | null } };
}

export class PaymentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * The fee that applies to a student right now. Looks up the student's
 * current room type AND their enrolled semester (docs update: recess
 * semesters commonly cost less than a regular semester, so the fee must be
 * semester-aware, not just room-type-aware).
 *
 * Lookup order:
 *  1. A fee scoped to this exact room type + this exact semester (the most
 *     specific match - e.g. "Non-Self-Contained, Recess 2024").
 *  2. If none exists, the room type's default fee (no semester scoping) -
 *     this is deliberately the fallback, not an error: a hostel that
 *     hasn't configured a separate recess rate yet should charge the
 *     configured default, matching "what we configured should be the
 *     default" rather than blocking payment until every semester variant
 *     is manually priced.
 *
 * If the student isn't enrolled in any semester yet (semesterId is null -
 * true for anyone not yet explicitly enrolled by an admin), this skips
 * straight to the room-type default, same as before this semester-aware
 * lookup existed.
 */
export async function getCurrentFeeForStudent(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { currentRoom: true },
  });
  if (!student?.currentRoom) return null;

  if (student.semesterId) {
    const semesterSpecific = await prisma.accommodationFee.findFirst({
      where: { roomTypeId: student.currentRoom.roomTypeId, semesterId: student.semesterId, effectiveDate: { lte: new Date() } },
      orderBy: { effectiveDate: "desc" },
    });
    if (semesterSpecific) return semesterSpecific;
  }

  return prisma.accommodationFee.findFirst({
    where: { roomTypeId: student.currentRoom.roomTypeId, semesterId: null, effectiveDate: { lte: new Date() } },
    orderBy: { effectiveDate: "desc" },
  });
}

/**
 * Pure arithmetic, zero I/O - split out from getStudentBalanceSummary so it
 * can be unit-tested directly (see tests/payment-balance.test.ts) without
 * spinning up a database. This is the exact logic verified by hand against
 * the docs' worked example during Phase 6/7 development.
 */
export interface PaymentForBalance {
  status: string;
  amount: Decimal | number | string; // Prisma.Decimal stringifies/numbers cleanly via Number()
}

export function summarizeBalance(feeAmount: number | null, payments: PaymentForBalance[]) {
  const verifiedPaid = payments
    .filter((p) => p.status === "verified")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = payments
    .filter((p) => p.status === "pending" || p.status === "clarification_requested")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const balance = feeAmount !== null ? Math.max(feeAmount - verifiedPaid, 0) : null;

  let status: string;
  if (feeAmount === null) status = "no_active_accommodation";
  else if (verifiedPaid >= feeAmount) status = "fully_paid";
  else if (verifiedPaid > 0) status = "partially_paid";
  else status = "outstanding";

  return { fee: feeAmount, verifiedPaid, pendingAmount, balance, status };
}

/**
 * A student's balance summary (docs Section 21), scoped to their currently
 * enrolled semester.
 *
 * This is a deliberate fix to a real gap: payments are tied to a specific
 * semester (Payment.semesterId, set at submission time), so a student's
 * balance must only count payments made FOR their current semester - not
 * every payment they've ever made. Without this scoping, a student who
 * already paid in full for Semester 1 would incorrectly show as
 * "fully paid" the moment an admin enrolls them into Semester 2, even
 * though they haven't paid a shilling toward it yet.
 *
 * Backward-compatible fallback: if the student isn't enrolled in any
 * semester (semesterId is null - true before an admin has ever run the
 * enrollment step), this falls back to the original lifetime-cumulative
 * behavior, since there's no semester to scope payments to yet.
 */
export async function getStudentBalanceSummary(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { semesterId: true } });
  const fee = await getCurrentFeeForStudent(studentId);
  const payments = await prisma.payment.findMany({
    where: student?.semesterId ? { studentId, semesterId: student.semesterId } : { studentId },
  });
  const feeAmount = fee ? Number(fee.amount) : null;
  return summarizeBalance(feeAmount, payments);
}

/**
 * Verifies a pending payment (docs Section 17). Runs in a transaction and,
 * per Section 47, never mutates a payment that's already verified - if this
 * is somehow called on a non-pending payment it throws rather than silently
 * re-verifying or overwriting history.
 */
export async function verifyPayment(params: { paymentId: string; verifiedBy: string; adminRemarks?: string }) {
  const { paymentId, verifiedBy, adminRemarks } = params;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaymentError("NOT_FOUND", "Payment not found.");
    if (payment.status !== "pending" && payment.status !== "clarification_requested") {
      throw new PaymentError("INVALID_STATE", `Payment is '${payment.status}' and cannot be verified from this state.`);
    }
    const student = await tx.student.findUnique({ where: { id: payment.studentId }, include: { user: true } });
    if (!student) throw new PaymentError("NOT_FOUND", "The student who submitted this payment no longer exists.");

    const priorVerified = await tx.payment.aggregate({
      where: { studentId: payment.studentId, status: "verified", semesterId: payment.semesterId },
      _sum: { amount: true },
    });
    const previousBalanceAmount = Number(priorVerified._sum.amount ?? 0);

    const fee = await getCurrentFeeForStudent(payment.studentId);
    const feeAmount = fee ? Number(fee.amount) : null;
    const newVerifiedTotal = previousBalanceAmount + Number(payment.amount);
    const remainingBalance = feeAmount !== null ? Math.max(feeAmount - newVerifiedTotal, 0) : null;

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "verified",
        verifiedBy,
        verifiedAt: new Date(),
        adminRemarks,
        previousBalance: previousBalanceAmount,
        remainingBalance: remainingBalance ?? undefined,
        accommodationFeeId: fee?.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: verifiedBy, action: "payment.verified",
        entityType: "Payment", entityId: paymentId,
        previousValue: { status: payment.status } as any,
        newValue: { status: "verified", amount: payment.amount } as any,
      },
    });
    await tx.notification.create({
      data: { recipientId: student.userId, type: "payment.verified", payload: { paymentId, amount: payment.amount } as any },
    });

    return { updated, student };
  }).then(async ({ updated, student }: PaymentWithStudentContact) => {
    // Real email/SMS delivery, deliberately after the transaction commits -
    // an external API call inside a DB transaction holds the connection
    // open and risks the whole verification failing on a slow email
    // provider, which would be a strange failure mode for something this
    // financially important.
    await notifyByEmailOrSms({
      email: student.user.email, phone: student.user.phone,
      subject: "Payment verified",
      message: `Your payment of UGX ${Number(updated.amount).toLocaleString()} has been verified. Check your dashboard for your updated balance.`,
    });
    return updated;
  });
}

export async function rejectPayment(params: { paymentId: string; rejectedBy: string; reason: string }) {
  const { paymentId, rejectedBy, reason } = params;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaymentError("NOT_FOUND", "Payment not found.");
    if (payment.status === "verified") {
      throw new PaymentError("INVALID_STATE", "A verified payment cannot be rejected. Use a correction instead.");
    }
    const student = await tx.student.findUnique({ where: { id: payment.studentId }, include: { user: true } });
    if (!student) throw new PaymentError("NOT_FOUND", "The student who submitted this payment no longer exists.");

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "rejected", rejectionReason: reason, verifiedBy: rejectedBy, verifiedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: rejectedBy, action: "payment.rejected",
        entityType: "Payment", entityId: paymentId,
        newValue: { reason } as any,
      },
    });
    await tx.notification.create({
      data: { recipientId: student.userId, type: "payment.rejected", payload: { paymentId, reason } as any },
    });

    return { updated, student };
  }).then(async ({ updated, student }: PaymentWithStudentContact) => {
    await notifyByEmailOrSms({
      email: student.user.email, phone: student.user.phone,
      subject: "Payment rejected",
      message: `Your payment submission was rejected: ${reason}. You can submit a corrected payment record from your dashboard.`,
    });
    return updated;
  });
}

export async function requestClarification(params: { paymentId: string; requestedBy: string; message: string }) {
  const { paymentId, requestedBy, message } = params;
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaymentError("NOT_FOUND", "Payment not found.");
    if (payment.status === "verified") {
      throw new PaymentError("INVALID_STATE", "This payment is already verified.");
    }
    const student = await tx.student.findUnique({ where: { id: payment.studentId }, include: { user: true } });
    if (!student) throw new PaymentError("NOT_FOUND", "The student who submitted this payment no longer exists.");

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "clarification_requested", adminRemarks: message },
    });

    await tx.auditLog.create({
      data: { actorId: requestedBy, action: "payment.clarification_requested", entityType: "Payment", entityId: paymentId },
    });
    await tx.notification.create({
      data: { recipientId: student.userId, type: "payment.clarification_requested", payload: { paymentId, message } as any },
    });

    return { updated, student };
  }).then(async ({ updated, student }: PaymentWithStudentContact) => {
    await notifyByEmailOrSms({
      email: student.user.email, phone: student.user.phone,
      subject: "Clarification needed on your payment",
      message: `The hostel needs more information about your payment submission: ${message}. Please respond via your dashboard.`,
    });
    return updated;
  });
}

/**
 * Corrects a VERIFIED payment's amount (docs Section 47: "No administrator
 * should be able to silently change a verified payment"). This is the only
 * legitimate way to change a verified payment's amount - there is no
 * generic PATCH /payments/:id, by design.
 *
 * Every correction:
 *  1. Writes a PaymentCorrection row (previous amount, new amount, reason,
 *     who, when) - the original transaction history is never deleted.
 *  2. Updates the Payment's amount and recomputes its balance snapshot.
 *  3. Writes an AuditLog entry.
 *  4. Notifies the student (in-app + email/SMS).
 *
 * Deliberately restricted to `verified` payments only - a `pending` or
 * `rejected` payment doesn't need this machinery, since nothing has been
 * counted toward the student's balance yet; the student can simply
 * resubmit, or an admin can just re-review it normally.
 */
export async function correctPayment(params: { paymentId: string; correctedBy: string; reason: string; newAmount: number }) {
  const { paymentId, correctedBy, reason, newAmount } = params;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaymentError("NOT_FOUND", "Payment not found.");
    if (payment.status !== "verified") {
      throw new PaymentError("INVALID_STATE", "Only a verified payment can be corrected. Pending/rejected payments can simply be re-reviewed or resubmitted.");
    }
    const previousAmount = Number(payment.amount);
    if (newAmount === previousAmount) {
      throw new PaymentError("NO_CHANGE", "The new amount matches the current amount - nothing to correct.");
    }
    const student = await tx.student.findUnique({ where: { id: payment.studentId }, include: { user: true } });
    if (!student) throw new PaymentError("NOT_FOUND", "The student who submitted this payment no longer exists.");

    await tx.paymentCorrection.create({
      data: { paymentId, correctedBy, reason, previousAmount, newAmount },
    });

    // Recompute this payment's balance snapshot with the corrected amount,
    // same calculation used at verification time - scoped to the same
    // semester this payment was made for.
    const otherVerifiedSum = await tx.payment.aggregate({
      where: { studentId: payment.studentId, status: "verified", semesterId: payment.semesterId, id: { not: paymentId } },
      _sum: { amount: true },
    });
    const previousBalanceAmount = Number(otherVerifiedSum._sum.amount ?? 0);
    const fee = await getCurrentFeeForStudent(payment.studentId);
    const feeAmount = fee ? Number(fee.amount) : null;
    const newVerifiedTotal = previousBalanceAmount + newAmount;
    const remainingBalance = feeAmount !== null ? Math.max(feeAmount - newVerifiedTotal, 0) : null;

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { amount: newAmount, previousBalance: previousBalanceAmount, remainingBalance: remainingBalance ?? undefined },
    });

    await tx.auditLog.create({
      data: {
        actorId: correctedBy, action: "payment.corrected",
        entityType: "Payment", entityId: paymentId,
        previousValue: { amount: previousAmount } as any,
        newValue: { amount: newAmount, reason } as any,
      },
    });
    await tx.notification.create({
      data: { recipientId: student.userId, type: "payment.corrected", payload: { paymentId, previousAmount, newAmount, reason } as any },
    });

    return { updated, student, previousAmount };
  }).then(async ({ updated, student, previousAmount }: PaymentWithStudentContact & { previousAmount: number }) => {
    await notifyByEmailOrSms({
      email: student.user.email, phone: student.user.phone,
      subject: "Your payment record was corrected",
      message: `Your verified payment was corrected from UGX ${previousAmount.toLocaleString()} to UGX ${newAmount.toLocaleString()}. Reason: ${reason}. Check your dashboard for your updated balance.`,
    });
    return updated;
  });
}
