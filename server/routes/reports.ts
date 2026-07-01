// Admin-only sales reporting: orders within a date range.
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";

const router = Router();

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  // Both dates are required and must match the plain YYYY-MM-DD format used
  // throughout the app (dates are stored/compared as ISO date-string prefixes).
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    res.status(400).json({ message: "from and to are required (YYYY-MM-DD)" }); return;
  }
  res.json(db.listOrdersInRange(from, to));
});

export default router;
