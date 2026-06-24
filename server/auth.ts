import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import type { User } from "../src/shared/types.js";

function loadOrCreateSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  const secretPath = path.join(dataDir, ".jwt-secret");
  try {
    return readFileSync(secretPath, "utf8").trim();
  } catch {
    const secret = randomBytes(48).toString("hex");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(secretPath, secret, { mode: 0o600 });
    console.log("[MAXIS] Generated JWT secret saved to", secretPath);
    return secret;
  }
}

// Resolved once at startup — strong random secret persisted across restarts
const SECRET = loadOrCreateSecret();

export interface AuthRequest extends Request {
  user?: User;
}

export function signToken(user: User): string {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, department: user.department },
    SECRET,
    { expiresIn: "8h" }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  try {
    req.user = jwt.verify(token, SECRET) as User;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") { res.status(403).json({ message: "Admin access required" }); return; }
  next();
}
