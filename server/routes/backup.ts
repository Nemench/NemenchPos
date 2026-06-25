import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", (_req, res) => {
  try {
    const data = db.exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="maxis-backup-${date}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Export failed" });
  }
});

router.post("/restore", (req, res) => {
  try {
    const data = req.body as Record<string, unknown>;
    if (!data || !data.version) { res.status(400).json({ message: "Invalid backup file" }); return; }
    const result = db.importBackup(data);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Restore failed" });
  }
});

export default router;
