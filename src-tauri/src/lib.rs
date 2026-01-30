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
async fn get_memory_analytics(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<(Option<MemoryStats>, Option<String>), String> {
    state.get_memory_analytics(&server_id).await
}

#[tauri::command]
async fn get_latency_analytics(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<Option<String>, String> {
    state.get_latency_analytics(&server_id).await
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

#[tauri::command]
async fn scan_keys(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    pattern: String,
    cursor: String,
    count: u32,
) -> Result<KeyScanResult, String> {
    state.scan_keys(&server_id, &pattern, &cursor, count).await
}

#[tauri::command]
async fn get_key_value(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
) -> Result<KeyValue, String> {
    state.get_key_value(&server_id, &key).await
}

#[tauri::command]
async fn delete_key(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
) -> Result<bool, String> {
    state.delete_key(&server_id, &key).await
}

#[tauri::command]
async fn set_key_ttl(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    ttl: i64,
) -> Result<bool, String> {
    state.set_key_ttl(&server_id, &key, ttl).await
}

#[tauri::command]
async fn get_server_capabilities(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<ServerCapabilities, String> {
    state.get_server_capabilities(&server_id).await
}

#[tauri::command]
async fn check_operation_impact(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    operation: String,
    pattern: String,
) -> Result<PerformanceWarning, String> {
    state.check_operation_impact(&server_id, &operation, &pattern).await
}

#[tauri::command]
async fn execute_command(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    command: String,
) -> Result<CommandResult, String> {
    state.execute_command(&server_id, &command).await
}

#[tauri::command]
async fn set_string(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    value: String,
    ttl: Option<i64>,
) -> Result<bool, String> {
    state.set_string(&server_id, &key, &value, ttl).await
}

#[tauri::command]
async fn hash_set(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    field: String,
    value: String,
) -> Result<bool, String> {
    state.hash_set(&server_id, &key, &field, &value).await
}

#[tauri::command]
async fn hash_delete(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    field: String,
) -> Result<bool, String> {
    state.hash_delete(&server_id, &key, &field).await
}

#[tauri::command]
async fn list_push(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    value: String,
    position: String,
) -> Result<i64, String> {
    state.list_push(&server_id, &key, &value, &position).await
}

#[tauri::command]
async fn list_remove(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    index: i64,
) -> Result<bool, String> {
    state.list_remove(&server_id, &key, index).await
}

#[tauri::command]
async fn set_add(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    member: String,
) -> Result<bool, String> {
    state.set_add(&server_id, &key, &member).await
}

#[tauri::command]
async fn set_remove(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    member: String,
) -> Result<bool, String> {
    state.set_remove(&server_id, &key, &member).await
}

#[tauri::command]
async fn zset_add(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    score: f64,
    member: String,
) -> Result<bool, String> {
    state.zset_add(&server_id, &key, score, &member).await
}

#[tauri::command]
async fn zset_remove(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    key: String,
    member: String,
) -> Result<bool, String> {
    state.zset_remove(&server_id, &key, &member).await
}

#[tauri::command]
async fn bulk_delete(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    pattern: String,
) -> Result<BulkDeleteResult, String> {
    state.bulk_delete(&server_id, &pattern).await
}

#[tauri::command]
async fn analyze_database(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    sample_size: u32,
) -> Result<DatabaseAnalysis, String> {
    state.analyze_database(&server_id, sample_size).await
}

#[tauri::command]
async fn analyze_clients(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
) -> Result<ClientAnalysis, String> {
    state.analyze_clients(&server_id).await
}

#[tauri::command]
async fn rename_key(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    old_key: String,
    new_key: String,
) -> Result<bool, String> {
    state.rename_key(&server_id, &old_key, &new_key).await
}

#[tauri::command]
async fn copy_key(
    state: tauri::State<'_, Arc<RedisManager>>,
    server_id: String,
    source: String,
    dest: String,
) -> Result<bool, String> {
    state.copy_key(&server_id, &source, &dest).await
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
            get_memory_analytics,
            get_latency_analytics,
            get_slow_log,
            get_command_stats,
            encrypt_server_password,
            decrypt_server_password,
            scan_keys,
            get_key_value,
            delete_key,
            set_key_ttl,
            get_server_capabilities,
            check_operation_impact,
            execute_command,
            set_string,
            hash_set,
            hash_delete,
            list_push,
            list_remove,
            set_add,
            set_remove,
            zset_add,
            zset_remove,
            bulk_delete,
            analyze_database,
            analyze_clients,
            rename_key,
            copy_key,
        ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
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
