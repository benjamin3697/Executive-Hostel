import { env } from "./env";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email via Resend's API (a single HTTPS POST, no SDK). If
 * RESEND_API_KEY isn't configured, logs the email to the console instead of
 * sending it and returns without throwing - this keeps local dev and this
 * project's automated tests working without real credentials, while making
 * the "not actually delivering" state loud and obvious rather than a silent
 * no-op.
 *
 * Never throws on delivery failure into the caller's request flow (a flaky
 * email provider shouldn't 500 a password-reset request that otherwise
 * succeeded) - errors are logged instead. If your compliance needs require
 * guaranteed delivery, queue this through a retryable job instead of
 * calling it inline.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!env.resendApiKey) {
    console.log(`[EMAIL NOT CONFIGURED - would send to ${params.to}]\nSubject: ${params.subject}\n${params.text}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Resend API error (${res.status}) sending to ${params.to}: ${body}`);
    }
  } catch (err) {
    console.error(`Failed to send email to ${params.to}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Templated emails for the two flows that needed real delivery to become
// production-safe rather than "an admin relays a plaintext secret by hand."
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const resetUrl = `${env.appUrl}/reset-password?token=${resetToken}`;
  await sendEmail({
    to,
    subject: "Reset your Executive Hostel password",
    text: `We received a request to reset your password. Use this link within the next hour:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <p>We received a request to reset your Executive Hostel account password.</p>
      <p><a href="${resetUrl}" style="background:#C9663A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p style="color:#8A7A6D;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

export async function sendApplicationApprovedEmail(to: string, fullName: string, temporaryPassword: string): Promise<void> {
  const loginUrl = `${env.appUrl}/login`;
  await sendEmail({
    to,
    subject: "Your Executive Hostel accommodation is confirmed",
    text: `Hi ${fullName},\n\nYour application has been approved. Log in at ${loginUrl} using this email and the temporary password below, then change your password immediately from your profile.\n\nTemporary password: ${temporaryPassword}\n\nA room will be assigned to your account shortly - check your dashboard.`,
    html: `
      <p>Hi ${fullName},</p>
      <p>Your application to Executive Hostel has been <strong>approved</strong>.</p>
      <p>Log in at <a href="${loginUrl}">${loginUrl}</a> using this email address and the temporary password below. Please change it from your profile immediately after logging in.</p>
      <p style="font-family:monospace;background:#F5E1D6;padding:10px 14px;border-radius:6px;display:inline-block;">${temporaryPassword}</p>
      <p style="color:#8A7A6D;font-size:13px;">A room will be assigned to your account shortly - check your dashboard after logging in.</p>
    `,
  });
}
