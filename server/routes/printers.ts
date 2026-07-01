// Discovers printers installed/visible on the machine running the server,
// so the admin can pick one from a dropdown instead of typing a driver name.
import { Router } from "express";
import { exec } from "node:child_process";
import { requireAuth, requireAdmin } from "../auth.js";

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
  const names = new Set<string>();

  if (process.platform === "win32") {
    const out = await run(`wmic printer get name /format:list`);
    for (const line of out.split(/\r?\n/)) {
      if (line.startsWith("Name=")) names.add(line.replace("Name=", "").trim());
    }
    res.json([...names].filter(Boolean));
    return;
  }

  // 1. CUPS-managed printers (accepting jobs + all configured destinations)
  const [lpstatA, lpstatE] = await Promise.all([
    run("lpstat -a 2>/dev/null"),
    run("lpstat -e 2>/dev/null"),
  ]);
  for (const line of [...lpstatA.split("\n"), ...lpstatE.split("\n")]) {
    const name = line.split(" ")[0].trim();
    if (name) names.add(name);
  }

  // 2. Network printers via mDNS (IPP + IPPS — covers most modern printers)
  const avahi = await run("avahi-browse -pt _ipp._tcp _ipps._tcp 2>/dev/null", 4000);
  for (const line of avahi.split("\n")) {
    if (!line.startsWith("=")) continue;        // only resolved entries
    const parts = line.split(";");
    const printerName = parts[3]?.trim();        // service name field
    if (printerName) names.add(printerName);
  }

  res.json([...names].filter(Boolean));
});

export default router;
