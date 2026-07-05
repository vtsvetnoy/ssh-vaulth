mod commands;
mod ssh;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ssh::SshSessions::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::encrypt_vault_command,
            commands::decrypt_vault_command,
            commands::start_ssh_session,
            commands::write_ssh_session,
            commands::stop_ssh_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
