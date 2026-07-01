// Stock-take screen: viewing on-hand quantities and manually correcting them.
// (Automatic stock adjustments from weigh-ins go through weighIn.ts instead.)
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth } from "../auth.js";
import type { AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => { res.json(db.listProducts()); });

// Products at or below their configured lowStockThreshold — drives the
// low-stock warning badge in the UI.
router.get("/low", (_req, res) => { res.json(db.listLowStock()); });

// Set a product's on-hand quantity directly (a physical recount), as
// opposed to the incremental deltas applied by the weigh-in flow.
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
    // Records who counted it and when (lastCountedById/lastCountedAt).
    res.json(db.updateStock(Number(req.params.id), onHandQty, req.user!.id));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update stock" });
  }
});

export default router;
