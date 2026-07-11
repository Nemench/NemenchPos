// Receives inbound WhatsApp messages and Meta's webhook verification
// handshake. Mounted PUBLIC (no requireAuth) at /api/whatsapp/webhook —
// Meta calls this directly, it can't send a session cookie or API key.
// Authenticity instead comes from (a) the GET verify-token check on setup,
// and (b) PLUG IN REAL VALUES: for production you should also verify the
// `X-Hub-Signature-256` header against WHATSAPP_APP_SECRET (Meta signs
// every POST body with HMAC-SHA256) — not yet implemented here; see the
// TODO below. Without it, this endpoint currently trusts any POST body
// shaped like a WhatsApp payload.
import { Router } from "express";
import { db } from "../index.js";

const router = Router();

// PLUG IN REAL VALUES: set this to whatever string you choose when
// configuring the webhook in Meta's App Dashboard (WhatsApp > Configuration
// > Webhook > Verify Token) — Meta echoes it back on the GET verification
// request, and this must match exactly or the subscription will fail.
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";

// TODO PLUG IN REAL VALUES: WHATSAPP_APP_SECRET — used to verify the
// X-Hub-Signature-256 header on every inbound POST (HMAC-SHA256 of the raw
// body, compared with crypto.timingSafeEqual). Not implemented yet because
// it requires switching this route's body parsing from express.json() to a
// raw-body verifier before JSON parsing — flagged here rather than done
// silently wrong. Until this is added, treat this endpoint as verifying
// only who *can reach* it (network/firewall), not who *sent* each request.

// Meta's one-time subscription verification handshake.
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN && VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Inbound message delivery. Meta's payload shape (WhatsApp Cloud API
// webhook, `messages` field): entry[].changes[].value.{contacts[],messages[]}.
router.post("/webhook", (req, res) => {
  // Acknowledge immediately — Meta expects a fast 200 and will retry/
  // disable the webhook on repeated timeouts; do the work synchronously
  // here since it's cheap (a couple of sqlite writes), but respond first
  // isn't required by better-sqlite3's sync API, so this is just defensive.
  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        const messages = value?.messages ?? [];
        const contactNames: Record<string, string> = {};
        for (const c of value?.contacts ?? []) {
          if (c?.wa_id && c?.profile?.name) contactNames[c.wa_id] = c.profile.name;
        }
        for (const msg of messages) {
          const fromPhone: string | undefined = msg?.from;
          if (!fromPhone) continue;
          const body: string = msg?.text?.body ?? `[unsupported message type: ${msg?.type ?? "unknown"}]`;
          const contact = db.resolveOrCreateContactByPhone(fromPhone);
          // If this is a brand-new contact and WhatsApp gave us a display
          // name, capture it — but never overwrite a name staff already
          // entered manually.
          if (!contact.fullName && contactNames[fromPhone]) {
            db.updateContact(contact.id, { fullName: contactNames[fromPhone] });
          }
          db.insertMessage({
            contactId: contact.id,
            direction: "inbound",
            messageType: "freeform",
            body,
            status: "delivered",
            triggeredBy: "customer",
            waMessageId: msg?.id ?? null
          });
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp-webhook] failed to process inbound payload:", err);
  }
  res.sendStatus(200);
});

export default router;
