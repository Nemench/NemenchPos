// Admin CRM API: contact list/detail, consent/tag management, and manual
// staff messaging. Admin-only, same as users.ts — contact phone numbers
// and message history are sensitive customer data.
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";
import type { ConsentStatus, CrmContactInput } from "../../src/shared/types.js";
import { getTemplateCatalog, getTemplate, renderTemplateBody } from "../whatsapp/templates.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/contacts", (req, res) => {
  res.json(db.listContacts(typeof req.query.search === "string" ? req.query.search : undefined));
});

router.get("/contacts/:id", (req, res) => {
  const detail = db.getContactDetail(req.params.id as string);
  if (!detail) return res.status(404).json({ message: "Contact not found" });
  res.json(detail);
});

router.patch("/contacts/:id", (req: AuthRequest, res) => {
  try {
    res.json(db.updateContact(req.params.id as string, req.body as CrmContactInput));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update contact" });
  }
});

router.post("/contacts/:id/consent", (req: AuthRequest, res) => {
  const status = req.body?.consentStatus as ConsentStatus;
  if (!["opted_in", "opted_out", "unknown"].includes(status)) {
    return res.status(400).json({ message: "Invalid consentStatus" });
  }
  try {
    res.json(db.setConsentStatus(req.params.id as string, status));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update consent" });
  }
});

router.get("/tags", (_req, res) => { res.json(db.listTags()); });

// Template catalog for the "send message" picker — includes category
// (utility/marketing) so the UI can hide marketing templates for
// non-opted-in contacts.
router.get("/templates", (_req, res) => { res.json(getTemplateCatalog()); });

router.get("/automation-rules", (_req, res) => { res.json(db.listAutomationRules()); });

router.put("/automation-rules/:eventName", (req: AuthRequest, res) => {
  const { templateName, enabled } = req.body ?? {};
  if (typeof templateName !== "string" || typeof enabled !== "boolean") {
    return res.status(400).json({ message: "templateName (string) and enabled (boolean) are required" });
  }
  res.json(db.setAutomationRule(req.params.eventName as string, templateName, enabled));
});

// Manual staff send — freeform only within the 24h service window (Meta
// rejects freeform outside it), template send always allowed subject to
// consent: marketing-tier templates require opted_in; utility-tier follow
// the same rule as automation (blocked only for opted_out).
router.post("/contacts/:id/send", (req: AuthRequest, res) => {
  const contact = db.getContact(req.params.id as string);
  if (!contact) return res.status(404).json({ message: "Contact not found" });

  const { freeformBody, templateName, templateParams } = req.body ?? {};

  if (freeformBody) {
    if (!db.isWithinServiceWindow(contact.id)) {
      return res.status(409).json({ message: "Outside the 24h service window — a template message is required" });
    }
    const { message } = db.enqueueOutboundMessage({
      contactId: contact.id, messageType: "freeform", freeformBody, body: freeformBody, triggeredBy: "manual:staff"
    });
    return res.status(201).json(message);
  }

  if (templateName) {
    const template = getTemplate(templateName);
    if (!template) return res.status(400).json({ message: `Unknown template "${templateName}"` });
    if (template.category === "marketing" && contact.consentStatus !== "opted_in") {
      return res.status(403).json({ message: "Marketing templates can only be sent to opted-in contacts" });
    }
    if (contact.consentStatus === "opted_out") {
      return res.status(403).json({ message: "Contact has opted out" });
    }
    const params = Array.isArray(templateParams) ? templateParams : [];
    const body = renderTemplateBody(template, params);
    const { message } = db.enqueueOutboundMessage({
      contactId: contact.id, messageType: "template", templateName: template.name, templateParams: params, body, triggeredBy: "manual:staff"
    });
    return res.status(201).json(message);
  }

  res.status(400).json({ message: "Either freeformBody or templateName is required" });
});

export default router;
