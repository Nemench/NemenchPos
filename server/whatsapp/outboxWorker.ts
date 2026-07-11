// Drains whatsapp_outbox on a fixed interval, actually calling the Meta
// Graph API and recording the result. Split from automation.ts /
// server/routes/crm.ts (which only enqueue) so a slow/unreachable Meta API
// never blocks the request that queued the message — sends always happen
// out-of-band, here.
import { db } from "../index.js";
import { sendTemplateMessage, sendFreeformMessage } from "./metaClient.js";

const POLL_INTERVAL_MS = 15_000;
const MAX_ATTEMPTS = 5;

async function processOne(item: ReturnType<typeof db.listPendingOutbox>[number]): Promise<void> {
  if (item.attempts >= MAX_ATTEMPTS) {
    db.resolveOutboxSend(item.id, "failed", null, true);
    console.error(`[whatsapp-outbox] giving up on ${item.id} after ${item.attempts} attempts`);
    return;
  }

  const contact = db.getContact(item.contactId);
  if (!contact) {
    db.resolveOutboxSend(item.id, "failed", null, true);
    console.error(`[whatsapp-outbox] contact ${item.contactId} missing for outbox item ${item.id}`);
    return;
  }

  const result = item.templateName
    ? await sendTemplateMessage(contact.phoneNumber, item.templateName, item.templateParams ? JSON.parse(item.templateParams) : [])
    : await sendFreeformMessage(contact.phoneNumber, item.freeformBody ?? "");

  if (result.ok) {
    db.resolveOutboxSend(item.id, "sent", result.waMessageId);
  } else {
    const permanent = item.attempts + 1 >= MAX_ATTEMPTS;
    db.resolveOutboxSend(item.id, "failed", null, permanent);
    console.warn(`[whatsapp-outbox] send failed for ${item.id} (attempt ${item.attempts + 1}${permanent ? ", giving up" : ", will retry"}): ${result.error}`);
  }
}

async function drainOnce(): Promise<void> {
  const pending = db.listPendingOutbox();
  for (const item of pending) {
    await processOne(item);
  }
}

export function startOutboxWorker(): void {
  setInterval(() => void drainOnce().catch((err) => console.error("[whatsapp-outbox] drain failed:", err)), POLL_INTERVAL_MS);
}
