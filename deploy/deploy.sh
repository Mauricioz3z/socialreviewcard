#!/usr/bin/env bash
#
# Deploy SocialReviewCard on the Ubuntu VM:
#   pull latest -> publish backend -> build frontend -> restart API -> reload nginx
#
# Usage:  ./deploy/deploy.sh
# Run as the 'ubuntu' user from the repo root (uses sudo for systemctl/nginx).
set -euo pipefail

# nvm-installed node/npm aren't on PATH in a non-interactive shell — load them.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

REPO="/home/ubuntu/socialreviewcard"
BRANCH="main"
SERVICE="socialreviewcard"

echo "==> 1/5 Updating source ($BRANCH)"
cd "$REPO"
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> 2/5 Publishing backend (.NET)"
cd "$REPO/backend"
# Outputs to backend/bin/Release/net8.0/publish (matches the systemd unit path).
dotnet publish -c Release

echo "==> 3/5 Building frontend (Vite)"
cd "$REPO/frontend"
npm ci
npm run build      # outputs to frontend/dist, served by nginx

echo "==> 4/5 Restarting API service (applies any new EF migrations on startup)"
sudo systemctl restart "$SERVICE"
sleep 2
sudo systemctl --no-pager --full status "$SERVICE" | head -n 15

echo "==> 5/5 Reloading nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Deploy complete. Tail logs with: journalctl -u $SERVICE -f"
