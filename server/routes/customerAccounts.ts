// Customer accounts: a prepaid balance and/or credit tab chargeable at POS
// (see server/database.ts's createOrder paymentMethod === "account"
// handling). Identified at POS either by name search or by scanning the
// account's own card barcode (decoded client-side, see
// src/shared/customerAccountBarcode.ts, then looked up here by id).
import { Router } from "express";
import type { Response, NextFunction } from "express";
import { db } from "../index.js";
import { requireAuth, requireAdmin } from "../auth.js";
import type { AuthRequest } from "../auth.js";
import type { CustomerAccountInput } from "../../src/shared/types.js";

const router = Router();
router.use(requireAuth);

// Every till-facing role needs to find/select an account at checkout, so
// list/search/single-lookup/top-up are gated to "can run a POS sale" — not
// admin-only. Editing an account's terms or making a manual correction
// (below) stays admin-only.
function requirePosRole(req: AuthRequest, res: Response, next: NextFunction): void {
  const role = req.user?.role;
  if (role !== "admin" && role !== "cashier" && role !== "master_cashier") {
    res.status(403).json({ message: "Not authorized to use customer accounts" });
    return;
  }
  next();
}

router.get("/", requirePosRole, (_req, res) => {
  res.json(db.listCustomerAccounts());
});

router.get("/search", requirePosRole, (req, res) => {
  const q = (req.query.q as string) ?? "";
  res.json(q.trim() ? db.searchCustomerAccounts(q) : []);
});

router.get("/:id", requirePosRole, (req, res) => {
  const account = db.getCustomerAccount(Number(req.params.id));
  if (!account) { res.status(404).json({ message: "Account not found" }); return; }
  res.json(account);
});

router.get("/:id/transactions", requireAdmin, (req, res) => {
  res.json(db.listAccountTransactions(Number(req.params.id)));
});

router.post("/", requirePosRole, (req, res) => {
  try {
    res.status(201).json(db.createCustomerAccount(req.body as CustomerAccountInput));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not create account" });
  }
});

router.put("/:id", requireAdmin, (req, res) => {
  try {
    res.json(db.updateCustomerAccount(Number(req.params.id), req.body as CustomerAccountInput & { isActive?: boolean }));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not update account" });
  }
});

router.post("/:id/topup", requirePosRole, (req: AuthRequest, res) => {
  const { amount, note } = req.body as { amount: number; note?: string };
  try {
    res.json(db.topUpCustomerAccount(Number(req.params.id), Number(amount), req.user!.id, note));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not process top-up" });
  }
});

router.post("/:id/adjust", requireAdmin, (req: AuthRequest, res) => {
  const { amount, note } = req.body as { amount: number; note: string };
  try {
    res.json(db.adjustCustomerAccountBalance(Number(req.params.id), Number(amount), req.user!.id, note));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not adjust balance" });
  }
});

export default router;
