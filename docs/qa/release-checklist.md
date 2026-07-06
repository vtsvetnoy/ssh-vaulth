# Release QA checklist

Use this checklist before giving a new SSH Vault DMG to a user.

## Automatic gate

Run:

```bash
pnpm qa:release
```

The gate must pass these checks:

- Frontend tests.
- TypeScript check.
- Frontend production build.
- Rust SSH tests.
- Rust formatting check.
- Tauri desktop build.
- DMG exists at `target/release/bundle/dmg/SSH Vault_0.1.0_aarch64.dmg`.
- Local sync API `admin/admin` smoke test when `http://127.0.0.1:18080` is running.

If the local sync API is not running, mark that item as `NOT VERIFIED`, not `PASS`.

## Manual GUI gate

These checks must be done in the installed desktop app or the Tauri app window. Do not mark them as passed from code inspection alone.

- Login works with `admin/admin` against `http://127.0.0.1:18080`.
- Vaults button collapses and expands the vault navigation.
- Hosts and Keys & Certificates remain reachable after toggling Vaults.
- Adding a host saves it and shows it in the vault host grid.
- Selecting a host updates the right Host Details panel.
- The blue Connect button opens a terminal tab for the selected host.
- Double-clicking a host opens the same SSH flow as Connect.
- `+` and `New Tab` can create several separate tabs.
- The app keeps at least 1 tab and stops at 20 tabs.
- Closing tabs keeps the app stable.
- Grid/Focus mode switches between one terminal and multiple terminal panes.
- Starting SSH does not show `Command plugin:event|listen not allowed by ACL`.
- If SSH fails, the terminal shows the real SSH/network/credential error.

## Report format

Use this format:

```text
Automatic gate: PASS/FAIL
DMG path:
Local sync API: PASS/FAIL/NOT VERIFIED
Manual GUI: PASS/FAIL/NOT VERIFIED

Failed items:
- ...

Not verified items:
- ...
```
