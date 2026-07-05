# SSH Vault

Free, self-hosted desktop SSH client with encrypted host sync.

## What is included

- Tauri desktop app for macOS and Windows.
- Account login/register against a self-hosted sync server.
- Zero-knowledge encrypted vault: hosts, passwords, and private keys are encrypted on the desktop before upload.
- Sync API backed by PostgreSQL.
- Oracle-friendly Docker Compose deployment with Caddy HTTPS proxy.
- Embedded SSH terminal powered by the local system `ssh` client and xterm.

## Repository layout

- `apps/desktop` - React + Tauri desktop application.
- `apps/server` - Rust sync server.
- `packages/crypto` - shared vault encryption library.
- `infra/oracle-compose` - server deployment files.
- `docs/runbooks/oracle-sync-server.md` - Oracle server setup notes.

## Local development

Install dependencies:

```bash
pnpm install
cargo fetch
```

Run the desktop app:

```bash
pnpm --filter desktop tauri dev
```

Run the sync server locally:

```bash
DATABASE_URL=postgres://ssh:ssh@localhost:5432/ssh cargo run -p personal-ssh-server
```

## Oracle deployment

Copy `infra/oracle-compose/.env.example` to `infra/oracle-compose/.env`, fill in the domain and database password, then start the stack from `infra/oracle-compose`:

```bash
docker compose up -d --build
```

## Verification

```bash
cargo test --all
cargo fmt --all -- --check
pnpm --filter desktop test
pnpm --filter desktop check
pnpm --filter desktop build
```

The desktop app can also be packaged locally:

```bash
pnpm --filter desktop tauri build --debug
```
