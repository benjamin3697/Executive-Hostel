import { prisma } from "../lib/prisma";

interface AuditParams {
  actorId: string | null;
  action: string; // e.g. "auth.login", "payment.verified", "student.profile_updated"
  entityType?: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Writes an audit log row. Per the security design (docs Section 9 & 46),
 * every mutating action in the system should call this - not just payments.
 * Never throws into the caller's request flow; a failed audit write is
 * logged to stderr but does not block the underlying action, since that
 * would make the whole API fragile to a logging outage. (If your compliance
 * needs require audit-write to be transactional with the action itself,
 * call this inside the same prisma.$transaction as the mutation instead.)
 */
export async function recordAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousValue: params.previousValue as any,
        newValue: params.newValue as any,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
