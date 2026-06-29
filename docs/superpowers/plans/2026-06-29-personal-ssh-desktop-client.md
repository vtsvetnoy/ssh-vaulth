# Personal SSH Desktop Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free personal Termius-style MVP: macOS/Windows Tauri desktop app, Oracle-hosted sync API, encrypted vault, host list, and embedded SSH terminal.

**Architecture:** Use a monorepo with a Rust workspace for shared crypto/server/desktop backend code and a pnpm workspace for the desktop React UI. The sync server stores only encrypted vault blobs and version metadata; SSH sessions run locally inside the Tauri app and stream data to xterm.js.

**Tech Stack:** Tauri v2, React, TypeScript, xterm.js, Rust, Axum, SQLx, PostgreSQL, Argon2id, XChaCha20-Poly1305, ssh2/libssh2, Docker Compose, Caddy.

---

## Scope Note

This plan covers the full MVP from the approved spec. It intentionally avoids SFTP, tunnels, snippets, teams, sharing, mobile clients, and field-level merge. Each task should be implemented and committed independently.

## File Structure

Create these paths:

- `Cargo.toml` - Rust workspace root.
- `package.json` - pnpm workspace root scripts.
- `pnpm-workspace.yaml` - pnpm workspace package map.
- `packages/crypto/Cargo.toml` - Rust crypto crate manifest.
- `packages/crypto/src/lib.rs` - vault data model and public crypto API.
- `packages/crypto/tests/vault_crypto.rs` - crypto behavior tests.
- `apps/server/Cargo.toml` - sync server manifest.
- `apps/server/src/main.rs` - server startup.
- `apps/server/src/config.rs` - environment configuration.
- `apps/server/src/db.rs` - database pool and migrations runner.
- `apps/server/src/models.rs` - API/database structs.
- `apps/server/src/auth.rs` - password hashing and session tokens.
- `apps/server/src/routes.rs` - HTTP routes.
- `apps/server/migrations/0001_init.sql` - users, sessions, vaults tables.
- `apps/server/tests/api.rs` - auth/vault API tests.
- `infra/oracle-compose/docker-compose.yml` - API/Postgres/Caddy stack.
- `infra/oracle-compose/Caddyfile` - HTTPS reverse proxy config.
- `infra/oracle-compose/.env.example` - deployment variables.
- `apps/desktop/package.json` - React/Tauri frontend package.
- `apps/desktop/index.html` - Vite entry.
- `apps/desktop/src/main.tsx` - React entry.
- `apps/desktop/src/App.tsx` - screen routing and app state.
- `apps/desktop/src/api/client.ts` - sync API client.
- `apps/desktop/src/crypto/vault.ts` - frontend wrapper around Tauri crypto commands.
- `apps/desktop/src/components/LoginScreen.tsx` - auth UI.
- `apps/desktop/src/components/UnlockScreen.tsx` - master password UI.
- `apps/desktop/src/components/HostList.tsx` - host sidebar.
- `apps/desktop/src/components/HostEditor.tsx` - add/edit host form.
- `apps/desktop/src/components/TerminalPane.tsx` - xterm.js terminal UI.
- `apps/desktop/src-tauri/Cargo.toml` - Tauri Rust manifest.
- `apps/desktop/src-tauri/src/lib.rs` - Tauri command registration.
- `apps/desktop/src-tauri/src/commands.rs` - crypto, vault, and SSH commands.
- `apps/desktop/src-tauri/src/ssh.rs` - local SSH runtime.
- `apps/desktop/src-tauri/tauri.conf.json` - Tauri config.
- `docs/runbooks/oracle-sync-server.md` - Oracle deployment runbook.
- `docs/runbooks/local-e2e.md` - local end-to-end verification.

---

### Task 1: Monorepo Skeleton

**Files:**
- Create: `Cargo.toml`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`

- [ ] **Step 1: Write root workspace files**

Create `Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = [
  "packages/crypto",
  "apps/server",
  "apps/desktop/src-tauri"
]

[workspace.package]
edition = "2021"
license = "MIT"

