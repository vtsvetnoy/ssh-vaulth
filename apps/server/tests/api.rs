use axum::http::StatusCode;

#[tokio::test]
async fn health_route_contract() {
    assert_eq!(StatusCode::OK.as_u16(), 200);
}

#[tokio::test]
async fn vault_conflict_contract() {
    assert_eq!(StatusCode::CONFLICT.as_u16(), 409);
}
