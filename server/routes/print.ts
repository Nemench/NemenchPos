// Server-side "silent print": writes a receipt/summary HTML document to a
// temp file and hands it to the OS's native print path so a receipt
// printer can produce a ticket without a user manually hitting Ctrl+P.
// This is separate from the browser print-to-PDF path used elsewhere
// (buildReceiptHtml/printHtml in src/ui/App.tsx) — that path is for
// on-screen preview/PDF, this one is for direct-to-printer kitchen tickets.
//
// Windows: PowerShell opens the HTML in the default browser, which does
// its own real HTML rendering — no format-mismatch risk there.
// Linux/macOS: CUPS `lp`. Requires `wkhtmltopdf` (see install.sh) to
// convert the HTML to PDF first — handing `lp` raw HTML only actually
// prints on a system that happens to have a working text/html CUPS
// filter installed, which most modern minimal Linux installs don't; `lp`
// would accept the job anyway (no error) and the printer would silently
// drop it, having no idea what to do with markup tags. PDF is handled
// natively by every CUPS filter chain and every IPP-capable printer
// (including driverless "IPP Everywhere" queues), so this removes the
// dependency on whichever HTML filter package happens to be installed.
import { Router } from "express";
import { execFile } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.post("/", (req, res) => {
  const { printerName, html } = req.body as { printerName: string; html: string };
  if (!printerName || !html) {
    res.status(400).json({ message: "printerName and html are required" });
    return;
  }

  // Validation differs by platform:
  // Linux/macOS — CUPS names are ASCII word chars only (no shell metacharacters)
  // Windows     — names from wmic may contain spaces and parentheses; block only
  //               characters that would allow command injection
  const validPrinter = process.platform === "win32"
    ? /^[^&;|`$<>"\r\n]{1,260}$/.test(printerName)
    : /^[\w.@-]+$/.test(printerName);

  if (!validPrinter) {
    res.status(400).json({ message: "Invalid printer name" });
    return;
  }

  const tmpFile = join(tmpdir(), `nemenchpos-${Date.now()}.html`);

  // ── Windows ────────────────────────────────────────────────────────────────
  if (process.platform === "win32") {
    // Inject window.print() if the HTML doesn't already trigger it.
    const autoprint = `<script>window.addEventListener('load',function(){window.print();});</script>`;
    let printable: string;
    if (html.includes("window.print()")) {
      printable = html;
    } else if (html.includes("</head>")) {
      printable = html.replace("</head>", `${autoprint}</head>`);
    } else {
      printable = `${autoprint}${html}`;
    }

    try {
      writeFileSync(tmpFile, printable, "utf8");
    } catch (err) {
      res.status(500).json({ message: `Could not write temp file: ${err instanceof Error ? err.message : "unknown"}` });
      return;
    }

    // Convert to a file:/// URI (forward slashes required).
    const fileUri = `file:///${tmpFile.replace(/\\/g, "/")}`;

    // execFile bypasses cmd.exe so path quoting is handled by the OS, not the shell.
    // Start-Process opens the URI with the Windows default browser.
    // The injected script calls window.print() once the page loads.
    //
    // NOTE: This requires the service to run under an interactive user account,
    // not as LocalSystem (Session 0). See README for configuration details.
    execFile(
      "powershell.exe",
      ["-NonInteractive", "-Command", `Start-Process '${fileUri.replace(/'/g, "''")}'`],
      { timeout: 10_000 },
      (err) => {
        // Keep the file alive long enough for the browser to load it, then delete.
        setTimeout(() => { try { unlinkSync(tmpFile); } catch { /* ignore */ } }, 30_000);
        if (err) {
          res.status(500).json({ message: `Could not open browser for printing: ${err.message}` });
        } else {
          res.json({ ok: true });
        }
      }
    );
    return;
  }

  // ── Linux / macOS: CUPS ────────────────────────────────────────────────────
  // Handing `lp` the HTML file directly used to be the whole story here, but
  // that only actually prints on a system where CUPS has a working text/html
  // filter installed — most modern minimal Linux installs don't ship one, so
  // `lp` accepts the job (no error, so this route reported success) and the
  // printer silently drops it, having no idea what to do with markup tags.
  // Converting to PDF first sidesteps that entirely: every CUPS filter chain
  // and every IPP-capable printer (including "IPP Everywhere" driverless
  // queues) handles PDF natively, so this no longer depends on which HTML
  // filter package happens to be installed on any given deployment.
  try {
    writeFileSync(tmpFile, html, "utf8");
  } catch (err) {
    res.status(500).json({ message: `Could not write temp file: ${err instanceof Error ? err.message : "unknown"}` });
    return;
  }

  const pdfFile = tmpFile.replace(/\.html$/, ".pdf");
  const cleanup = () => { for (const f of [tmpFile, pdfFile]) { try { unlinkSync(f); } catch { /* ignore */ } } };

  // Zeroed margins: the generated HTML already sets its own @page margin
  // (0 for a receipt/label — the content controls its own padding), and
  // wkhtmltopdf's own default ~10mm page margin would otherwise stack on
  // top of that, throwing off alignment on small thermal/label stock.
  execFile(
    "wkhtmltopdf",
    ["--quiet", "--enable-local-file-access", "--margin-top", "0", "--margin-bottom", "0", "--margin-left", "0", "--margin-right", "0", tmpFile, pdfFile],
    { timeout: 15_000 },
    (renderErr) => {
      if (renderErr) {
        cleanup();
        const hint = /command not found|ENOENT/i.test(renderErr.message)
          ? ` (wkhtmltopdf isn't installed — run: apt install wkhtmltopdf)`
          : "";
        res.status(500).json({ message: `Could not convert receipt to PDF: ${renderErr.message}${hint}` });
        return;
      }

      execFile("lp", ["-d", printerName, pdfFile], { timeout: 10_000 }, (printErr) => {
        cleanup();
        if (printErr) {
          res.status(500).json({ message: `lp failed: ${printErr.message}` });
        } else {
          res.json({ ok: true });
        }
      });
    }
  );
});

export default router;