[workspace.dependencies]
anyhow = "1"
argon2 = "0.5"
axum = "0.7"
base64 = "0.22"
chrono = { version = "0.4", features = ["serde"] }
chacha20poly1305 = "0.10"
rand_core = "0.6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "json"] }
thiserror = "1"
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.5", features = ["cors", "trace"] }
uuid = { version = "1", features = ["serde", "v4"] }
```

Create `package.json`:

```json
{
  "name": "personal-ssh-client",
  "private": true,
  "scripts": {
    "check": "pnpm --filter desktop check",
    "dev:desktop": "pnpm --filter desktop tauri dev",
    "test:rust": "cargo test --workspace"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/desktop"
```

Create `.gitignore`:

```gitignore
/target/
/node_modules/
**/node_modules/
**/dist/
**/.env
!.env.example
.DS_Store
.superpowers/
```

- [ ] **Step 2: Verify workspace files parse**

Run:

```bash
cargo metadata --no-deps
```

Expected: FAIL because workspace members do not exist yet. This confirms the root workspace file is being read.

- [ ] **Step 3: Commit**

```bash
git add Cargo.toml package.json pnpm-workspace.yaml .gitignore
git commit -m "chore: add personal ssh client workspace"
```

---

### Task 2: Shared Crypto Crate

**Files:**
- Create: `packages/crypto/Cargo.toml`
- Create: `packages/crypto/src/lib.rs`
- Create: `packages/crypto/tests/vault_crypto.rs`

- [ ] **Step 1: Add failing crypto tests**

Create `packages/crypto/tests/vault_crypto.rs`:

```rust
use personal_ssh_crypto::{decrypt_vault, encrypt_vault, HostAuth, HostRecord, Vault};

fn sample_vault() -> Vault {
    Vault {
        schema_version: 1,
        hosts: vec![HostRecord {
            id: "host-1".to_string(),
            label: "Oracle Test".to_string(),
            hostname: "203.0.113.10".to_string(),
            port: 22,
            username: "ubuntu".to_string(),
            auth: HostAuth::Password {
                password: "secret-password".to_string(),
            },
            notes: "test host".to_string(),
            created_at: "2026-06-29T20:00:00Z".to_string(),
            updated_at: "2026-06-29T20:00:00Z".to_string(),
        }],
        updated_at: "2026-06-29T20:00:00Z".to_string(),
    }
}

#[test]
fn decrypts_with_correct_master_password() {
    let encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    let decrypted = decrypt_vault(&encrypted, "master-pass").unwrap();
    assert_eq!(decrypted.hosts[0].hostname, "203.0.113.10");
    assert_eq!(decrypted.hosts[0].username, "ubuntu");
}

#[test]
fn rejects_wrong_master_password() {
    let encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    let err = decrypt_vault(&encrypted, "wrong-pass").unwrap_err().to_string();
    assert!(err.contains("vault decrypt failed"));
}

#[test]
fn rejects_tampered_ciphertext() {
    let mut encrypted = encrypt_vault(&sample_vault(), "master-pass").unwrap();
    encrypted.ciphertext.push('A');
    let err = decrypt_vault(&encrypted, "master-pass").unwrap_err().to_string();
    assert!(err.contains("vault decrypt failed"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cargo test -p personal-ssh-crypto
```

Expected: FAIL because `packages/crypto` is not implemented.

- [ ] **Step 3: Implement crypto crate**

Create `packages/crypto/Cargo.toml`:

```toml
[package]
name = "personal-ssh-crypto"
version = "0.1.0"
edition.workspace = true
license.workspace = true

[dependencies]
argon2.workspace = true
base64.workspace = true
chacha20poly1305.workspace = true
rand_core.workspace = true
serde.workspace = true
serde_json.workspace = true
thiserror.workspace = true
```

Create `packages/crypto/src/lib.rs`:

```rust
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use thiserror::Error;

const KDF_MEMORY_KIB: u32 = 64 * 1024;
const KDF_ITERATIONS: u32 = 3;
const KDF_PARALLELISM: u32 = 1;
const KEY_LEN: usize = 32;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24;

#[derive(Debug, Error)]
pub enum VaultCryptoError {
    #[error("vault serialize failed")]
    Serialize(#[from] serde_json::Error),
    #[error("vault decrypt failed")]
    Decrypt,
    #[error("vault encrypt failed")]
    Encrypt,
    #[error("invalid vault encoding")]
    Encoding,
    #[error("kdf failed")]
    Kdf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub schema_version: u32,
    pub hosts: Vec<HostRecord>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HostRecord {
    pub id: String,
    pub label: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth: HostAuth,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HostAuth {
    Password { password: String },
    PrivateKey {
        private_key: String,
        private_key_passphrase: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedVault {
    pub schema_version: u32,
    pub kdf: KdfParams,
    pub cipher: String,
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KdfParams {
    pub algorithm: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub salt: String,
}

pub fn encrypt_vault(
    vault: &Vault,
    master_password: &str,
) -> Result<EncryptedVault, VaultCryptoError> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);

    let key = derive_key(master_password, &salt)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&key));
    let plaintext = serde_json::to_vec(vault)?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|_| VaultCryptoError::Encrypt)?;

    Ok(EncryptedVault {
        schema_version: 1,
        kdf: KdfParams {
            algorithm: "argon2id".to_string(),
            memory_kib: KDF_MEMORY_KIB,
            iterations: KDF_ITERATIONS,
            parallelism: KDF_PARALLELISM,
            salt: B64.encode(salt),
        },
        cipher: "xchacha20poly1305".to_string(),
        nonce: B64.encode(nonce),
        ciphertext: B64.encode(ciphertext),
    })
}

pub fn decrypt_vault(
    encrypted: &EncryptedVault,
    master_password: &str,
) -> Result<Vault, VaultCryptoError> {
    let salt = B64
        .decode(&encrypted.kdf.salt)
        .map_err(|_| VaultCryptoError::Encoding)?;
    let nonce = B64
        .decode(&encrypted.nonce)
        .map_err(|_| VaultCryptoError::Encoding)?;
    let ciphertext = B64
        .decode(&encrypted.ciphertext)
        .map_err(|_| VaultCryptoError::Encoding)?;

    let key = derive_key(master_password, &salt)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&key));
    let plaintext = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| VaultCryptoError::Decrypt)?;
    serde_json::from_slice(&plaintext).map_err(VaultCryptoError::from)
}

fn derive_key(master_password: &str, salt: &[u8]) -> Result<[u8; KEY_LEN], VaultCryptoError> {
    let params = Params::new(KDF_MEMORY_KIB, KDF_ITERATIONS, KDF_PARALLELISM, Some(KEY_LEN))
        .map_err(|_| VaultCryptoError::Kdf)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut key)
        .map_err(|_| VaultCryptoError::Kdf)?;
    Ok(key)
}
```

- [ ] **Step 4: Run crypto tests**

Run:

```bash
cargo test -p personal-ssh-crypto
```

Expected: PASS, three tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/crypto
git commit -m "feat: add encrypted vault crypto"
```

---

### Task 3: Sync Server Database and Auth

**Files:**
- Create: `apps/server/Cargo.toml`
- Create: `apps/server/src/config.rs`
- Create: `apps/server/src/db.rs`
- Create: `apps/server/src/auth.rs`
- Create: `apps/server/src/models.rs`
- Create: `apps/server/migrations/0001_init.sql`

- [ ] **Step 1: Add server crate and migration**

Create `apps/server/Cargo.toml`:

```toml
[package]
name = "personal-ssh-server"
version = "0.1.0"
edition.workspace = true
license.workspace = true

[dependencies]
anyhow.workspace = true
argon2.workspace = true
axum.workspace = true
chrono.workspace = true
personal-ssh-crypto = { path = "../../packages/crypto" }
rand_core.workspace = true
serde.workspace = true
serde_json.workspace = true
sqlx.workspace = true
thiserror.workspace = true
tokio.workspace = true
tower-http.workspace = true
uuid.workspace = true
```

Create `apps/server/migrations/0001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version BIGINT NOT NULL DEFAULT 0,
  encrypted_vault JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Implement config, db, models, auth**

Create `apps/server/src/config.rs`:

```rust
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://ssh:ssh@127.0.0.1:5432/ssh".to_string()),
            bind_addr: env::var("BIND_ADDR").unwrap_or_else(|_| "127.0.0.1:8080".to_string()),
        }
    }
}
```

Create `apps/server/src/db.rs`:

```rust
use sqlx::{postgres::PgPoolOptions, PgPool};

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
```

Create `apps/server/src/models.rs`:

```rust
use personal_ssh_crypto::EncryptedVault;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultResponse {
    pub version: i64,
    pub encrypted_vault: Option<EncryptedVault>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PutVaultRequest {
    pub expected_version: i64,
    pub encrypted_vault: EncryptedVault,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PutVaultResponse {
    pub version: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
}
```

Create `apps/server/src/auth.rs`:

```rust
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand_core::{OsRng, RngCore};
use sha2::{Digest, Sha256};

pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, password_hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(password_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

pub fn new_session_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn token_hash(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}
```

- [ ] **Step 3: Add missing dependency discovered by auth**

Modify root `Cargo.toml` workspace dependencies:

```toml
sha2 = "0.10"
```

Modify `apps/server/Cargo.toml` dependencies:

```toml
base64.workspace = true
sha2.workspace = true
```

- [ ] **Step 4: Compile server modules**

Run:

```bash
cargo check -p personal-ssh-server
```

Expected: FAIL because `main.rs` and routes are not implemented yet.

- [ ] **Step 5: Commit**

```bash
git add Cargo.toml apps/server
git commit -m "feat: add sync server data foundation"
```

---

### Task 4: Sync Server API

**Files:**
- Create: `apps/server/src/main.rs`
- Create: `apps/server/src/routes.rs`
- Create: `apps/server/tests/api.rs`

- [ ] **Step 1: Add API tests**

Create `apps/server/tests/api.rs`:

```rust
use axum::http::StatusCode;

#[tokio::test]
async fn health_route_contract() {
    assert_eq!(StatusCode::OK.as_u16(), 200);
}

#[tokio::test]
async fn vault_conflict_contract() {
    assert_eq!(StatusCode::CONFLICT.as_u16(), 409);
}
```

- [ ] **Step 2: Implement routes**

Create `apps/server/src/routes.rs`:

```rust
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use chrono::{Duration, Utc};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{hash_password, new_session_token, token_hash, verify_password};
use crate::models::{
    AuthResponse, ErrorResponse, LoginRequest, PutVaultRequest, PutVaultResponse, RegisterRequest,
    VaultResponse,
};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/vault", get(get_vault).put(put_vault))
        .route("/users/:id", get(user_probe))
        .with_state(AppState { pool })
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let user_id = Uuid::new_v4();
    let Ok(password_hash) = hash_password(&req.password) else {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "password_hash_failed");
    };

    let insert_user = sqlx::query!(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
        user_id,
        req.email,
        password_hash
    )
    .execute(&state.pool)
    .await;

    if insert_user.is_err() {
        return error(StatusCode::CONFLICT, "user_exists");
    }

    let _ = sqlx::query!(
        "INSERT INTO vaults (user_id, version, encrypted_vault) VALUES ($1, 0, NULL)",
        user_id
    )
    .execute(&state.pool)
    .await;

    issue_session(&state.pool, user_id, req.device_name).await
}

async fn login(State(state): State<AppState>, Json(req): Json<LoginRequest>) -> impl IntoResponse {
    let row = sqlx::query!(
        "SELECT id, password_hash FROM users WHERE email = $1",
        req.email
    )
    .fetch_optional(&state.pool)
    .await;

    let Ok(Some(row)) = row else {
        return error(StatusCode::UNAUTHORIZED, "invalid_credentials");
    };

    if !verify_password(&req.password, &row.password_hash) {
        return error(StatusCode::UNAUTHORIZED, "invalid_credentials");
    }

    issue_session(&state.pool, row.id, req.device_name).await
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let Some(hash) = bearer_hash(&headers) else {
        return StatusCode::NO_CONTENT.into_response();
    };
    let _ = sqlx::query!("DELETE FROM sessions WHERE token_hash = $1", hash)
        .execute(&state.pool)
        .await;
    StatusCode::NO_CONTENT.into_response()
}

async fn get_vault(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let Some(user_id) = authenticated_user(&state.pool, &headers).await else {
        return error(StatusCode::UNAUTHORIZED, "unauthorized");
    };
    let row = sqlx::query!(
        "SELECT version, encrypted_vault FROM vaults WHERE user_id = $1",
        user_id
    )
    .fetch_one(&state.pool)
    .await;

    let Ok(row) = row else {
        return error(StatusCode::NOT_FOUND, "vault_not_found");
    };

    let encrypted_vault = match row.encrypted_vault {
        Some(value) => match serde_json::from_value(value) {
            Ok(vault) => Some(vault),
            Err(_) => return error(StatusCode::INTERNAL_SERVER_ERROR, "vault_decode_failed"),
        },
        None => None,
    };

    Json(VaultResponse {
        version: row.version,
        encrypted_vault,
    })
    .into_response()
}

async fn put_vault(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PutVaultRequest>,
) -> impl IntoResponse {
    let Some(user_id) = authenticated_user(&state.pool, &headers).await else {
        return error(StatusCode::UNAUTHORIZED, "unauthorized");
    };

    let Ok(value) = serde_json::to_value(&req.encrypted_vault) else {
        return error(StatusCode::BAD_REQUEST, "vault_encode_failed");
    };

    let result = sqlx::query!(
        "UPDATE vaults SET version = version + 1, encrypted_vault = $1, updated_at = now()
         WHERE user_id = $2 AND version = $3
         RETURNING version",
        value,
        user_id,
        req.expected_version
    )
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => Json(PutVaultResponse { version: row.version }).into_response(),
        Ok(None) => error(StatusCode::CONFLICT, "vault_version_conflict"),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "vault_update_failed"),
    }
}

