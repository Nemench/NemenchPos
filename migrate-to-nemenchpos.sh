#!/usr/bin/env bash
# One-time migration: /opt/maxis (service "maxis") -> /opt/nemenchpos
# (service "nemenchpos"). Run this ON your actual MAXIS server as root,
# AFTER pulling this commit. Preserves your existing data/ directory
# (SQLite database, uploads, .jwt-secret) untouched — only moves the
# directory and re-registers the systemd unit under the new name.
#
# Safe to re-run: each step checks whether it's already done.
set -euo pipefail

OLD_DIR="/opt/maxis"
NEW_DIR="/opt/nemenchpos"
OLD_SERVICE="maxis"
NEW_SERVICE="nemenchpos"

RED='\033[0;31m'; BLUE='\033[0;34m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${BLUE}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}✔ $*${NC}"; }
error() { echo -e "${RED}✘ $*${NC}"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Run as root (sudo bash migrate-to-nemenchpos.sh)"

if [ -d "$NEW_DIR" ]; then
  ok "$NEW_DIR already exists — assuming migration already ran. Nothing to do."
  exit 0
fi
[ -d "$OLD_DIR" ] || error "$OLD_DIR not found — nothing to migrate."

# Capture the current env vars from the running unit, if any, so they
# carry over (control-plane / WhatsApp config) rather than resetting.
EXISTING_ENV=""
if [ -f "/etc/systemd/system/${OLD_SERVICE}.service" ]; then
  EXISTING_ENV=$(grep -E '^Environment=' "/etc/systemd/system/${OLD_SERVICE}.service" || true)
fi

info "Stopping $OLD_SERVICE..."
systemctl stop "$OLD_SERVICE" 2>/dev/null || true

info "Moving $OLD_DIR -> $NEW_DIR (data/ comes with it)..."
mv "$OLD_DIR" "$NEW_DIR"

info "Writing new systemd unit for $NEW_SERVICE..."
{
  echo "[Unit]"
  echo "Description=MAXIS KOT Server"
  echo "After=network.target"
  echo ""
  echo "[Service]"
  echo "Type=simple"
  echo "WorkingDirectory=${NEW_DIR}"
  echo "ExecStart=/usr/bin/npx tsx server/index.ts"
  echo "Restart=on-failure"
  echo "RestartSec=5"
  echo "$EXISTING_ENV"
  echo ""
  echo "[Install]"
  echo "WantedBy=multi-user.target"
} > "/etc/systemd/system/${NEW_SERVICE}.service"

info "Removing old $OLD_SERVICE unit..."
systemctl disable "$OLD_SERVICE" 2>/dev/null || true
rm -f "/etc/systemd/system/${OLD_SERVICE}.service"

systemctl daemon-reload
systemctl enable "$NEW_SERVICE"
systemctl restart "$NEW_SERVICE"

ok "Migrated. New service: $NEW_SERVICE, new path: $NEW_DIR"
echo ""
echo "Verify with:"
echo "  systemctl status $NEW_SERVICE"
echo "  journalctl -u $NEW_SERVICE -f"
echo ""
echo "Note: your Caddy reverse_proxy config (/etc/caddy/Caddyfile) references"
echo "only the port, not the service name/path — no change needed there."
echo ""
echo "The Android app on any device will need to be uninstalled and"
echo "reinstalled fresh (new applicationId com.nemench.nemenchpos means"
echo "Android treats it as a different app, not an update)."
