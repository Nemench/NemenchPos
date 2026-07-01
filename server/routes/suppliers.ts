import { Router } from "express";
import { db } from "../index.js";
import { requireAuth } from "../auth.js";
import type { AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => { res.json(db.listSuppliers()); });

router.post("/", (req: AuthRequest, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "stock_taker") {
    res.status(403).json({ message: "Not authorized to add suppliers" });
    return;
  }
  const { name } = req.body as { name: string };
  try {
    res.status(201).json(db.createSupplier(name));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to add supplier" });
  }
});

export default router;