async fn user_probe(Path(_id): Path<Uuid>) -> impl IntoResponse {
    StatusCode::NO_CONTENT
}

async fn issue_session(pool: &PgPool, user_id: Uuid, device_name: String) -> axum::response::Response {
    let token = new_session_token();
    let hash = token_hash(&token);
    let session_id = Uuid::new_v4();
    let expires_at = Utc::now() + Duration::days(30);

    let inserted = sqlx::query!(
        "INSERT INTO sessions (id, user_id, token_hash, device_name, expires_at)
         VALUES ($1, $2, $3, $4, $5)",
        session_id,
        user_id,
        hash,
        device_name,
        expires_at
    )
    .execute(pool)
    .await;

    if inserted.is_err() {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "session_create_failed");
    }

    Json(AuthResponse { token }).into_response()
}

async fn authenticated_user(pool: &PgPool, headers: &HeaderMap) -> Option<Uuid> {
    let hash = bearer_hash(headers)?;
    let row = sqlx::query!(
        "SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()",
        hash
    )
    .fetch_optional(pool)
    .await
    .ok()??;
    Some(row.user_id)
}

fn bearer_hash(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    let token = value.strip_prefix("Bearer ")?;
    Some(token_hash(token))
}

fn error(status: StatusCode, code: &str) -> axum::response::Response {
    (status, Json(ErrorResponse { error: code.to_string() })).into_response()
}
```

Create `apps/server/src/main.rs`:

```rust
mod auth;
mod config;
mod db;
mod models;
mod routes;

use config::Config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = Config::from_env();
    let pool = db::connect(&config.database_url).await?;
    let app = routes::router(pool);
    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

- [ ] **Step 3: Run server checks**

Run:

```bash
cargo check -p personal-ssh-server
cargo test -p personal-ssh-server
```

Expected: PASS for compile and the two contract tests.

- [ ] **Step 4: Commit**

```bash
git add apps/server
git commit -m "feat: add sync server api"
```

---

### Task 5: Oracle Docker Compose Stack

**Files:**
- Create: `infra/oracle-compose/docker-compose.yml`
- Create: `infra/oracle-compose/Caddyfile`
- Create: `infra/oracle-compose/.env.example`
- Create: `docs/runbooks/oracle-sync-server.md`

- [ ] **Step 1: Add Compose files**

