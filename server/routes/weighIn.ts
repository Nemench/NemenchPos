import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";
import type { WeighInLineInput, Grade } from "../../src/shared/types.js";

const router = Router();
router.use(requireAuth);

const GRADES: Grade[] = ["A", "B", "C"];
const canSubmit = (req: AuthRequest) => req.user?.role === "admin" || req.user?.role === "stock_taker";

router.get("/current", (_req, res) => {
  const batch = db.getOpenBatch();
  res.json({ batch, lines: batch ? db.listWeighInLines(batch.id) : [] });
});

router.get("/", requireAdmin, (_req, res) => { res.json(db.listWeighInLines()); });

router.get("/:batchId", requireAdmin, (req, res) => {
  try {
    const batch = db.getBatch(Number(req.params.batchId));
    res.json({ batch, lines: db.listWeighInLines(batch.id) });
  } catch (err) {
    res.status(404).json({ message: err instanceof Error ? err.message : "Batch not found" });
  }
});

router.post("/lines", (req: AuthRequest, res) => {
  if (!canSubmit(req)) {
    res.status(403).json({ message: "Not authorized to log weigh-in lines" });
    return;
  }
  const input = req.body as WeighInLineInput;
  if (!GRADES.includes(input.grade)) {
    res.status(400).json({ message: "grade must be 'A', 'B', or 'C'" });
    return;
  }
  if (typeof input.piecesReceived !== "number" || input.piecesReceived <= 0) {
    res.status(400).json({ message: "piecesReceived must be a positive number" });
    return;
  }
  if (typeof input.weightKg !== "number" || input.weightKg <= 0) {
    res.status(400).json({ message: "weightKg must be a positive number" });
    return;
  }
  try {
    res.status(201).json(db.addWeighInLine(input, req.user!.id));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to log line" });
  }
});

router.post("/finalize", (req: AuthRequest, res) => {
  if (!canSubmit(req)) {
    res.status(403).json({ message: "Not authorized to finalize a batch" });
    return;
  }
  const { batchId } = req.body as { batchId?: number };
  try {
    const id = batchId ?? db.getOpenBatch()?.id;
    if (!id) { res.status(400).json({ message: "No open batch to finalize" }); return; }
    const batch = db.finalizeBatch(id);
    res.json({ batch, lines: db.listWeighInLines(batch.id) });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to finalize batch" });
  }
});

export default router;
