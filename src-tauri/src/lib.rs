mod crypto;
mod redis_client;
mod types;

use crypto::{encrypt_password, decrypt_password};
use redis_client::RedisManager;
use std::sync::Arc;
use types::*;

#[tauri::command]
async fn get_servers(state: tauri::State<'_, Arc<RedisManager>>) -> Result<Vec<RedisServer>, String> {
    state.get_servers().await
}

#[tauri::command]
async fn save_servers(
    state: tauri::State<'_, Arc<RedisManager>>,
    servers: Vec<RedisServer>,
) -> Result<(), String> {
    state.save_servers(servers).await
}

#[tauri::command]
async fn connect_redis(
    state: tauri::State<'_, Arc<RedisManager>>,
    server: RedisServer,
) -> Result<(), String> {
    state.connect(&server).await
}

#[tauri::command]
async fn disconnect_redis(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<(), String> {
    state.disconnect(&server_id).await
}

#[tauri::command]
async fn get_redis_info(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<RedisInfo, String> {
    state.get_info(&server_id).await
}

#[tauri::command]
async fn get_client_list(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<Vec<ClientInfo>, String> {
    state.get_clients(&server_id).await
}

#[tauri::command]
async fn start_monitor(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<(), String> {
    state.start_monitor(&server_id, app).await
}

#[tauri::command]
async fn stop_monitor(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<(), String> {
    state.stop_monitor(&server_id).await
}

#[tauri::command]
async fn get_advanced_analytics(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<AdvancedAnalytics, String> {
    state.get_advanced_analytics(&server_id).await
}

#[tauri::command]
async fn get_slow_log(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    count: u32,
) -> Result<Vec<SlowLogEntry>, String> {
    state.get_slow_log(&server_id, count).await
}

#[tauri::command]
async fn get_command_stats(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<Vec<CommandStat>, String> {
    state.get_command_stats(&server_id).await
}

#[tauri::command]
fn encrypt_server_password(password: String) -> Result<String, String> {
    encrypt_password(&password)
}

#[tauri::command]
fn decrypt_server_password(encrypted: String) -> Result<String, String> {
    decrypt_password(&encrypted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let redis_manager = Arc::new(RedisManager::new());

    tauri::Builder::default()
        .manage(redis_manager)
        .invoke_handler(tauri::generate_handler![
            get_servers,
            save_servers,
            connect_redis,
            disconnect_redis,
            get_redis_info,
            get_client_list,
            start_monitor,
            stop_monitor,
            get_advanced_analytics,
            get_slow_log,
            get_command_stats,
            encrypt_server_password,
            decrypt_server_password,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
