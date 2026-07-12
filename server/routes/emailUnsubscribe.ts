// Public, no-auth unsubscribe link clicked from a campaign email (see
// server/email/campaign.ts) — same reasoning as whatsappWebhook.ts for why
// this is a separate, unauthenticated router: the recipient's mail client
// can't send a session cookie or API key.
import { Router } from "express";
import { db } from "../index.js";

const router = Router();

router.get("/:token", (req, res) => {
  const ok = db.unsubscribeByToken(req.params.token as string);
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribe</title></head>
    <body style="font-family:Arial,Helvetica,sans-serif;text-align:center;padding:60px 20px;color:#1a1a2e;">
      ${ok ? "<h2>You've been unsubscribed</h2><p>You won't receive any more marketing emails from us.</p>"
           : "<h2>Link not recognized</h2><p>This unsubscribe link is invalid or has already been used.</p>"}
    </body></html>`);
});

export default router;
