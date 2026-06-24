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

## Option 1 — One command on Proxmox host (creates + installs everything)

Run this **on the Proxmox host** (not inside a container):

```bash
bash <(curl -sSL https://raw.githubusercontent.com/Nemench/maxis/main/proxmox-deploy.sh)
```

That's it. The script automatically:
- Downloads the Debian 12 LXC template (if not already present)
- Creates and starts a new container (ID 200 by default)
- Installs Node.js 20, clones the repo, builds the app, and sets up a systemd service

The IP address is printed at the end. Access the app at `http://<container-ip>:3000`

**Custom options** (all optional):
```bash
CTID=201 MEMORY=1024 STORAGE=local-lvm bash <(curl -sSL https://raw.githubusercontent.com/Nemench/maxis/main/proxmox-deploy.sh)
```

**Manage the container from Proxmox host:**
```bash
pct enter 200              # open a shell inside the container
pct exec 200 -- journalctl -u maxis -f    # live logs
pct exec 200 -- bash /opt/maxis/install.sh  # update to latest version
```

**Or manage the service from inside the container:**
```bash
systemctl status maxis
systemctl restart maxis
journalctl -u maxis -f
```

---

## Option 1b — Manual install (inside an existing LXC / Ubuntu server)

If you already have a Debian/Ubuntu server or LXC, run inside it:

```bash
bash <(curl -sSL https://raw.githubusercontent.com/Nemench/maxis/main/install.sh)
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

## Data

The SQLite database lives at `./data/maxis.sqlite`. Back this file up regularly to keep your orders and products safe.
