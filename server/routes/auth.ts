import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../index.js";
import { signToken, requireAuth } from "../auth.js";
import type { AuthRequest } from "../auth.js";

const router = Router();

// Track failed login attempts per IP: max 10 failures per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

router.post("/login", (req, res) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();

  const rec = loginAttempts.get(ip);
  if (rec && now < rec.resetAt && rec.count >= 10) {
    res.status(429).json({ message: "Too many failed login attempts. Please wait 15 minutes." });
    return;
  }

  const { name, pin } = req.body as { name: string; pin: string };
  if (!name || !pin) { res.status(400).json({ message: "Name and PIN required" }); return; }

  const user = db.getUserByName(name);
  if (!user || !bcrypt.compareSync(String(pin), user.pin)) {
    const existing = loginAttempts.get(ip);
    if (existing && now < existing.resetAt) {
      existing.count++;
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }
    res.status(401).json({ message: "Invalid name or PIN" });
    return;
  }

  // Clear rate limit counter on successful login
  loginAttempts.delete(ip);

  const { pin: _pin, ...safeUser } = user;
  res.json({ token: signToken(safeUser), user: safeUser });
});

router.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json(req.user);
});

export default router;
