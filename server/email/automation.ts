// Fires an order-notification email for a business event (order_ready,
// payment_received) — independent of the WhatsApp automation in
// server/whatsapp/automation.ts (see server/database.ts's email_outbox
// schema comment for why: no consent/contact indirection, free-text
// templates since there's no Meta-style approval process to constrain
// them). Called from server/routes/orders.ts right next to the WhatsApp
// trigger, at the same two points. Never throws — a mistake here must
// never surface into the order-status/payment code path that calls it.
import { db } from "../index.js";
import type { Order } from "../../src/shared/types.js";

export type EmailEvent = "order_ready" | "payment_received";

// {{customerName}} / {{ticketNumber}} / {{amount}} — plain string
// substitution, not the WhatsApp templates' positional-array shape, since
// there's no pre-approval process constraining what an admin can write
// into the subject/body settings fields.
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? "");
}

export function triggerEmailNotification(event: EmailEvent, order: Order): boolean {
  try {
    if (!order.customerEmail) return false; // no email captured at checkout — nothing to do

    const settings = db.getAllSettings();
    if (settings.emailNotificationsEnabled !== "true") return false;

    const subjectTemplate = event === "order_ready" ? settings.emailOrderReadySubject : settings.emailPaymentReceivedSubject;
    const bodyTemplate = event === "order_ready" ? settings.emailOrderReadyBody : settings.emailPaymentReceivedBody;
    if (!subjectTemplate || !bodyTemplate) return false; // admin hasn't written a template for this event yet

    const amount = order.items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) - order.discountAmount;
    const vars = {
      customerName: order.customerName?.trim() || "there",
      ticketNumber: order.ticketNumber,
      amount: `R${amount.toFixed(2)}`
    };

    db.enqueueEmail(order.id, order.customerEmail, renderTemplate(subjectTemplate, vars), renderTemplate(bodyTemplate, vars));
    return true;
  } catch (err) {
    console.error(`[email-automation] failed to trigger "${event}":`, err);
    return false;
  }
}
