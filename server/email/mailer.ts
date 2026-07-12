// Thin wrapper around Nodemailer (MIT-licensed, the standard Node.js
// SMTP-sending library — https://nodemailer.com/) for order notification
// emails. Independent of the WhatsApp integration; see server/whatsapp/
// for that one's equivalent (metaClient.ts).
import nodemailer from "nodemailer";

// PLUG IN REAL VALUES: SMTP credentials for whatever mail account/server
// this instance should send through — any normal business email account's
// SMTP details work (Gmail, Office 365, a hosting provider's mailbox), or
// point this at a self-hosted mail server if you'd rather not use a third
// party at all. None of these are synced through the control plane (same
// reasoning as WHATSAPP_ACCESS_TOKEN) — real secrets stay local-only.
const SMTP_HOST = process.env.EMAIL_SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.EMAIL_SMTP_PORT ?? "587");
const SMTP_USER = process.env.EMAIL_SMTP_USER ?? "";
const SMTP_PASS = process.env.EMAIL_SMTP_PASS ?? "";
// PLUG IN REAL VALUES: the address customers see as the sender — most SMTP
// providers reject sends where this doesn't match (or isn't authorized
// for) the authenticated account, so this usually needs to be the same
// address/domain as EMAIL_SMTP_USER.
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? "";

// Built once and reused — Nodemailer transports pool connections
// internally, so there's no need to recreate this per send.
const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
    })
  : null;

export interface SendEmailResult {
  ok: boolean;
  error: string | null;
}

// Never throws — a slow or unreachable SMTP server can never block the
// order flow that triggered a send (same posture as
// server/whatsapp/metaClient.ts's sendTemplateMessage/sendFreeformMessage).
export async function sendEmail(to: string, subject: string, body: string): Promise<SendEmailResult> {
  if (!transporter || !FROM_ADDRESS) {
    return { ok: false, error: "Email is not configured on this instance (EMAIL_SMTP_HOST/EMAIL_FROM_ADDRESS unset)" };
  }
  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, text: body });
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
