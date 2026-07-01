import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";
import type { MeatWeightIncomeInput } from "../../src/shared/types.js";

const router = Router();
router.use(requireAuth);

router.get("/", requireAdmin, (_req, res) => { res.json(db.listMeatWeightIncome()); });

router.post("/", (req: AuthRequest, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "stock_taker") {
    res.status(403).json({ message: "Not authorized to log meat weight income" });
    return;
  }
  const input = req.body as MeatWeightIncomeInput;
  if (input.species !== "beef" && input.species !== "lamb") {
    res.status(400).json({ message: "species must be 'beef' or 'lamb'" });
    return;
  }
  if (typeof input.piecesWeighed !== "number" || input.piecesWeighed <= 0) {
    res.status(400).json({ message: "piecesWeighed must be a positive number" });
    return;
  }
  try {
    res.status(201).json(db.createMeatWeightIncome(input, req.user!.id));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to log entry" });
  }
});

export default router;
