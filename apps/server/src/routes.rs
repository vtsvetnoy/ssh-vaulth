use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{Duration, Utc};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
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
    let email = normalize_email(&req.email);
    let Ok(password_hash) = hash_password(&req.password) else {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "password_hash_failed");
    };

    let Ok(mut tx) = state.pool.begin().await else {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "transaction_start_failed",
        );
    };

    let insert_user =
        sqlx::query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)")
            .bind(user_id)
            .bind(email)
            .bind(password_hash)
            .execute(&mut *tx)
            .await;

    if let Err(err) = insert_user {
        if is_unique_violation(&err) {
            return error(StatusCode::CONFLICT, "user_exists");
        }
        return error(StatusCode::INTERNAL_SERVER_ERROR, "user_create_failed");
    }

    let insert_vault =
        sqlx::query("INSERT INTO vaults (user_id, version, encrypted_vault) VALUES ($1, 0, NULL)")
            .bind(user_id)
            .execute(&mut *tx)
            .await;

    if insert_vault.is_err() {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "vault_create_failed");
    }

    let token = new_session_token();
    let hash = token_hash(&token);
    let session_id = Uuid::new_v4();
    let expires_at = Utc::now() + Duration::days(30);

    let insert_session = sqlx::query(
        "INSERT INTO sessions (id, user_id, token_hash, device_name, expires_at)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(session_id)
    .bind(user_id)
    .bind(hash)
    .bind(req.device_name)
    .bind(expires_at)
    .execute(&mut *tx)
    .await;

    if insert_session.is_err() {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "session_create_failed");
    }

    if tx.commit().await.is_err() {
        return error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "transaction_commit_failed",
        );
    }

    Json(AuthResponse { token }).into_response()
}

async fn login(State(state): State<AppState>, Json(req): Json<LoginRequest>) -> impl IntoResponse {
    let email = normalize_email(&req.email);
    let row = sqlx::query("SELECT id, password_hash FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(&state.pool)
        .await;

    let Ok(Some(row)) = row else {
        return error(StatusCode::UNAUTHORIZED, "invalid_credentials");
    };

    let Ok(user_id) = row.try_get::<Uuid, _>("id") else {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "user_decode_failed");
    };
    let Ok(password_hash) = row.try_get::<String, _>("password_hash") else {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "user_decode_failed");
    };

    if !verify_password(&req.password, &password_hash) {
        return error(StatusCode::UNAUTHORIZED, "invalid_credentials");
    }

    issue_session(&state.pool, user_id, req.device_name).await
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let Some(hash) = bearer_hash(&headers) else {
        return StatusCode::NO_CONTENT.into_response();
    };

    let deleted = sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
        .bind(hash)
        .execute(&state.pool)
        .await;

    match deleted {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "session_delete_failed"),
    }
}

async fn get_vault(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let Some(user_id) = authenticated_user(&state.pool, &headers).await else {
        return error(StatusCode::UNAUTHORIZED, "unauthorized");
    };

    let row = sqlx::query("SELECT version, encrypted_vault FROM vaults WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await;

    let Ok(row) = row else {
        return error(StatusCode::NOT_FOUND, "vault_not_found");
    };
    let Ok(version) = row.try_get::<i64, _>("version") else {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "vault_decode_failed");
    };
    let Ok(encrypted_vault_value) = row.try_get::<Option<Value>, _>("encrypted_vault") else {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "vault_decode_failed");
    };

    let encrypted_vault = match encrypted_vault_value {
        Some(value) => match serde_json::from_value(value) {
            Ok(vault) => Some(vault),
            Err(_) => return error(StatusCode::INTERNAL_SERVER_ERROR, "vault_decode_failed"),
        },
        None => None,
    };

    Json(VaultResponse {
        version,
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

    let result = sqlx::query(
        "UPDATE vaults SET version = version + 1, encrypted_vault = $1, updated_at = now()
         WHERE user_id = $2 AND version = $3
         RETURNING version",
    )
    .bind(value)
    .bind(user_id)
    .bind(req.expected_version)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => match row.try_get::<i64, _>("version") {
            Ok(version) => Json(PutVaultResponse { version }).into_response(),
            Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "vault_update_failed"),
        },
        Ok(None) => error(StatusCode::CONFLICT, "vault_version_conflict"),
        Err(_) => error(StatusCode::INTERNAL_SERVER_ERROR, "vault_update_failed"),
    }
}

async fn user_probe(Path(_id): Path<Uuid>) -> impl IntoResponse {
    StatusCode::NO_CONTENT
}

async fn issue_session(
    pool: &PgPool,
    user_id: Uuid,
    device_name: String,
) -> axum::response::Response {
    let token = new_session_token();
    let hash = token_hash(&token);
    let session_id = Uuid::new_v4();
    let expires_at = Utc::now() + Duration::days(30);

    let inserted = sqlx::query(
        "INSERT INTO sessions (id, user_id, token_hash, device_name, expires_at)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(session_id)
    .bind(user_id)
    .bind(hash)
    .bind(device_name)
    .bind(expires_at)
    .execute(pool)
    .await;

    if inserted.is_err() {
        return error(StatusCode::INTERNAL_SERVER_ERROR, "session_create_failed");
    }

    Json(AuthResponse { token }).into_response()
}

async fn authenticated_user(pool: &PgPool, headers: &HeaderMap) -> Option<Uuid> {
    let hash = bearer_hash(headers)?;
    let row =
        sqlx::query("SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()")
            .bind(hash)
            .fetch_optional(pool)
            .await
            .ok()??;

    row.try_get("user_id").ok()
}

fn bearer_hash(headers: &HeaderMap) -> Option<String> {
    let value = headers.get("authorization")?.to_str().ok()?;
    let token = value.strip_prefix("Bearer ")?;
    Some(token_hash(token))
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    err.as_database_error()
        .and_then(|database_error| database_error.code())
        .is_some_and(|code| code == "23505")
}

fn error(status: StatusCode, code: &str) -> axum::response::Response {
    (
        status,
        Json(ErrorResponse {
            error: code.to_string(),
        }),
    )
        .into_response()
}
