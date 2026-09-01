import { sendEmail } from "../lib/mailer";
import { sendSms } from "../lib/sms";

/**
 * Sends a message to a person via email if they have one, otherwise SMS.
 * Same priority as the password-reset and application-approval flows -
 * this is the shared helper those two *could* also be refactored onto,
 * kept separate for now since they have richer HTML templates.
 *
 * Never throws (sendEmail/sendSms already swallow their own errors and log
 * instead) - a failed notification send should never fail the request that
 * triggered it (e.g. a payment verification shouldn't 500 because the
 * email provider hiccuped).
 */
export async function notifyByEmailOrSms(params: {
  email?: string | null;
  phone?: string | null;
  subject: string;
  message: string;
}): Promise<void> {
  const { email, phone, subject, message } = params;
  if (email) {
    await sendEmail({ to: email, subject, text: message, html: `<p>${message}</p>` });
  } else if (phone) {
    await sendSms(phone, `Executive Hostel: ${message}`);
  }
  // If neither is on file, there's genuinely nowhere to send this - the
  // in-app Notification row (created separately, before this is called)
  // is the only record, same as it already was before this helper existed.
}