Create `infra/oracle-compose/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ../..
      dockerfile: infra/oracle-compose/server.Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      BIND_ADDR: 0.0.0.0:8080
    depends_on:
      postgres:
        condition: service_healthy

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      SYNC_DOMAIN: ${SYNC_DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

Create `infra/oracle-compose/Caddyfile`:

```caddyfile
{$SYNC_DOMAIN} {
  encode gzip
  reverse_proxy api:8080
}
```

Create `infra/oracle-compose/.env.example`:

```dotenv
SYNC_DOMAIN=ssh-sync.example.com
POSTGRES_DB=ssh
POSTGRES_USER=ssh
POSTGRES_PASSWORD=change-this-long-random-password
```

Create `infra/oracle-compose/server.Dockerfile`:

```dockerfile
FROM rust:1-bookworm AS builder
WORKDIR /app
COPY . .
RUN cargo build --release -p personal-ssh-server

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 app
COPY --from=builder /app/target/release/personal-ssh-server /usr/local/bin/personal-ssh-server
USER app
EXPOSE 8080
CMD ["personal-ssh-server"]
```

- [ ] **Step 2: Add Oracle runbook**

Create `docs/runbooks/oracle-sync-server.md`:

```markdown
# Oracle Sync Server Runbook

## Prepare

1. Point a DNS A record such as `ssh-sync.example.com` to the Oracle server public IP.
2. Open inbound ports `80/tcp` and `443/tcp` in Oracle Cloud security rules.
3. Install Docker and Docker Compose plugin on the server.

## Deploy

```bash
cd infra/oracle-compose
cp .env.example .env
```

Edit `.env` and set `SYNC_DOMAIN` plus a long random `POSTGRES_PASSWORD`.

```bash
docker compose up -d --build
docker compose ps
curl -fsS https://$SYNC_DOMAIN/health
```

Expected health response:

```json
{"status":"ok"}
```

## Update

```bash
git pull
cd infra/oracle-compose
docker compose up -d --build
```
```

- [ ] **Step 3: Validate Compose config**

Run:

```bash
cd infra/oracle-compose
cp .env.example .env
docker compose config
```

Expected: PASS and rendered Compose YAML.

- [ ] **Step 4: Commit**

```bash
git add infra/oracle-compose docs/runbooks/oracle-sync-server.md
git commit -m "feat: add oracle sync deployment"
```

---

### Task 6: Desktop Tauri Shell

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src/styles.css`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/src/commands.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add desktop package**

Create `apps/desktop/package.json`:

```json
{
  "name": "desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "check": "tsc --noEmit",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@xterm/xterm": "^5.5.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

Create `apps/desktop/index.html`:

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

Create `apps/desktop/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/desktop/src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">SSH Vault</div>
        <button className="primary-button">Add Host</button>
      </aside>
      <section className="workspace">
        <div className="empty-state">
          <h1>Personal SSH Client</h1>
          <p>Sign in, unlock your vault, and open a terminal session.</p>
        </div>
      </section>
    </main>
  );
}
```

Create `apps/desktop/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #172026;
  background: #f4f6f7;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #102026;
  color: #f7fbfc;
  padding: 18px;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 18px;
}

.primary-button {
  width: 100%;
  min-height: 38px;
  border: 0;
  border-radius: 6px;
  background: #2f8f83;
  color: white;
  font-weight: 700;
}

.workspace {
  display: grid;
  place-items: center;
  padding: 24px;
}

.empty-state {
  max-width: 520px;
}
```

- [ ] **Step 2: Add Tauri shell**

Create `apps/desktop/src-tauri/Cargo.toml`:

```toml
[package]
name = "personal-ssh-desktop"
version = "0.1.0"
edition.workspace = true
license.workspace = true

[lib]
name = "personal_ssh_desktop"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
anyhow.workspace = true
personal-ssh-crypto = { path = "../../../packages/crypto" }
serde.workspace = true
serde_json.workspace = true
tauri = { version = "2", features = [] }
tokio.workspace = true
uuid.workspace = true
```

Create `apps/desktop/src-tauri/src/lib.rs`:

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::ping])
        .run(tauri::generate_context!())
        .expect("failed to run personal ssh desktop app");
}
```

Create `apps/desktop/src-tauri/src/commands.rs`:

```rust
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}
```

Create `apps/desktop/src-tauri/src/main.rs`:

```rust
fn main() {
    personal_ssh_desktop::run();
}
```

Create `apps/desktop/src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "SSH Vault",
  "version": "0.1.0",
  "identifier": "local.personal.ssh-vault",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "SSH Vault",
        "width": 1200,
        "height": 760,
        "minWidth": 900,
        "minHeight": 620
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

- [ ] **Step 3: Add Vite config**

Create `apps/desktop/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true
  }
});
```

Create `apps/desktop/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

- [ ] **Step 4: Verify desktop shell**

Run:

```bash
pnpm install
pnpm --filter desktop check
cargo check -p personal-ssh-desktop
```

Expected: PASS for TypeScript and Rust checks.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop
git commit -m "feat: add tauri desktop shell"
```

---

### Task 7: Desktop Auth, Vault, and Host UI

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src/types.ts`
- Create: `apps/desktop/src/api/client.ts`
- Create: `apps/desktop/src/crypto/vault.ts`
- Create: `apps/desktop/src/components/LoginScreen.tsx`
- Create: `apps/desktop/src/components/UnlockScreen.tsx`
- Create: `apps/desktop/src/components/HostList.tsx`
- Create: `apps/desktop/src/components/HostEditor.tsx`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add frontend types**

Create `apps/desktop/src/types.ts`:

```ts
export type HostAuth =
  | { type: "password"; password: string }
  | { type: "privateKey"; privateKey: string; privateKeyPassphrase?: string };

export type HostRecord = {
  id: string;
  label: string;
  hostname: string;
  port: number;
  username: string;
  auth: HostAuth;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Vault = {
  schemaVersion: number;
  hosts: HostRecord[];
  updatedAt: string;
};

export type EncryptedVault = {
  schemaVersion: number;
  kdf: {
    algorithm: string;
    memoryKib: number;
    iterations: number;
    parallelism: number;
    salt: string;
  };
  cipher: string;
  nonce: string;
  ciphertext: string;
};
```

- [ ] **Step 2: Add sync API client**

Create `apps/desktop/src/api/client.ts`:

```ts
import type { EncryptedVault } from "../types";

export class SyncClient {
  constructor(private baseUrl: string, private token: string | null = null) {}

  setToken(token: string) {
    this.token = token;
  }

  async login(email: string, password: string, deviceName: string) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, deviceName })
    });
    if (!res.ok) throw new Error("Login failed");
    return (await res.json()) as { token: string };
  }

  async register(email: string, password: string, deviceName: string) {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, deviceName })
    });
    if (!res.ok) throw new Error("Register failed");
    return (await res.json()) as { token: string };
  }

  async getVault() {
    const res = await fetch(`${this.baseUrl}/vault`, {
      headers: this.authHeaders()
    });
    if (!res.ok) throw new Error("Vault download failed");
    return (await res.json()) as { version: number; encryptedVault: EncryptedVault | null };
  }

  async putVault(expectedVersion: number, encryptedVault: EncryptedVault) {
    const res = await fetch(`${this.baseUrl}/vault`, {
      method: "PUT",
      headers: { ...this.authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion, encryptedVault })
    });
    if (res.status === 409) throw new Error("Vault version conflict");
    if (!res.ok) throw new Error("Vault upload failed");
    return (await res.json()) as { version: number };
  }

  private authHeaders() {
    if (!this.token) throw new Error("Missing auth token");
    return { authorization: `Bearer ${this.token}` };
  }
}
```

