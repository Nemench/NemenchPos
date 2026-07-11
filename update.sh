#!/usr/bin/env bash
# NemenchPos — update script
# Run from anywhere: bash /opt/nemenchpos/update.sh
set -euo pipefail

APP_DIR="/opt/nemenchpos"
SERVICE="nemenchpos"

echo "[NemenchPos] Pulling latest code..."
cd "$APP_DIR"
git pull

echo "[NemenchPos] Rebuilding frontend..."
npm run build

echo "[NemenchPos] Restarting service..."
systemctl restart "$SERVICE"

echo "[NemenchPos] Done. Service status:"
systemctl status "$SERVICE" --no-pager -l | head -8
