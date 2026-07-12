// Drains email_outbox on a fixed interval, actually sending via SMTP
// (server/email/mailer.ts) and recording the result. Split from
// automation.ts (which only enqueues) so a slow/unreachable mail server
// never blocks the request that queued the notification — sends always
// happen out-of-band, here. Mirrors server/whatsapp/outboxWorker.ts's
// retry/permanent-fail shape, copied rather than shared since each
// channel's retry needs are independent and simple on their own.
import { db } from "../index.js";
import { sendEmail } from "./mailer.js";

const POLL_INTERVAL_MS = 15_000;
const MAX_ATTEMPTS = 5;

async function processOne(item: ReturnType<typeof db.listPendingEmails>[number]): Promise<void> {
  if (item.attempts >= MAX_ATTEMPTS) {
    db.recordEmailAttempt(item.id, "failed", true);
    console.error(`[email-outbox] giving up on ${item.id} after ${item.attempts} attempts`);
    return;
  }

  const result = await sendEmail(item.toEmail, item.subject, item.body, item.htmlBody);
  if (result.ok) {
    db.recordEmailAttempt(item.id, "sent");
  } else {
    const permanent = item.attempts + 1 >= MAX_ATTEMPTS;
    db.recordEmailAttempt(item.id, "failed", permanent);
    console.warn(`[email-outbox] send failed for ${item.id} (attempt ${item.attempts + 1}${permanent ? ", giving up" : ", will retry"}): ${result.error}`);
  }
}

async function drainOnce(): Promise<void> {
  for (const item of db.listPendingEmails()) {
    await processOne(item);
  }
}

export function startEmailOutboxWorker(): void {
  setInterval(() => void drainOnce().catch((err) => console.error("[email-outbox] drain failed:", err)), POLL_INTERVAL_MS);
}