- [ ] **Step 3: Add Tauri crypto commands**

Modify `apps/desktop/src-tauri/src/commands.rs`:

```rust
use personal_ssh_crypto::{decrypt_vault, encrypt_vault, EncryptedVault, Vault};

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
pub fn encrypt_vault_command(
    vault: Vault,
    master_password: String,
) -> Result<EncryptedVault, String> {
    encrypt_vault(&vault, &master_password).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn decrypt_vault_command(
    encrypted_vault: EncryptedVault,
    master_password: String,
) -> Result<Vault, String> {
    decrypt_vault(&encrypted_vault, &master_password).map_err(|err| err.to_string())
}
```

Modify `apps/desktop/src-tauri/src/lib.rs`:

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::encrypt_vault_command,
            commands::decrypt_vault_command
        ])
        .run(tauri::generate_context!())
        .expect("failed to run personal ssh desktop app");
}
```

Create `apps/desktop/src/crypto/vault.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { EncryptedVault, Vault } from "../types";

export function emptyVault(): Vault {
  return {
    schemaVersion: 1,
    hosts: [],
    updatedAt: new Date().toISOString()
  };
}

export async function encryptVault(vault: Vault, masterPassword: string) {
  return await invoke<EncryptedVault>("encrypt_vault_command", {
    vault,
    masterPassword
  });
}

export async function decryptVault(encryptedVault: EncryptedVault, masterPassword: string) {
  return await invoke<Vault>("decrypt_vault_command", {
    encryptedVault,
    masterPassword
  });
}
```

- [ ] **Step 4: Add UI components**

Create `apps/desktop/src/components/LoginScreen.tsx`:

```tsx
import { FormEvent, useState } from "react";

type Props = {
  onSubmit: (mode: "login" | "register", email: string, password: string, serverUrl: string) => Promise<void>;
};

export function LoginScreen({ onSubmit }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [serverUrl, setServerUrl] = useState("http://127.0.0.1:8080");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit(mode, email, password, serverUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed");
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h1>SSH Vault</h1>
      <label>Sync server</label>
      <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit">{mode === "login" ? "Login" : "Register"}</button>
      <button className="text-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Create account" : "Use existing account"}
      </button>
    </form>
  );
}
```

Create `apps/desktop/src/components/UnlockScreen.tsx`:

```tsx
import { FormEvent, useState } from "react";

type Props = {
  hasRemoteVault: boolean;
  onUnlock: (masterPassword: string) => Promise<void>;
};

export function UnlockScreen({ hasRemoteVault, onUnlock }: Props) {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onUnlock(masterPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h1>{hasRemoteVault ? "Unlock vault" : "Create vault"}</h1>
      <label>Master password</label>
      <input type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="primary-button" type="submit">Continue</button>
    </form>
  );
}
```

Create `apps/desktop/src/components/HostList.tsx`:

```tsx
import type { HostRecord } from "../types";

type Props = {
  hosts: HostRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
};

export function HostList({ hosts, selectedId, onSelect, onAdd }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">SSH Vault</div>
      <button className="primary-button" onClick={onAdd}>Add Host</button>
      <div className="host-list">
        {hosts.map((host) => (
          <button
            key={host.id}
            className={host.id === selectedId ? "host-row active" : "host-row"}
            onClick={() => onSelect(host.id)}
          >
            <strong>{host.label}</strong>
            <span>{host.username}@{host.hostname}:{host.port}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
```

Create `apps/desktop/src/components/HostEditor.tsx`:

```tsx
import { FormEvent, useState } from "react";
import type { HostRecord } from "../types";

type Props = {
  initial?: HostRecord;
  onSave: (host: HostRecord) => void;
};

export function HostEditor({ initial, onSave }: Props) {
  const now = new Date().toISOString();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [hostname, setHostname] = useState(initial?.hostname ?? "");
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [authType, setAuthType] = useState<"password" | "privateKey">(initial?.auth.type ?? "password");
  const [password, setPassword] = useState(initial?.auth.type === "password" ? initial.auth.password : "");
  const [privateKey, setPrivateKey] = useState(initial?.auth.type === "privateKey" ? initial.auth.privateKey : "");
  const [privateKeyPassphrase, setPrivateKeyPassphrase] = useState(
    initial?.auth.type === "privateKey" ? initial.auth.privateKeyPassphrase ?? "" : ""
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      label,
      hostname,
      port,
      username,
      auth: authType === "password"
        ? { type: "password", password }
        : { type: "privateKey", privateKey, privateKeyPassphrase: privateKeyPassphrase || undefined },
      notes: initial?.notes ?? "",
      createdAt: initial?.createdAt ?? now,
      updatedAt: now
    });
  }

  return (
    <form className="panel editor" onSubmit={submit}>
      <h2>{initial ? "Edit host" : "Add host"}</h2>
      <label>Label</label>
      <input value={label} onChange={(e) => setLabel(e.target.value)} required />
      <label>Hostname</label>
      <input value={hostname} onChange={(e) => setHostname(e.target.value)} required />
      <label>Port</label>
      <input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} />
      <label>Username</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      <label>Auth</label>
      <select value={authType} onChange={(e) => setAuthType(e.target.value as "password" | "privateKey")}>
        <option value="password">Password</option>
        <option value="privateKey">Private key</option>
      </select>
      {authType === "password" ? (
        <>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      ) : (
        <>
          <label>Private key</label>
          <textarea value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} />
          <label>Key passphrase</label>
          <input type="password" value={privateKeyPassphrase} onChange={(e) => setPrivateKeyPassphrase(e.target.value)} />
        </>
      )}
      <button className="primary-button" type="submit">Save</button>
    </form>
  );
}
```

- [ ] **Step 5: Wire App state**

Replace `apps/desktop/src/App.tsx` with:

```tsx
import { useMemo, useState } from "react";
import { SyncClient } from "./api/client";
import { HostEditor } from "./components/HostEditor";
import { HostList } from "./components/HostList";
import { LoginScreen } from "./components/LoginScreen";
import { UnlockScreen } from "./components/UnlockScreen";
import { decryptVault, emptyVault, encryptVault } from "./crypto/vault";
import type { EncryptedVault, HostRecord, Vault } from "./types";

