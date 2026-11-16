#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
OUT="$DIR/release"
STAGE="$OUT/social-grid"

[ -f "$DIR/apps/web/dist/index.html" ] || { echo "Rode pnpm build antes." >&2; exit 1; }

cd "$DIR"
rm -rf "$OUT"
mkdir -p "$STAGE"
tar -C "$DIR" --exclude=node_modules --exclude=test --exclude='*.tsbuildinfo' -cf - \
  package.json pnpm-lock.yaml pnpm-workspace.yaml LICENSE README.md \
  deploy/install.sh deploy/app.sh deploy/social-grid.service \
  apps/server packages apps/web/package.json apps/web/dist |
  tar -C "$STAGE" -xf -
node -p 'require("./package.json").version' > "$STAGE/VERSION"
tar -C "$OUT" -czf "$OUT/social-grid.tar.gz" social-grid
echo "$OUT/social-grid.tar.gz $(<"$STAGE/VERSION")"
rm -rf "$STAGE"
