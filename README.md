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
bash <(curl -sSL https://raw.githubusercontent.com/Nemench/maxis/main/install.sh)
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

## Data

The SQLite database lives at `./data/maxis.sqlite`. Back this file up regularly to keep your orders and products safe.
