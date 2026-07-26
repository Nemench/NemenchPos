// JWT issuing/verification and the requireAuth/requirePermission route
// guards used by every router in server/routes/.
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";
import type { User, Permission } from "../src/shared/types.js";
import { db } from "./index.js";

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
// `permissions` is resolved from the user's role at THIS moment (see
// database.ts's resolvePermissions) and baked into the token — editing a
// role's permissions later doesn't retroactively change an already-issued
// token; affected users see it on their next login, same as a role change
// itself already worked before roles were even a real table.
export function signToken(user: User): string {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, roleName: user.roleName, department: user.department, permissions: user.permissions, themeMode: user.themeMode, uiMode: user.uiMode },
    SECRET,
    { expiresIn: "8h" }
  );
}

// Express middleware: requires a valid "Authorization: Bearer <token>"
// header. Re-fetches the user fresh from the DB by the token's id rather
// than trusting the decoded JWT payload wholesale — the payload only
// proves the token was legitimately issued to this id, not that its
// embedded permissions/role/department are still current. This matters
// for two real cases: (1) a token issued before a role's permissions were
// edited — a fresh lookup makes that change take effect on the very next
// request, not "next login"; (2) a token issued before a NEW field was
// ever added to the payload at all (e.g. every session live when
// permissions/roleName were introduced) — those tokens decode fine
// (signature still valid) but are just missing the new keys, which
// crashed the client wherever it assumed `permissions` is always an
// array. Re-fetching self-heals both without forcing anyone to log out.
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  try {
    const decoded = jwt.verify(token, SECRET) as { id: number };
    const user = db.getUser(decoded.id);
    if (!user || !user.isActive) { res.status(401).json({ message: "Invalid or expired token" }); return; }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Express middleware factory: must run after requireAuth. Replaces the old
// single hardcoded requireAdmin check — every route's authorization is now
// "does this token's baked-in permission set include X," never a role name
// comparison. Kept as a function that returns middleware (not one
// middleware taking a param) so route files read `requirePermission("x")`
// inline in a router chain, the same shape requireAdmin used to have.
export function requirePermission(permission: Permission) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user?.permissions?.includes(permission)) {
      res.status(403).json({ message: "Not authorized" });
      return;
    }
    next();
  };
}
