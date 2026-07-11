// JWT issuing/verification and the requireAuth/requireAdmin route guards
// used by every router in server/routes/.
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import type { User } from "../src/shared/types.js";

// Picks the JWT signing secret: an explicit env var wins, otherwise a
// secret is generated once and persisted to disk so tokens survive server
// restarts (without this, every restart would silently log everyone out).
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
    console.log("[NemenchPos] Generated JWT secret saved to", secretPath);
    return secret;
  }
}

// Resolved once at startup — strong random secret persisted across restarts
const SECRET = loadOrCreateSecret();

export interface AuthRequest extends Request {
  user?: User;
}

// Issues a shift-length (8h) token. Deliberately excludes the PIN hash —
// only the fields the client legitimately needs are embedded in the JWT.
export function signToken(user: User): string {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, department: user.department, themeMode: user.themeMode },
    SECRET,
    { expiresIn: "8h" }
  );
}

// Express middleware: requires a valid "Authorization: Bearer <token>"
// header, decodes it onto req.user for downstream handlers.
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

// Express middleware: must run after requireAuth. Restricts a route to the
// admin role only (used for user management, settings, backups, reports).
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") { res.status(403).json({ message: "Admin access required" }); return; }
  next();
}
