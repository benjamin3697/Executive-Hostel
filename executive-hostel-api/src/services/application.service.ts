import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import { sendApplicationApprovedEmail } from "../lib/mailer";
import { sendApplicationApprovedSms } from "../lib/sms";
import { env } from "../lib/env";
import { Prisma } from "@prisma/client";

export class ApplicationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function generateTemporaryPassword(): string {
  // 12 random bytes -> readable base64url string, e.g. "kQ9f2mZ8xVra"
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Approves an application and provisions the resulting student account
 * (docs Section 36-37: "Once an application is approved, the administrator
 * should be able to assign a vacant room" implies the student needs an
 * account to log in with at that point).
 *
 * Delivery of the temporary password, in order of preference:
 *  1. Email (Resend), if the applicant has one on file - response has no
 *     plaintext password at all.
 *  2. SMS (Africa's Talking), to the phone number every applicant provides
 *     (phone is a required field on the application form) - also no
 *     plaintext password in the response.
 *  3. Only if NEITHER provider is actually configured (no API key set) does
 *     the response include the plaintext password, so the flow is still
 *     testable/usable during local development without real credentials.
 *     `deliveryMethod` tells the caller which of these happened.
 */
export async function approveApplication(params: { applicationId: string; reviewedBy: string }) {
  const { applicationId, reviewedBy } = params;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const application = await tx.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new ApplicationError("NOT_FOUND", "Application not found.");
    if (application.status !== "submitted" && application.status !== "under_review") {
      throw new ApplicationError("INVALID_STATE", `Application is already '${application.status}'.`);
    }

    if (application.registrationNumber) {
      const existingStudent = await tx.student.findUnique({ where: { registrationNumber: application.registrationNumber } });
      if (existingStudent) {
        throw new ApplicationError("ALREADY_EXISTS", "A student with this registration number already exists. Link the application manually if this is a re-application.");
      }
    }
    if (application.email) {
      const existingUser = await tx.user.findFirst({ where: { OR: [{ email: application.email }, { phone: application.phone }] } });
      if (existingUser) {
        throw new ApplicationError("ALREADY_EXISTS", "An account with this email or phone already exists.");
      }
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await tx.user.create({
      data: { email: application.email ?? undefined, phone: application.phone, passwordHash, role: "student" },
    });
    const student = await tx.student.create({
      data: {
        userId: user.id,
        fullName: application.fullName,
        registrationNumber: application.registrationNumber ?? `PENDING-${user.id.slice(0, 8)}`,
        course: application.course,
        yearOfStudy: application.yearOfStudy,
        semesterId: application.semesterId,
        phone: application.phone,
        email: application.email,
        status: "applicant", // becomes "active" at check-in, not at approval
        termsAcceptedAt: application.termsAcceptedAt, // carried over from the application - the digital equivalent of the PDF's "Undertaking by the Resident" signature
      },
    });

    const updatedApplication = await tx.application.update({
      where: { id: applicationId },
      data: { status: "approved", reviewedBy, reviewedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: reviewedBy, action: "application.approved",
        entityType: "Application", entityId: applicationId,
        newValue: { studentId: student.id, userId: user.id } as any,
      },
    });

    return {
      application: updatedApplication, studentId: student.id, userId: user.id, temporaryPassword,
      email: application.email, phone: application.phone, fullName: application.fullName,
    };
  });

  const base = { application: result.application, studentId: result.studentId, userId: result.userId };

  if (result.email) {
    await sendApplicationApprovedEmail(result.email, result.fullName, result.temporaryPassword);
    return { ...base, deliveryMethod: "email" as const, message: `Login details emailed to ${result.email}.` };
  }

  if (env.atApiKey) {
    // SMS is actually configured - use it, and don't expose the password.
    const sent = await sendApplicationApprovedSms(result.phone, result.fullName, result.temporaryPassword);
    if (sent) {
      return { ...base, deliveryMethod: "sms" as const, message: `Login details sent by SMS to ${result.phone}.` };
    }
    // Configured but the send itself failed (bad number, provider outage,
    // etc.) - fall through to the manual fallback below so the admin isn't
    // left with no way to get the applicant logged in.
  }

  return {
    ...base, deliveryMethod: "manual" as const, temporaryPassword: result.temporaryPassword,
    message: env.atApiKey
      ? "SMS delivery failed - relay this temporary password to the applicant directly."
      : "No email on file and SMS isn't configured - relay this temporary password to the applicant directly.",
  };
}

export async function decideApplication(params: {
  applicationId: string;
  decision: "under_review" | "rejected" | "waitlisted" | "cancelled";
  reviewedBy: string;
}) {
  const { applicationId, decision, reviewedBy } = params;

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new ApplicationError("NOT_FOUND", "Application not found.");
  if (application.status === "approved") {
    throw new ApplicationError("INVALID_STATE", "This application was already approved and has a student account - it can't be moved to another status here.");
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: decision, reviewedBy, reviewedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: reviewedBy, action: `application.${decision}`,
      entityType: "Application", entityId: applicationId,
    },
  });

  return updated;
}
