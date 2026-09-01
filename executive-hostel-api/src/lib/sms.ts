import { env } from "./env";

/**
 * Normalizes a Ugandan phone number to E.164 (+256XXXXXXXXX) for the SMS
 * API. Students commonly enter numbers as "07XXXXXXXX" (local format);
 * this also passes through numbers already in international format
 * unchanged, and leaves anything unrecognizable as-is rather than
 * guessing wrong.
 */
export function normalizeUgandanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("256")) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 10) return `+256${cleaned.slice(1)}`;
  return cleaned; // unrecognized format - pass through, let the SMS provider reject it loudly rather than silently mis-sending
}

/**
 * Sends an SMS via Africa's Talking' messaging API. If AT_API_KEY isn't
 * configured, logs to the console instead of sending - same reasoning as
 * sendEmail() in mailer.ts: never throws into the caller's request flow,
 * and makes the "not actually delivering" state loud rather than silent.
 */
export async function sendSms(to: string, message: string): Promise<boolean> {
  const recipient = normalizeUgandanPhone(to);

  if (!env.atApiKey) {
    console.log(`[SMS NOT CONFIGURED - would send to ${recipient}]\n${message}`);
    return false;
  }

  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: env.atApiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ username: env.atUsername, to: recipient, message }).toString(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Africa's Talking API error (${res.status}) sending to ${recipient}: ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send SMS to ${recipient}:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Templated SMS for the two flows that need phone-only delivery. Kept short
// - SMS is billed and rendered per-segment (~160 chars), so no HTML
// templating here, just plain text.
// ---------------------------------------------------------------------------

export async function sendPasswordResetSms(to: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${env.appUrl}/reset-password?token=${resetToken}`;
  return sendSms(to, `Executive Hostel: Reset your password here (valid 1 hour): ${resetUrl}`);
}

export async function sendApplicationApprovedSms(to: string, fullName: string, temporaryPassword: string): Promise<boolean> {
  const loginUrl = `${env.appUrl}/login`;
  return sendSms(
    to,
    `Executive Hostel: Hi ${fullName}, your application is approved. Login at ${loginUrl} with this phone number and temporary password: ${temporaryPassword}. Please change it after logging in.`
  );
}
