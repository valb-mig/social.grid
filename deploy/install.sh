#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
NODE="$(command -v node)"
UNITS="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
PORT="${SOCIAL_GRID_PORT:-7338}"
HTTPS="${SOCIAL_GRID_SERVE_PORT:-8443}"

cd "$DIR"
pnpm install --frozen-lockfile
pnpm build

unit="$(<"$DIR/deploy/social-grid.service")"
unit="${unit//__DIR__/$DIR}"
unit="${unit//__NODE__/$NODE}"
unit="${unit//__PATH__/$PATH}"
unit="${unit//__PORT__/$PORT}"
unit="${unit//__HTTPS__/$HTTPS}"
mkdir -p "$UNITS"
printf '%s\n' "$unit" > "$UNITS/social-grid.service"
systemctl --user daemon-reload
systemctl --user enable --now social-grid.service

echo
echo "social.grid rodando em http://127.0.0.1:$PORT"
echo "Logs: journalctl --user -u social-grid -f"
echo
echo "Para abrir no celular pela tailnet, rode uma vez:"
echo "  tailscale serve --bg --https=$HTTPS $PORT"
echo "Depois abra https://<nome-do-pc>.<sua-tailnet>.ts.net:$HTTPS/hoje no celular e instale o app."
