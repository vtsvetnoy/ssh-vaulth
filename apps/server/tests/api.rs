use axum::body::{to_bytes, Body};
use axum::http::{header, Method, Request, StatusCode};
use personal_ssh_crypto::{EncryptedVault, KdfParams};
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use tower::ServiceExt;
use uuid::Uuid;

#[tokio::test]
async fn health_route_returns_ok_json() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://ssh:ssh@127.0.0.1:5432/ssh")
        .expect("lazy pool should be constructed");
    let app = personal_ssh_server::routes::router(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/health")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("health request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(json_body(response).await, json!({ "status": "ok" }));
}

#[tokio::test]
async fn auth_routes_answer_cors_preflight() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://ssh:ssh@127.0.0.1:5432/ssh")
        .expect("lazy pool should be constructed");
    let app = personal_ssh_server::routes::router(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::OPTIONS)
                .uri("/auth/register")
                .header(header::ORIGIN, "tauri://localhost")
                .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("preflight request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some(&header::HeaderValue::from_static("*"))
    );
}

#[tokio::test]
async fn logout_with_bearer_returns_500_when_delete_fails() {
    let pool = PgPoolOptions::new()
        .acquire_timeout(Duration::from_millis(50))
        .connect_lazy("postgres://ssh:ssh@127.0.0.1:1/ssh")
        .expect("lazy pool should be constructed");
    let app = personal_ssh_server::routes::router(pool);

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/auth/logout")
                .header(header::AUTHORIZATION, "Bearer test-token")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("logout request should complete");

    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(
        json_body(response).await,
        json!({ "error": "session_delete_failed" })
    );
}

#[tokio::test]
async fn register_vault_and_stale_update_flow() {
    let Some(database_url) = test_database_url() else {
        return;
    };

    let pool = personal_ssh_server::db::connect(&database_url)
        .await
        .expect("test database should connect and migrate");
    let app = personal_ssh_server::routes::router(pool);
    let email = format!("api-{}@example.test", Uuid::new_v4());

    let register_response = app
        .clone()
        .oneshot(json_request(
            Method::POST,
            "/auth/register",
            json!({
                "email": email,
                "password": "correct horse battery staple",
                "deviceName": "test device"
            }),
        ))
        .await
        .expect("register request should complete");

    assert_eq!(register_response.status(), StatusCode::OK);
    let register_body = json_body(register_response).await;
    let token = register_body
        .get("token")
        .and_then(Value::as_str)
        .expect("register should return token")
        .to_string();
    assert!(!token.is_empty());

    let vault_response = app
        .clone()
        .oneshot(auth_request(Method::GET, "/vault", &token, Body::empty()))
        .await
        .expect("vault request should complete");

    assert_eq!(vault_response.status(), StatusCode::OK);
    assert_eq!(
        json_body(vault_response).await,
        json!({ "version": 0, "encryptedVault": null })
    );

    let update_response = app
        .clone()
        .oneshot(auth_request(
            Method::PUT,
            "/vault",
            &token,
            json_body_payload(json!({
                "expectedVersion": 0,
                "encryptedVault": encrypted_vault_json("first")
            })),
        ))
        .await
        .expect("vault update request should complete");

    assert_eq!(update_response.status(), StatusCode::OK);
    assert_eq!(json_body(update_response).await, json!({ "version": 1 }));

    let stale_update_response = app
        .oneshot(auth_request(
            Method::PUT,
            "/vault",
            &token,
            json_body_payload(json!({
                "expectedVersion": 0,
                "encryptedVault": encrypted_vault_json("stale")
            })),
        ))
        .await
        .expect("stale vault update request should complete");

    assert_eq!(stale_update_response.status(), StatusCode::CONFLICT);
    assert_eq!(
        json_body(stale_update_response).await,
        json!({ "error": "vault_version_conflict" })
    );
}

fn test_database_url() -> Option<String> {
    std::env::var("TEST_DATABASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn json_request(method: Method, uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .body(json_body_payload(body))
        .expect("request should build")
}

fn auth_request(method: Method, uri: &str, token: &str, body: Body) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(body)
        .expect("request should build")
}

fn json_body_payload(body: Value) -> Body {
    Body::from(serde_json::to_vec(&body).expect("json body should serialize"))
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should collect");
    serde_json::from_slice(&bytes).expect("response should be json")
}

fn encrypted_vault_json(ciphertext: &str) -> Value {
    serde_json::to_value(EncryptedVault {
        schema_version: 1,
        cipher: "xchacha20poly1305".to_string(),
        kdf: KdfParams {
            algorithm: "argon2id".to_string(),
            memory_kib: 65_536,
            iterations: 3,
            parallelism: 1,
            key_length: 32,
        },
        salt: "AAAAAAAAAAAAAAAAAAAAAA==".to_string(),
        nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".to_string(),
        ciphertext: ciphertext.to_string(),
    })
    .expect("encrypted vault should serialize")
}
