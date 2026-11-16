#!/usr/bin/env bash
set -euo pipefail
url="${SOCIAL_GRID_URL:-http://localhost:${SOCIAL_GRID_PORT:-7338}}"
data="${XDG_DATA_HOME:-$HOME/.local/share}/social-grid/chrome"
mkdir -p "$data"
for b in google-chrome-stable google-chrome chromium; do
  if command -v "$b" >/dev/null; then
    exec "$b" --user-data-dir="$data" --class=social-grid --no-first-run --no-default-browser-check --app="$url" "$@"
  fi
done
xdg-open "$url"
