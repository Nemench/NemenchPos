// Discovers printers installed/visible on the machine running the server,
// so the admin can pick one from a dropdown instead of typing a driver name.
import { Router } from "express";
import { exec } from "node:child_process";
import { requireAuth, requireAdmin } from "../auth.js";
import type { DiscoveredPrinter } from "../../src/shared/types.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Runs a shell command and resolves with stdout, swallowing errors — printer
// discovery is best-effort, so a failed probe should just yield no results
// rather than failing the whole request.
function run(cmd: string, timeout = 6000): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout }, (_err, stdout) => resolve(stdout ?? ""));
  });
}

// GET /api/printers — merges results from whichever printing subsystem is
// available for the current OS (Windows uses wmic; Linux/macOS use CUPS +
// mDNS network discovery).
router.get("/", async (_req, res) => {
  const result = new Map<string, DiscoveredPrinter>();

  if (process.platform === "win32") {
    // wmic-listed printers are always real, already-installed Windows
    // print queues — no separate "discovered but not usable" case here.
    const out = await run(`wmic printer get name /format:list`);
    for (const line of out.split(/\r?\n/)) {
      if (line.startsWith("Name=")) {
        const name = line.replace("Name=", "").trim();
        if (name) result.set(name, { name, ready: true });
      }
    }
    res.json([...result.values()]);
    return;
  }

  // 1. CUPS-managed printers (accepting jobs + all configured destinations)
  // — these are what `lp -d <name>` in print.ts can actually target.
  const [lpstatA, lpstatE] = await Promise.all([
    run("lpstat -a 2>/dev/null"),
    run("lpstat -e 2>/dev/null"),
  ]);
  for (const line of [...lpstatA.split("\n"), ...lpstatE.split("\n")]) {
    const name = line.split(" ")[0].trim();
    if (name) result.set(name, { name, ready: true });
  }

  // 2. Network printers via mDNS (IPP + IPPS — covers most modern printers)
  // — surfaced so an admin knows a printer exists on the network at all,
  // but NOT marked ready: unless cups-browsed (or manual lpadmin) has
  // already turned it into a real CUPS queue (in which case it'd already
  // be in the set above), `lp -d` against this bare mDNS service name
  // will fail. Only add it as a new, not-ready entry — never downgrade an
  // already-confirmed-ready CUPS entry of the same name.
  const avahi = await run("avahi-browse -pt _ipp._tcp _ipps._tcp 2>/dev/null", 4000);
  for (const line of avahi.split("\n")) {
    if (!line.startsWith("=")) continue;        // only resolved entries
    const parts = line.split(";");
    const name = parts[3]?.trim();        // service name field
    if (name && !result.has(name)) result.set(name, { name, ready: false });
  }

  res.json([...result.values()]);
});

export default router;
