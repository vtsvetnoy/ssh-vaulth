#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_RUNTIME="/Users/viktor/.cache/codex-runtimes/codex-primary-runtime/dependencies"

if [[ -x "$CODEX_RUNTIME/node/bin/node" ]]; then
  export PATH="$CODEX_RUNTIME/node/bin:$CODEX_RUNTIME/bin:$PATH"
fi

cd "$ROOT_DIR"

run() {
  printf "\n==> %s\n" "$*"
  "$@"
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf "FAIL: expected file not found: %s\n" "$file" >&2
    exit 1
  fi
  printf "PASS: found %s\n" "$file"
}

run pnpm --filter desktop test
run pnpm --filter desktop check
run pnpm --filter desktop build
run cargo test -p personal-ssh-desktop ssh::tests
run cargo fmt --all -- --check
run pnpm --filter desktop tauri build

DMG_PATH="$ROOT_DIR/target/release/bundle/dmg/SSH Vault_0.1.0_aarch64.dmg"
require_file "$DMG_PATH"

printf "\n==> Local sync API smoke test\n"
if curl --fail --silent --show-error http://127.0.0.1:18080/health >/tmp/ssh-vault-health.json; then
  LOGIN_JSON="$(curl --fail --silent --show-error \
    -H "Content-Type: application/json" \
    -d '{"email":"admin","password":"admin","deviceName":"release-qa"}' \
    http://127.0.0.1:18080/auth/login)"
  TOKEN="$(node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data.token || "");' <<<"$LOGIN_JSON")"
  if [[ -z "$TOKEN" ]]; then
    printf "FAIL: admin/admin login did not return a token\n" >&2
    exit 1
  fi
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $TOKEN" \
    http://127.0.0.1:18080/vault >/tmp/ssh-vault-vault.json
  printf "PASS: local sync API admin/admin smoke test\n"
else
  printf "NOT VERIFIED: local sync API is not running at http://127.0.0.1:18080\n"
  printf "Start it with: docker compose --env-file infra/local-compose/.env -f infra/local-compose/docker-compose.yml up -d --build\n"
fi

cat <<EOF

Manual GUI checks still required before handing the DMG to a user:
- Login with admin/admin against http://127.0.0.1:18080.
- Open Vaults, then collapse/expand the vault navigation.
- Add or select a host and confirm the right Host Details panel updates.
- Click the blue Connect button and confirm a terminal tab opens.
- Double-click the same host and confirm it opens the same SSH flow.
- Press + / New Tab repeatedly and confirm separate tabs appear, up to the 20-tab limit.
- Switch Grid/Focus mode and confirm multiple terminal panes are visible.
- Start SSH and confirm there is no "plugin:event|listen not allowed by ACL" error.

DMG:
$DMG_PATH
EOF
