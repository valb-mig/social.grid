#!/usr/bin/env bash
set -euo pipefail

main() {
  local repo="${SOCIAL_GRID_REPO:-valb-mig/social.grid}"
  local port="${SOCIAL_GRID_PORT:-7338}"
  local https="${SOCIAL_GRID_SERVE_PORT:-8443}"
  local data="${XDG_DATA_HOME:-$HOME/.local/share}"
  local units="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  local src="${BASH_SOURCE[0]:-}" here="" dir mode

  if [ -n "$src" ] && [ -f "$src" ]; then
    here="$(cd "$(dirname "$(readlink -f "$src")")/.." && pwd)"
  fi
  if [ -n "$here" ] && [ -d "$here/.git" ] && [ -d "$here/apps/server" ]; then
    mode=clone
    dir="$here"
  else
    mode=release
    dir="${SOCIAL_GRID_HOME:-$HOME/.local/opt/social-grid}"
  fi

  need node
  need systemctl
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 26 ] || die "precisa do Node 26 ou mais novo (achei o $(node -v)). Instale em https://nodejs.org"

  if [ "$mode" = release ]; then
    need curl
    need tar
    fetch "$repo" "$dir"
  else
    say "Compilando o clone em $dir"
    (cd "$dir" && pn install --frozen-lockfile && pn build)
  fi

  say "Configurando o serviço de usuário"
  local unit
  unit="$(<"$dir/deploy/social-grid.service")"
  unit="${unit//__DIR__/$dir}"
  unit="${unit//__NODE__/$(command -v node)}"
  unit="${unit//__PATH__/$PATH}"
  unit="${unit//__PORT__/$port}"
  unit="${unit//__HTTPS__/$https}"
  mkdir -p "$units"
  printf '%s\n' "$unit" > "$units/social-grid.service"
  systemctl --user daemon-reload
  systemctl --user enable social-grid.service
  systemctl --user restart social-grid.service
  [ "$mode" = clone ] || rm -rf "$dir.old"

  say "Instalando o ícone e o atalho"
  shortcut "$dir" "$data"

  local version=""
  [ -f "$dir/VERSION" ] && version=" $(<"$dir/VERSION")"
  echo
  echo "social.grid$version rodando em http://127.0.0.1:$port"
  echo "Abra pelo menu de apps (social.grid) ou com: $dir/deploy/app.sh"
  echo "Logs: journalctl --user -u social-grid -f"
  if [ "$mode" = release ]; then
    echo "Para atualizar, rode o mesmo comando do curl de novo."
  fi
  echo
  echo "O app se publica sozinho na tailnet, na porta $https. O link e o QR para o celular ficam em Config, Celular."
  if ! command -v tailscale > /dev/null; then
    echo "Para o celular, instale o Tailscale: https://tailscale.com/download"
  elif [[ "$(tailscale debug prefs 2> /dev/null || true)" != *"\"OperatorUser\": \"$USER\""* ]]; then
    echo "O Tailscale só deixa publicar com sudo. Rode uma vez: sudo tailscale set --operator=$USER"
  fi
}

fetch() {
  local repo="$1" dir="$2" pin="${SOCIAL_GRID_VERSION:-}" url tmp stage="$2.new"
  if [ -n "$pin" ]; then
    url="https://github.com/$repo/releases/download/v${pin#v}/social-grid.tar.gz"
  else
    url="https://github.com/$repo/releases/latest/download/social-grid.tar.gz"
  fi
  tmp="$(mktemp -d)"
  trap "rm -rf '$tmp'" EXIT

  say "Baixando $url"
  curl -fSL --progress-bar "$url" -o "$tmp/social-grid.tar.gz" || die "não consegui baixar a release"
  rm -rf "$stage" "$dir.old"
  mkdir -p "$stage"
  tar -xzf "$tmp/social-grid.tar.gz" -C "$stage" --strip-components=1
  [ -f "$stage/VERSION" ] || die "o pacote baixado não é uma release do social.grid"

  say "Instalando as dependências da versão $(<"$stage/VERSION")"
  (cd "$stage" && pn install --prod --frozen-lockfile --config.confirmModulesPurge=false --filter '@social-grid/server...')

  [ ! -e "$dir" ] || mv "$dir" "$dir.old"
  mv "$stage" "$dir"
}

shortcut() {
  local dir="$1" data="$2" web icons apps
  web="$dir/apps/web/dist"
  icons="$data/icons/hicolor"
  apps="$data/applications"
  install -Dm644 "$web/favicon.svg" "$icons/scalable/apps/social-grid.svg"
  install -Dm644 "$web/favicon.png" "$icons/64x64/apps/social-grid.png"
  install -Dm644 "$web/pwa-192.png" "$icons/192x192/apps/social-grid.png"
  install -Dm644 "$web/pwa-512.png" "$icons/512x512/apps/social-grid.png"
  if [ -f "$icons/icon-theme.cache" ] && command -v gtk-update-icon-cache > /dev/null; then
    gtk-update-icon-cache -f -t -q "$icons" || true
  fi

  chmod +x "$dir/deploy/app.sh"
  mkdir -p "$apps"
  {
    printf '[Desktop Entry]\nType=Application\nName=social.grid\n'
    printf 'Comment=Agenda e preparo dos posts dos seus projetos\n'
    printf 'Exec="%s"\n' "$dir/deploy/app.sh"
    printf 'Icon=social-grid\nCategories=Office;\nStartupWMClass=chrome-localhost__-social-grid\nTerminal=false\n'
  } > "$apps/social-grid.desktop"
  if command -v update-desktop-database > /dev/null; then
    update-desktop-database -q "$apps" || true
  fi
}

pn() {
  if command -v pnpm > /dev/null; then
    pnpm "$@"
  else
    need npx
    npx --yes "pnpm@$(node -p 'require("./package.json").packageManager.split("@")[1]')" "$@"
  fi
}

need() {
  command -v "$1" > /dev/null || die "precisa do $1 instalado"
}

say() {
  printf '\033[1m==>\033[0m %s\n' "$*"
}

die() {
  printf 'social.grid: %s\n' "$*" >&2
  exit 1
}

main "$@"
