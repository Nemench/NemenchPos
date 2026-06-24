import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";

const router = Router();

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

export default router;