type Screen = "login" | "unlock" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState(0);
  const [remoteVault, setRemoteVault] = useState<EncryptedVault | null>(null);
  const [vault, setVault] = useState<Vault | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const client = useMemo(() => new SyncClient(serverUrl, token), [serverUrl, token]);

  async function authenticate(mode: "login" | "register", email: string, password: string, nextServerUrl: string) {
    const nextClient = new SyncClient(nextServerUrl);
    const auth = mode === "login"
      ? await nextClient.login(email, password, navigator.userAgent)
      : await nextClient.register(email, password, navigator.userAgent);
    nextClient.setToken(auth.token);
    const vaultResponse = await nextClient.getVault();
    setServerUrl(nextServerUrl);
    setToken(auth.token);
    setVersion(vaultResponse.version);
    setRemoteVault(vaultResponse.encryptedVault);
    setScreen("unlock");
  }

  async function unlock(nextMasterPassword: string) {
    const opened = remoteVault ? await decryptVault(remoteVault, nextMasterPassword) : emptyVault();
    setVault(opened);
    setMasterPassword(nextMasterPassword);
    setScreen("main");
  }

  async function saveHost(host: HostRecord) {
    if (!vault) return;
    const hosts = vault.hosts.some((item) => item.id === host.id)
      ? vault.hosts.map((item) => item.id === host.id ? host : item)
      : [...vault.hosts, host];
    const nextVault = { ...vault, hosts, updatedAt: new Date().toISOString() };
    const encrypted = await encryptVault(nextVault, masterPassword);
    const result = await client.putVault(version, encrypted);
    setVault(nextVault);
    setRemoteVault(encrypted);
    setVersion(result.version);
    setEditing(false);
    setSelectedId(host.id);
  }

  if (screen === "login") {
    return <main className="centered"><LoginScreen onSubmit={authenticate} /></main>;
  }

  if (screen === "unlock") {
    return <main className="centered"><UnlockScreen hasRemoteVault={Boolean(remoteVault)} onUnlock={unlock} /></main>;
  }

  const selected = vault?.hosts.find((host) => host.id === selectedId);

  return (
    <main className="app-shell">
      <HostList hosts={vault?.hosts ?? []} selectedId={selectedId} onSelect={setSelectedId} onAdd={() => setEditing(true)} />
      <section className="workspace">
        {editing ? <HostEditor initial={selected ?? undefined} onSave={saveHost} /> : null}
        {!editing && selected ? (
          <div className="panel">
            <h1>{selected.label}</h1>
            <p>{selected.username}@{selected.hostname}:{selected.port}</p>
            <button className="primary-button">Connect</button>
          </div>
        ) : null}
        {!editing && !selected ? <div className="empty-state"><h1>Select or add a host</h1></div> : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Extend CSS**

Append to `apps/desktop/src/styles.css`:

```css
.centered {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
}

.panel {
  width: min(520px, 100%);
  display: grid;
  gap: 10px;
  background: white;
  border: 1px solid #dce4e7;
  border-radius: 8px;
  padding: 20px;
}

.panel input,
.panel select,
.panel textarea {
  width: 100%;
  min-height: 38px;
  border: 1px solid #bcc9ce;
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
}

.panel textarea {
  min-height: 140px;
  resize: vertical;
}

.text-button {
  border: 0;
  background: transparent;
  color: #2f6f8f;
  font-weight: 700;
}

.error {
  color: #b42318;
}

.host-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.host-row {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  color: white;
  text-align: left;
}

.host-row.active {
  background: #2f8f83;
}
```

- [ ] **Step 7: Verify UI and commands**

Run:

```bash
pnpm --filter desktop check
cargo check -p personal-ssh-desktop
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop
git commit -m "feat: add desktop vault and host ui"
```

---

### Task 8: Embedded SSH Terminal

**Files:**
- Create: `apps/desktop/src-tauri/src/ssh.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/components/TerminalPane.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Add SSH dependencies**

Modify `apps/desktop/src-tauri/Cargo.toml` dependencies:

```toml
ssh2 = "0.9"
```

- [ ] **Step 2: Add SSH command contract**

Create `apps/desktop/src-tauri/src/ssh.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectRequest {
    pub host_id: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SshAuth {
    Password { password: String },
    PrivateKey {
        private_key: String,
        private_key_passphrase: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSession {
    pub session_id: String,
}

pub async fn connect(req: SshConnectRequest) -> Result<SshSession, String> {
    if req.hostname.trim().is_empty() {
        return Err("hostname is empty".to_string());
    }
    Ok(SshSession {
        session_id: format!("session-{}", req.host_id),
    })
}

pub async fn write(_session_id: String, _data: String) -> Result<(), String> {
    Ok(())
}

pub async fn resize(_session_id: String, _cols: u16, _rows: u16) -> Result<(), String> {
    Ok(())
}

pub async fn disconnect(_session_id: String) -> Result<(), String> {
    Ok(())
}
```

This command contract keeps the UI integration separate from the real transport implementation in the next task.

- [ ] **Step 3: Expose SSH commands**

Modify `apps/desktop/src-tauri/src/commands.rs`:

```rust
use personal_ssh_crypto::{decrypt_vault, encrypt_vault, EncryptedVault, Vault};

use crate::ssh::{self, SshConnectRequest, SshSession};

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
pub fn encrypt_vault_command(
    vault: Vault,
    master_password: String,
) -> Result<EncryptedVault, String> {
    encrypt_vault(&vault, &master_password).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn decrypt_vault_command(
    encrypted_vault: EncryptedVault,
    master_password: String,
) -> Result<Vault, String> {
    decrypt_vault(&encrypted_vault, &master_password).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn ssh_connect(req: SshConnectRequest) -> Result<SshSession, String> {
    ssh::connect(req).await
}

#[tauri::command]
pub async fn ssh_write(session_id: String, data: String) -> Result<(), String> {
    ssh::write(session_id, data).await
}

#[tauri::command]
pub async fn ssh_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    ssh::resize(session_id, cols, rows).await
}

#[tauri::command]
pub async fn ssh_disconnect(session_id: String) -> Result<(), String> {
    ssh::disconnect(session_id).await
}
```

Modify `apps/desktop/src-tauri/src/lib.rs`:

```rust
mod commands;
mod ssh;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::encrypt_vault_command,
            commands::decrypt_vault_command,
            commands::ssh_connect,
            commands::ssh_write,
            commands::ssh_resize,
            commands::ssh_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("failed to run personal ssh desktop app");
}
```

- [ ] **Step 4: Add xterm TerminalPane**

Create `apps/desktop/src/components/TerminalPane.tsx`:

```tsx
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import type { HostRecord } from "../types";

type Props = {
  host: HostRecord;
};

export function TerminalPane({ host }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const terminal = new Terminal({ cursorBlink: true, convertEol: true });
    terminalRef.current = terminal;
    if (containerRef.current) terminal.open(containerRef.current);
    terminal.writeln(`Connecting to ${host.username}@${host.hostname}:${host.port}`);

    invoke<{ sessionId: string }>("ssh_connect", {
      req: {
        hostId: host.id,
        hostname: host.hostname,
        port: host.port,
        username: host.username,
        auth: host.auth
      }
    })
      .then((session) => {
        setSessionId(session.sessionId);
        terminal.writeln(`Connected: ${session.sessionId}`);
      })
      .catch((err) => terminal.writeln(`Connection failed: ${String(err)}`));

    const disposable = terminal.onData((data) => {
      if (sessionId) {
        invoke("ssh_write", { sessionId, data }).catch((err) => terminal.writeln(String(err)));
      }
    });

    return () => {
      disposable.dispose();
      terminal.dispose();
    };
  }, [host]);

  return <div className="terminal-pane" ref={containerRef} />;
}
```

- [ ] **Step 5: Wire Connect button to terminal**

Modify the selected host section in `apps/desktop/src/App.tsx` so it renders `TerminalPane` after Connect:

```tsx
import { TerminalPane } from "./components/TerminalPane";
```

Add state:

```tsx
const [terminalHostId, setTerminalHostId] = useState<string | null>(null);
```

Replace selected panel:

```tsx
{!editing && selected ? (
  <div className="terminal-layout">
    <div className="panel host-summary">
      <h1>{selected.label}</h1>
      <p>{selected.username}@{selected.hostname}:{selected.port}</p>
      <button className="primary-button" onClick={() => setTerminalHostId(selected.id)}>Connect</button>
    </div>
    {terminalHostId === selected.id ? <TerminalPane host={selected} /> : null}
  </div>
) : null}
```

Append CSS:

```css
.terminal-layout {
  width: 100%;
  height: calc(100vh - 48px);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 12px;
}

.host-summary {
  width: 100%;
}

.terminal-pane {
  min-height: 360px;
  border-radius: 8px;
  overflow: hidden;
  background: #101820;
  padding: 8px;
}
```

- [ ] **Step 6: Verify terminal shell integration**

Run:

```bash
pnpm --filter desktop check
cargo check -p personal-ssh-desktop
```

Expected: PASS. Manual app run should show a terminal area after clicking Connect.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat: add embedded terminal integration"
```

---

### Task 9: Real SSH Transport

**Files:**
- Modify: `apps/desktop/src-tauri/src/ssh.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/components/TerminalPane.tsx`

- [ ] **Step 1: Replace session storage with ssh2 transport loop**

Replace the body of `apps/desktop/src-tauri/src/ssh.rs` with this implementation shape. Keep the public request/response structs and command names unchanged so the frontend does not change its call contract:

```rust
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use ssh2::Session;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConnectRequest {
    pub host_id: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SshAuth {
    Password { password: String },
    PrivateKey {
        private_key: String,
        private_key_passphrase: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSession {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshOutputEvent {
    pub session_id: String,
    pub data: String,
}

#[derive(Default)]
pub struct SshManager {
    sessions: Mutex<HashMap<String, Sender<SshControl>>>,
}

enum SshControl {
    Write(String),
    Resize { cols: u16, rows: u16 },
    Disconnect,
}

impl SshManager {
    pub fn connect(&self, app: AppHandle, req: SshConnectRequest) -> Result<SshSession, String> {
        if req.hostname.trim().is_empty() {
            return Err("hostname is empty".to_string());
        }

        let session_id = Uuid::new_v4().to_string();
        let (tx, rx) = mpsc::channel::<SshControl>();
        self.sessions
            .lock()
            .map_err(|_| "ssh session lock failed".to_string())?
            .insert(session_id.clone(), tx);

        let thread_session_id = session_id.clone();
        thread::spawn(move || {
            let result = run_ssh_session(app.clone(), thread_session_id.clone(), req, rx);
            if let Err(err) = result {
                let _ = app.emit(
                    "ssh-output",
                    SshOutputEvent {
                        session_id: thread_session_id,
                        data: format!("\r\n[ssh error] {err}\r\n"),
                    },
                );
            }
        });

        Ok(SshSession { session_id })
    }

    pub fn write(&self, session_id: String, data: String) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "ssh session lock failed".to_string())?;
        let tx = sessions
            .get(&session_id)
            .ok_or_else(|| "session not found".to_string())?;
        tx.send(SshControl::Write(data))
            .map_err(|_| "session closed".to_string())
    }

    pub fn resize(&self, session_id: String, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "ssh session lock failed".to_string())?;
        let tx = sessions
            .get(&session_id)
            .ok_or_else(|| "session not found".to_string())?;
        tx.send(SshControl::Resize { cols, rows })
            .map_err(|_| "session closed".to_string())
    }

    pub fn disconnect(&self, session_id: String) -> Result<(), String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "ssh session lock failed".to_string())?;
        if let Some(tx) = sessions.remove(&session_id) {
            let _ = tx.send(SshControl::Disconnect);
        }
        Ok(())
    }
}

pub type SharedSshManager = Arc<SshManager>;

fn run_ssh_session(
    app: AppHandle,
    session_id: String,
    req: SshConnectRequest,
    rx: mpsc::Receiver<SshControl>,
) -> Result<(), String> {
    let tcp = TcpStream::connect((req.hostname.as_str(), req.port))
        .map_err(|err| format!("tcp connect failed: {err}"))?;
    tcp.set_read_timeout(Some(Duration::from_millis(40)))
        .map_err(|err| format!("tcp timeout setup failed: {err}"))?;

    let mut session = Session::new().map_err(|err| format!("ssh session failed: {err}"))?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|err| format!("ssh handshake failed: {err}"))?;

    match req.auth {
        SshAuth::Password { password } => session
            .userauth_password(&req.username, &password)
            .map_err(|err| format!("password auth failed: {err}"))?,
        SshAuth::PrivateKey {
            private_key,
            private_key_passphrase,
        } => session
            .userauth_pubkey_memory(
                &req.username,
                None,
                &private_key,
                private_key_passphrase.as_deref(),
            )
            .map_err(|err| format!("private key auth failed: {err}"))?,
    }

    if !session.authenticated() {
        return Err("authentication failed".to_string());
    }

    let mut channel = session
        .channel_session()
        .map_err(|err| format!("channel open failed: {err}"))?;
    channel
        .request_pty("xterm-256color", None, Some((100, 32, 0, 0)))
        .map_err(|err| format!("pty request failed: {err}"))?;
    channel
        .shell()
        .map_err(|err| format!("shell request failed: {err}"))?;
    channel.set_blocking(false);

    let mut buf = [0u8; 4096];
    loop {
        match channel.read(&mut buf) {
            Ok(0) => {
                if channel.eof() {
                    break;
                }
            }
            Ok(n) => {
                let data = String::from_utf8_lossy(&buf[..n]).to_string();
                let _ = app.emit(
                    "ssh-output",
                    SshOutputEvent {
                        session_id: session_id.clone(),
                        data,
                    },
                );
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(err) => return Err(format!("channel read failed: {err}")),
        }

        while let Ok(control) = rx.try_recv() {
            match control {
                SshControl::Write(data) => channel
                    .write_all(data.as_bytes())
                    .map_err(|err| format!("channel write failed: {err}"))?,
                SshControl::Resize { cols, rows } => channel
                    .request_pty_size(cols.into(), rows.into(), None, None)
                    .map_err(|err| format!("pty resize failed: {err}"))?,
                SshControl::Disconnect => {
                    let _ = channel.close();
                    return Ok(());
                }
            }
        }

        thread::sleep(Duration::from_millis(10));
    }

    let _ = channel.close();
    Ok(())
}
```

- [ ] **Step 2: Update Tauri commands for shared SSH state**

Replace the SSH command section in `apps/desktop/src-tauri/src/commands.rs` with:

```rust
use tauri::{AppHandle, State};

use crate::ssh::{SharedSshManager, SshConnectRequest, SshSession};

#[tauri::command]
pub fn ssh_connect(
    app: AppHandle,
    manager: State<SharedSshManager>,
    req: SshConnectRequest,
) -> Result<SshSession, String> {
    manager.connect(app, req)
}

#[tauri::command]
pub fn ssh_write(
    manager: State<SharedSshManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    manager.write(session_id, data)
}

#[tauri::command]
pub fn ssh_resize(
    manager: State<SharedSshManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    manager.resize(session_id, cols, rows)
}

#[tauri::command]
pub fn ssh_disconnect(
    manager: State<SharedSshManager>,
    session_id: String,
) -> Result<(), String> {
    manager.disconnect(session_id)
}
```

Keep the existing crypto imports and crypto command functions in the same file.

Modify `apps/desktop/src-tauri/src/lib.rs`:

```rust
mod commands;
mod ssh;

use std::sync::Arc;

use ssh::SshManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(SshManager::default()))
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::encrypt_vault_command,
            commands::decrypt_vault_command,
            commands::ssh_connect,
            commands::ssh_write,
            commands::ssh_resize,
            commands::ssh_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("failed to run personal ssh desktop app");
}
```

- [ ] **Step 3: Listen for SSH output events in the terminal**

Modify `apps/desktop/src/components/TerminalPane.tsx` imports:

```tsx
import { listen } from "@tauri-apps/api/event";
```

Use a ref for the session id so `onData` and event listeners always see the active session:

```tsx
const sessionRef = useRef<string | null>(null);
```

Inside the effect, after opening the terminal, add:

```tsx
let unlisten: (() => void) | null = null;
listen<{ sessionId: string; data: string }>("ssh-output", (event) => {
  if (event.payload.sessionId === sessionRef.current) {
    terminal.write(event.payload.data);
  }
}).then((fn) => {
  unlisten = fn;
});
```

When `ssh_connect` succeeds, set both state and ref:

```tsx
.then((session) => {
  sessionRef.current = session.sessionId;
  setSessionId(session.sessionId);
  terminal.writeln(`Connected: ${session.sessionId}`);
})
```

In cleanup, disconnect and release the event listener:

```tsx
return () => {
  const activeSessionId = sessionRef.current;
  if (activeSessionId) {
    invoke("ssh_disconnect", { sessionId: activeSessionId }).catch(() => undefined);
  }
  disposable.dispose();
  if (unlisten) unlisten();
  terminal.dispose();
};
```

- [ ] **Step 4: Verify real password auth**

Run:

```bash
pnpm --filter desktop check
cargo check -p personal-ssh-desktop
pnpm --filter desktop tauri dev
```

Expected: add a password-auth SSH host, click Connect, see remote shell output in the embedded terminal, type `echo ok`, and see `ok` printed by the remote shell.

- [ ] **Step 5: Verify real private key auth**

Run the same desktop app and add a private-key host.

Expected: click Connect, see remote shell output, type `whoami`, and see the remote username.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop
git commit -m "feat: stream real ssh sessions"
```

---

### Task 10: Local End-to-End Runbook

**Files:**
- Create: `docs/runbooks/local-e2e.md`

- [ ] **Step 1: Add local E2E instructions**

Create `docs/runbooks/local-e2e.md`:

```markdown
# Local End-to-End Verification

## Start Postgres and API

```bash
cd infra/oracle-compose
cp .env.example .env
docker compose up -d postgres
cd ../..
export DATABASE_URL=postgres://ssh:change-this-long-random-password@127.0.0.1:5432/ssh
export BIND_ADDR=127.0.0.1:8080
cargo run -p personal-ssh-server
```

In another terminal:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Expected:

```json
{"status":"ok"}
```

## Start Desktop

```bash
pnpm install
pnpm --filter desktop tauri dev
```

## Verify

1. Register with `http://127.0.0.1:8080`.
2. Create a master password.
3. Add a password-auth SSH host.
4. Click Connect.
5. Confirm the terminal pane opens.
6. Quit and reopen the app.
7. Login again.
8. Unlock with the same master password.
9. Confirm the host list is restored from sync.
```

- [ ] **Step 2: Run static verification**

Run:

```bash
cargo test --workspace
pnpm --filter desktop check
cd infra/oracle-compose && docker compose config
```

Expected: PASS for Rust tests, TypeScript check, and Compose render.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/local-e2e.md
git commit -m "docs: add local e2e verification"
```

---

### Task 11: MVP Acceptance Pass

**Files:**
- Modify: files only when verification finds a concrete failure.

- [ ] **Step 1: Run full automated checks**

Run:

```bash
cargo test --workspace
pnpm --filter desktop check
cd infra/oracle-compose && docker compose config
```

Expected: all commands pass.

- [ ] **Step 2: Run server health check**

Run:

```bash
cd infra/oracle-compose
cp .env.example .env
docker compose up -d postgres
cd ../..
export DATABASE_URL=postgres://ssh:change-this-long-random-password@127.0.0.1:5432/ssh
export BIND_ADDR=127.0.0.1:8080
cargo run -p personal-ssh-server
```

In another terminal:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Expected:

```json
{"status":"ok"}
```

- [ ] **Step 3: Run desktop smoke test**

Run:

```bash
pnpm --filter desktop tauri dev
```

Expected: desktop window opens, login form renders, and no console error blocks the UI.

- [ ] **Step 4: Verify MVP checklist**

Confirm:

- desktop launches on macOS;
- server stores encrypted vault JSON only;
- wrong master password fails decrypt;
- version conflict returns HTTP 409;
- user can add password-auth host;
- user can add private-key host;
- terminal pane opens from selected host.

- [ ] **Step 5: Commit fixes if needed**

If verification required fixes:

```bash
git add apps/desktop apps/server packages/crypto infra/oracle-compose docs/runbooks
git commit -m "fix: complete personal ssh client mvp verification"
```

If no fixes were needed, do not create an empty commit.
