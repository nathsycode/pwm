mod vault;
use crate::vault::{load_vault as load_vault_file, EncryptedVault, Vault, VaultError};

#[tauri::command]
fn create_vault(password: String) -> Result<Vault, VaultError> {
    let vault = Vault::new();
    vault.save(&password)?;

    Ok(vault)
}

#[tauri::command]
fn load_vault(password: String) -> Result<Vault, VaultError> {
    let ev = load_vault_file()?;
    let vault = ev.decrypt(&password)?;

    Ok(vault)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![create_vault, load_vault])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
