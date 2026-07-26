// Admin-definable roles — a saved, named bundle of permissions (+ optional
// department). Listing is requireAuth-only (the Users panel's role
// dropdown, and every other role-aware UI, needs the full list regardless
// of who's viewing); creating/editing/deleting a role is gated to the
// "roles" permission specifically, not blanket admin.
import { Router } from "express";
import { db } from "../index.js";
import { requireAuth, requirePermission } from "../auth.js";
import type { AppRoleInput } from "../../src/shared/types.js";

const router = Router();
router.use(requireAuth);

router.get("/", (_req, res) => {
  res.json(db.listRoles());
});

router.post("/", requirePermission("roles"), (req, res) => {
  try {
    res.status(201).json(db.createRole(req.body as AppRoleInput));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not create role" });
  }
});

router.put("/:id", requirePermission("roles"), (req, res) => {
  try {
    res.json(db.updateRole(req.params.id as string, req.body as AppRoleInput));
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not update role" });
  }
});

router.delete("/:id", requirePermission("roles"), (req, res) => {
  try {
    db.deleteRole(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Could not delete role" });
  }
});

export default router;
