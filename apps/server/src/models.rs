use personal_ssh_crypto::EncryptedVault;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
}

#[derive(Serialize)]
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
