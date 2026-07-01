import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";

const router = Router();

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const uploadsDir = path.join(dataDir, "uploads");

const ALLOWED_LOGO_TYPES: Record<string, string> = {
  png: "png", jpeg: "jpg", jpg: "jpg", webp: "webp"
};

// Public — no auth — so the login screen can brand itself before sign-in
router.get("/public", (_req, res) => {
  const s = db.getAllSettings();
  res.json({ siteName: s.siteName || "MAXIS", logoUrl: s.logoUrl || "", themeColor: s.themeColor || "" });
});

router.get("/", requireAuth, (_req, res) => {
  res.json(db.getAllSettings());
});

router.put("/", requireAuth, requireAdmin, (req: AuthRequest, res) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    db.setSetting(key, String(value));
  }
  res.json(db.getAllSettings());
});

router.post("/logo", requireAuth, requireAdmin, (req, res) => {
  const { dataUrl } = req.body as { dataUrl: string };
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl ?? "");
  if (!match) {
    res.status(400).json({ message: "Expected a base64 PNG/JPEG/WebP data URL" });
    return;
  }
  const ext = ALLOWED_LOGO_TYPES[match[1].toLowerCase()];
  fs.mkdirSync(uploadsDir, { recursive: true });
  for (const f of fs.readdirSync(uploadsDir)) {
    if (f.startsWith("logo.")) fs.unlinkSync(path.join(uploadsDir, f));
  }
  const filename = `logo.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(match[2], "base64"));
  const logoUrl = `/uploads/${filename}`;
  db.setSetting("logoUrl", logoUrl);
  res.json({ logoUrl });
});

export default router;
