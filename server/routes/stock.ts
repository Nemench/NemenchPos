import { Router } from "express";
import { db } from "../index.js";
import { requireAuth } from "../auth.js";
import type { AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => { res.json(db.listProducts()); });

router.get("/low", (_req, res) => { res.json(db.listLowStock()); });

router.put("/:id", (req: AuthRequest, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "stock_taker") {
    res.status(403).json({ message: "Not authorized to update stock" });
    return;
  }
  const { onHandQty } = req.body as { onHandQty: number };
  if (typeof onHandQty !== "number" || onHandQty < 0) {
    res.status(400).json({ message: "onHandQty must be a non-negative number" });
    return;
  }
  try {
    res.json(db.updateStock(Number(req.params.id), onHandQty, req.user!.id));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update stock" });
  }
});

export default router;
