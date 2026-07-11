// Full-database export/import as a downloadable JSON snapshot. Admin-only —
// a restore overwrites live data, so this is a deliberately narrow surface.
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Downloads every table (orders, products, users, suppliers, weigh-ins, ...)
// as one JSON file, named with today's date.
router.get("/", (_req, res) => {
  try {
    const data = db.exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="nemenchpos-backup-${date}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Export failed" });
  }
});

// Restores from a previously exported JSON file. `version` presence is used
// as a cheap sanity check that this is actually a NemenchPos backup file.
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
