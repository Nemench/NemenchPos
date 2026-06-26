# MAXIS KOT

Local web-based kitchen order ticket system for Maxis Discount Kosher Butchery.

Runs on your local network — any device with a browser can log in simultaneously.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything — users, stock, orders, queue |
| Master Cashier | Create orders + one-button accept/complete |
| Cashier | Create orders, view queue |
| Kitchen | Kitchen queue only |
| Counter | Counter queue only |

Default login after a fresh install: **Admin / 0000**

---

## Option 1 — Install inside an existing LXC / server

Create a fresh **Debian 12 or Ubuntu 22.04** container or server, then run inside it:

```bash
curl -sSL https://raw.githubusercontent.com/Nemench/maxis/main/install.sh | bash
```

The script installs Node.js 20, clones the repo, builds the app, and sets up a systemd service that starts automatically on boot.

Access the app at `http://<server-ip>:3000`

**Service commands:**
```bash
systemctl status maxis
systemctl restart maxis
journalctl -u maxis -f    # live logs
```

**To update:**
```bash
bash /opt/maxis/install.sh
```

---

## Option 2 — Docker Compose

```bash
git clone https://github.com/Nemench/maxis.git
cd maxis
docker compose up -d
```

Access at `http://localhost:3000`

Data is stored in a named Docker volume (`maxis-data`) so it survives container rebuilds.

**To update:**
```bash
git pull
docker compose up -d --build
```

---

## Option 3 — Local development

Requires Node.js 20+.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

---

## Option 4 — Windows desktop app (.exe installer)

Download the latest installer from the [Releases page](https://github.com/Nemench/maxis/releases).

Double-click `MAXIS-KOT-Setup.exe` to install. The app starts automatically and sits in the **system tray** — left-click the tray icon to open MAXIS in your browser. Other devices on the same network can connect via `http://<this-pc-ip>:3000`.

> The installer is built automatically by GitHub Actions whenever a new version tag is pushed. No Windows machine needed to build it.

---

## Option 5 — Windows server (PowerShell installer)

Use this option when you want MAXIS to run as a **background Windows service** (auto-starts on boot, no tray icon, accessible from the whole network) on a Windows 10 or 11 PC.

**Requirements:** Windows 10 21H2+ or Windows 11, PowerShell 5.1+, internet access.

Open **PowerShell as Administrator** and run:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
irm https://raw.githubusercontent.com/Nemench/maxis/main/install.ps1 | iex
```

Or clone the repo first and run the script directly:

```powershell
git clone https://github.com/Nemench/maxis.git C:\opt\maxis
powershell -ExecutionPolicy Bypass -File C:\opt\maxis\install.ps1
```

The script will:
1. Install **Node.js LTS** and **Git** via winget if not already present
2. Clone (or pull) the repo to `C:\opt\maxis`
3. Run `npm ci` and `npm run build`
4. Download **NSSM** (Non-Sucking Service Manager) to `C:\nssm\`
5. Register MAXIS as a Windows service that starts automatically on boot
6. Print the local IP and port when done

Access the app at `http://<this-pc-ip>:3000`

**Service commands:**
```powershell
C:\nssm\nssm.exe status  maxis
C:\nssm\nssm.exe restart maxis
C:\nssm\nssm.exe stop    maxis
```

**Logs:** `C:\opt\maxis\logs\`

**To update:**
```powershell
powershell -ExecutionPolicy Bypass -File C:\opt\maxis\update.ps1
```

**Printing on Windows:**
Server-side printing writes the ticket HTML to a temp file and opens it in the default browser, which triggers `window.print()`. For this to work, the MAXIS service must run under an **interactive user account** (not `LocalSystem`). After install, open `services.msc`, find **MAXIS KOT**, go to the **Log On** tab, and set it to log on as your Windows user account.

---

## Data

The SQLite database lives at `./data/maxis.sqlite`. Back this file up regularly to keep your orders and products safe.
