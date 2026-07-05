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
        .expect("error while running tauri application");
}
