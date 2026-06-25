import express, { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", (_req, res) => {
  const file = db.dataFile;
  if (!fs.existsSync(file)) { res.status(404).json({ message: "Database file not found" }); return; }
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="maxis-backup-${date}.sqlite"`);
  res.sendFile(path.resolve(file));
});

router.post("/restore", express.raw({ type: "application/octet-stream", limit: "100mb" }), (req, res) => {
  try {
    const buf = req.body as Buffer;
    if (!buf || buf.length < 16) { res.status(400).json({ message: "Invalid file" }); return; }
    if (buf.toString("ascii", 0, 6) !== "SQLite") {
      res.status(400).json({ message: "Not a valid SQLite backup file" }); return;
    }
    db.restoreDatabase(buf);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Restore failed" });
  }
});

export default router;
