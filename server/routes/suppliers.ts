// Supplier directory used by the weigh-in workflow (persisted so the stock
// taker can pick a previously-used supplier instead of retyping the name).
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requirePermission } from "../auth.js";

const router = Router();
router.use(requireAuth);

// Any authenticated user can read the list (needed to populate the dropdown).
router.get("/", (_req, res) => { res.json(db.listSuppliers()); });

router.post("/", requirePermission("suppliersManage"), (req, res) => {
  const { name } = req.body as { name: string };
  try {
    // db.createSupplier enforces a case-insensitive unique name and throws
    // if it already exists — caller sees that as a 400.
    res.status(201).json(db.createSupplier(name));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to add supplier" });
  }
});

export default router;
