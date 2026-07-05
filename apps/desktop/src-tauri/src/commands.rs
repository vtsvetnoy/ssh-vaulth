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
