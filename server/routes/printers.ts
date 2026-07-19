// Discovers printers installed/visible on the machine running the server,
// so the admin can pick one from a dropdown instead of typing a driver name.
// Also surfaces (and lets an admin cancel) whatever's actually sitting in
// the OS print queue — added after a printer spooled hundreds of garbled
// pages from a stuck/misrouted job with no way to see or clear it short of
// shelling into the host directly.
import { Router } from "express";
import { exec, execFile } from "node:child_process";
import { requireAuth, requireAdmin } from "../auth.js";
import type { DiscoveredPrinter, PrintQueueJob } from "../../src/shared/types.js";

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

// Runs an argv-array command (no shell involved, so no quoting/injection
// concerns even with an unsanitized argument) and resolves with stdout,
// same best-effort swallow-errors posture as run() above.
function runFile(cmd: string, args: string[], timeout = 6000): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout }, (_err, stdout) => resolve(stdout ?? ""));
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

// GET /api/printers/queue — every job currently spooled across every
// printer (not just one queue), so this is the one place an admin needs to
// look regardless of which printer is acting up.
router.get("/queue", async (_req, res) => {
  res.json(await listQueue());
});

// DELETE /api/printers/queue/:id — cancels one specific job. `id` is
// whatever listQueue() reported back as that job's id (opaque to the
// client), so there's no separate "look up the job" round trip needed
// between listing and canceling.
router.delete("/queue/:id", async (req, res) => {
  const id = req.params.id as string;
  if (process.platform === "win32") {
    if (!/^\d+$/.test(id)) { res.status(400).json({ message: "Invalid job id" }); return; }
    await runFile("wmic", ["printjob", "where", `JobID=${id}`, "delete"]);
  } else {
    // CUPS job ids look like "<printer-name>-<number>" — same charset
    // already accepted for printer names in print.ts, plus the dash.
    if (!/^[\w.@-]+$/.test(id)) { res.status(400).json({ message: "Invalid job id" }); return; }
    await runFile("cancel", [id]);
  }
  res.json({ ok: true });
});

// POST /api/printers/queue/cancel-all — clears every queued job on every
// printer in one action, for exactly the "printer is spewing garbage
// right now, stop everything" situation this endpoint exists for.
router.post("/queue/cancel-all", async (_req, res) => {
  const jobs = await listQueue();
  if (process.platform === "win32") {
    await Promise.all(jobs.map((j) => runFile("wmic", ["printjob", "where", `JobID=${j.id}`, "delete"])));
  } else {
    await Promise.all(jobs.map((j) => runFile("cancel", [j.id])));
  }
  res.json({ ok: true, canceled: jobs.length });
});

async function listQueue(): Promise<PrintQueueJob[]> {
  if (process.platform === "win32") {
    // /format:csv gives one job per line (Node,DocumentName,JobId,Owner,
    // PrinterName,Size,SubmittedTime — alphabetical after Node), which is
    // far easier to parse reliably than /format:list's blank-line-
    // separated records.
    const out = await run(`wmic printjob get DocumentName,JobId,Owner,PrinterName,Size,SubmittedTime /format:csv`);
    const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const header = lines[0]?.split(",") ?? [];
    const idx = (col: string) => header.indexOf(col);
    const jobs: PrintQueueJob[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const id = cols[idx("JobId")];
      if (!id) continue;
      jobs.push({
        id,
        printer: cols[idx("PrinterName")] ?? "",
        owner: cols[idx("Owner")] ?? "",
        sizeBytes: Number(cols[idx("Size")]) || 0,
        submittedAt: cols[idx("SubmittedTime")] ?? ""
      });
    }
    return jobs;
  }

  // `lpstat -o` lists every job on every printer: "<job-id> <owner>
  // <size-bytes> <weekday month day HH:MM:SS year>".
  const out = await run("lpstat -o 2>/dev/null");
  const jobs: PrintQueueJob[] = [];
  for (const line of out.split("\n")) {
    const m = /^(\S+)\s+(\S+)\s+(\d+)\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const [, id, owner, size, date] = m;
    jobs.push({ id, printer: id.replace(/-\d+$/, ""), owner, sizeBytes: Number(size), submittedAt: date.trim() });
  }
  return jobs;
}

export default router;
