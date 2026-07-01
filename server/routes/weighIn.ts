import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";
import type { WeighInLineInput, Grade } from "../../src/shared/types.js";

const router = Router();
router.use(requireAuth);

const GRADES: Grade[] = ["A", "B", "C", "A,B", "A,C", "B,C"];
const canSubmit = (req: AuthRequest) => req.user?.role === "admin" || req.user?.role === "stock_taker";

function validateLineInput(input: WeighInLineInput): string | null {
  if (!GRADES.includes(input.grade)) return "grade must be 'A', 'B', 'C', or a pair like 'A,B'";
  if (typeof input.piecesReceived !== "number" || input.piecesReceived <= 0) return "piecesReceived must be a positive number";
  if (typeof input.weightKg !== "number" || input.weightKg <= 0) return "weightKg must be a positive number";
  return null;
}

router.get("/current", (_req, res) => {
  const batch = db.getOpenBatch();
  res.json({ batch, lines: batch ? db.listWeighInLines(batch.id) : [] });
});

router.get("/", requireAdmin, (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    res.status(400).json({ message: "from/to must be YYYY-MM-DD" }); return;
  }
  res.json(db.listFinalizedBatches(from && to ? from : undefined, from && to ? to : undefined));
});

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
  const error = validateLineInput(input);
  if (error) { res.status(400).json({ message: error }); return; }
  try {
    res.status(201).json(db.addWeighInLine(input, req.user!.id));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to log line" });
  }
});

router.put("/lines/:id", (req: AuthRequest, res) => {
  if (!canSubmit(req)) {
    res.status(403).json({ message: "Not authorized to edit weigh-in lines" });
    return;
  }
  const input = req.body as WeighInLineInput;
  const error = validateLineInput(input);
  if (error) { res.status(400).json({ message: error }); return; }
  try {
    res.json(db.updateWeighInLine(Number(req.params.id), input));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to update line" });
  }
});

router.delete("/lines/:id", (req: AuthRequest, res) => {
  if (!canSubmit(req)) {
    res.status(403).json({ message: "Not authorized to delete weigh-in lines" });
    return;
  }
  try {
    db.deleteWeighInLine(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Failed to delete line" });
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
