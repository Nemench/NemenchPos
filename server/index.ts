// Express app entry point: security middleware, rate limiting, route
// mounting, and (in production) serving the built SPA + its client-side
// routing fallback. Run via `npm run start` (prod) or `npm run dev` (with
// Vite's dev server proxying to this on PORT, default 3001).
import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { KotDatabase } from "./database.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import settingsRouter from "./routes/settings.js";
import reportsRouter from "./routes/reports.js";
import printersRouter from "./routes/printers.js";
import printRouter from "./routes/print.js";
import backupRouter from "./routes/backup.js";
import stockRouter from "./routes/stock.js";
import suppliersRouter from "./routes/suppliers.js";
import weighInRouter from "./routes/weighIn.js";
import statisticsRouter from "./routes/statistics.js";

export const db = new KotDatabase();
db.initialize();

const isProd = process.env.NODE_ENV === "production";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Tell Express to trust the first proxy hop (Caddy / nginx) so
// req.ip returns the real client IP, not 127.0.0.1. Required for
// rate limiting to work correctly behind a reverse proxy.
app.set("trust proxy", 1);

app.use(compression());

// Security headers: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'"],  // Vite inlines small scripts
      styleSrc:       ["'self'", "'unsafe-inline'"],
      imgSrc:         ["'self'", "data:", "blob:"],   // logo + blob: receipt windows
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'", "data:"],
      objectSrc:           ["'none'"],
      frameAncestors:      ["'none'"],                // blocks clickjacking
      upgradeInsecureRequests: null,                  // disabled until HTTPS/Caddy is active
    },
  },
  crossOriginEmbedderPolicy: false, // allow blob: print tabs to open on mobile
}));

// The native Android app bundles the web build locally and calls this API
// cross-origin from Capacitor's internal origin (https://localhost by
// default) — needed in every environment, not just dev, since that's how
// the shipped app behaves too (see capacitor.config.ts + src/shared/nativeServer.ts).
const nativeAppOrigins = ["https://localhost", "capacitor://localhost"];
const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(cors({ origin: isProd ? nativeAppOrigins : [...devOrigins, ...nativeAppOrigins], credentials: true }));

app.use(express.json({ limit: "10mb" }));

// Uploaded assets (e.g. custom logo) — served from the persistent data dir, not dist/
const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const uploadsDir = path.join(dataDir, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// ── Rate limiting ─────────────────────────────────────────────────────────────

// General API limit: 300 requests/min per IP — generous for normal staff use
// but stops bots, scanners, and runaway clients dead
const apiLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests — please slow down." },
});

// Tight limit on backup restore: it's expensive and admin-only
const backupRestoreLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many restore attempts." },
});

app.use("/api", apiLimit);
app.use("/api/backup/restore", backupRestoreLimit);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/auth",     authRouter);
app.use("/api/users",    usersRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders",   ordersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/reports",  reportsRouter);
app.use("/api/printers", printersRouter);
app.use("/api/print",    printRouter);
app.use("/api/backup",   backupRouter);
app.use("/api/stock",    stockRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/weigh-in", weighInRouter);
app.use("/api/statistics", statisticsRouter);

if (isProd) {
  // Serve the Vite-built SPA and fall back to index.html for any
  // non-API route so client-side routing (React) can take over.
  const dist = path.join(__dirname, "../dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`MAXIS server → http://localhost:${PORT}`);
});
