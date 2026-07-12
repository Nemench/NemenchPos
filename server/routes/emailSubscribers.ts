// Admin API for the email marketing list: view/add/remove subscribers
// (mostly auto-captured from order checkouts, see db.upsertEmailSubscriber
// in orders.ts) and send a one-off news/deals broadcast to everyone still
// subscribed. Admin-only, same posture as crm.ts — a list of customer
// names/emails is sensitive customer data.
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";
import { buildCampaignHtml } from "../email/campaign.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", (_req, res) => { res.json(db.listEmailSubscribers()); });

router.post("/", (req: AuthRequest, res) => {
  const { email, name } = req.body as { email?: string; name?: string };
  if (!email || !/\S+@\S+\.\S+/.test(email)) { res.status(400).json({ message: "Enter a valid email address" }); return; }
  try { res.status(201).json(db.addEmailSubscriber(email, name?.trim() || null)); }
  catch (err) { res.status(400).json({ message: err instanceof Error ? err.message : "Failed to add subscriber" }); }
});

router.patch("/:id", (req: AuthRequest, res) => {
  const { status } = req.body as { status?: string };
  if (status !== "subscribed" && status !== "unsubscribed") { res.status(400).json({ message: "status must be 'subscribed' or 'unsubscribed'" }); return; }
  try { res.json(db.setEmailSubscriberStatus(req.params.id as string, status)); }
  catch (err) { res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update subscriber" }); }
});

router.delete("/:id", (req, res) => {
  db.deleteEmailSubscriber(req.params.id as string);
  res.json({ success: true });
});

// Queues one email per currently-subscribed address via the same
// email_outbox the order-notification system uses (server/email/worker.ts
// drains it out-of-band), so a broadcast to a large list never blocks this
// request. The unsubscribe link is built from this request's own
// origin — the same "reachable by whoever can reach this server" caveat
// documented on buildReceiptHtml's logo handling applies here too, but
// unlike the logo there's no way around it without a public domain.
router.post("/send-campaign", (req: AuthRequest, res) => {
  const { subject, body } = req.body as { subject?: string; body?: string };
  if (!subject?.trim() || !body?.trim()) { res.status(400).json({ message: "Subject and message are required" }); return; }
  const settings = db.getAllSettings();
  const siteName = settings.siteName || "NemenchPos";
  const origin = `${req.protocol}://${req.get("host")}`;
  const subscribers = db.listSubscribedEmails();
  for (const sub of subscribers) {
    const token = db.getEmailSubscriberToken(sub.id);
    const unsubscribeUrl = `${origin}/api/unsubscribe/${token}`;
    const html = buildCampaignHtml(siteName, settings.logoUrl || "", body, unsubscribeUrl);
    db.enqueueEmail(null, sub.email, subject, body, html);
  }
  res.json({ queued: subscribers.length });
});

export default router;
