use personal_ssh_crypto::{decrypt_vault, encrypt_vault, EncryptedVault, Vault};
use tauri::{State, Window};

use crate::ssh::{self, SshHost, SshSessions};

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

#[tauri::command(rename_all = "camelCase")]
pub fn start_ssh_session(
    window: Window,
    sessions: State<'_, SshSessions>,
    host: SshHost,
) -> Result<String, String> {
    ssh::start_session(window, &sessions, host)
}

#[tauri::command(rename_all = "camelCase")]
pub fn write_ssh_session(
    sessions: State<'_, SshSessions>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    ssh::write_session(&sessions, &session_id, &data)
}

#[tauri::command(rename_all = "camelCase")]
pub fn stop_ssh_session(
    sessions: State<'_, SshSessions>,
    session_id: String,
) -> Result<(), String> {
    ssh::stop_session(&sessions, &session_id)
}
