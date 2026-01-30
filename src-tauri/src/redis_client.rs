use crate::types::*;
use redis::aio::MultiplexedConnection;
use redis::Client;
use regex::Regex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

#[allow(dead_code)]
struct RedisConnection {
    client: Client,
    conn: MultiplexedConnection,
    server: RedisServer,
    monitor_stop: Arc<AtomicBool>,
}

pub struct RedisManager {
    connections: Arc<RwLock<HashMap<String, RedisConnection>>>,
    config_path: String,
}

impl RedisManager {
    pub fn new() -> Self {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("redis-tics");
        std::fs::create_dir_all(&config_dir).ok();
        let config_path = config_dir.join("servers.json").to_string_lossy().to_string();

        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            config_path,
        }
    }

    pub async fn get_servers(&self) -> Result<Vec<RedisServer>, String> {
        match std::fs::read_to_string(&self.config_path) {
            Ok(content) => serde_json::from_str(&content).map_err(|e| e.to_string()),
            Err(_) => Ok(Vec::new()),
        }
    }

    pub async fn save_servers(&self, servers: Vec<RedisServer>) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&servers).map_err(|e| e.to_string())?;
        std::fs::write(&self.config_path, content).map_err(|e| e.to_string())
    }

    pub async fn connect(&self, server: &RedisServer) -> Result<(), String> {
        let url = if let Some(ref password) = server.password {
            format!(
                "redis://:{}@{}:{}/{}",
                password,
                server.host,
                server.port,
                server.db.unwrap_or(0)
            )
        } else {
            format!(
                "redis://{}:{}/{}",
                server.host,
                server.port,
                server.db.unwrap_or(0)
            )
        };

        let client = Client::open(url).map_err(|e| format!("Failed to create client: {}", e))?;
        let conn = client
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| format!("Failed to connect: {}", e))?;

        let redis_conn = RedisConnection {
            client,
            conn,
            server: server.clone(),
            monitor_stop: Arc::new(AtomicBool::new(false)),
        };

        self.connections.write().await.insert(server.id.clone(), redis_conn);
        Ok(())
    }

    pub async fn disconnect(&self, server_id: &str) -> Result<(), String> {
        if let Some(conn) = self.connections.write().await.remove(server_id) {
            conn.monitor_stop.store(true, Ordering::SeqCst);
        }
        Ok(())
    }

    pub async fn get_info(&self, server_id: &str) -> Result<RedisInfo, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections
            .get_mut(server_id)
            .ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        parse_redis_info(&info_str)
    }

    pub async fn get_clients(&self, server_id: &str) -> Result<Vec<ClientInfo>, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections
            .get_mut(server_id)
            .ok_or("Server not connected")?;

        let client_list: String = redis::cmd("CLIENT")
            .arg("LIST")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(parse_client_list(&client_list))
    }

    pub async fn start_monitor(&self, server_id: &str, app: AppHandle) -> Result<(), String> {
        let (server, stop_flag) = {
            let connections = self.connections.read().await;
            let redis_conn = connections.get(server_id).ok_or("Server not connected")?;
            (redis_conn.server.clone(), redis_conn.monitor_stop.clone())
        };

        stop_flag.store(false, Ordering::SeqCst);

        let url = if let Some(ref password) = server.password {
            format!("redis://:{}@{}:{}", password, server.host, server.port)
        } else {
            format!("redis://{}:{}", server.host, server.port)
        };

        let client = Client::open(url).map_err(|e| e.to_string())?;

        tokio::spawn(async move {
            let monitor_regex = Regex::new(
                r#"(\d+\.\d+)\s+\[(\d+)\s+([^\]]+)\]\s+"([^"]+)"(.*)$"#
            ).unwrap();

            let mut pubsub = match client.get_multiplexed_async_connection().await {
                Ok(c) => c,
                Err(_) => return,
            };

            if redis::cmd("MONITOR")
                .query_async::<String>(&mut pubsub)
                .await
                .is_err()
            {
                return;
            }

            loop {
                if stop_flag.load(Ordering::SeqCst) {
                    break;
                }

                let result: Result<String, _> = redis::cmd("")
                    .query_async(&mut pubsub)
                    .await;

                match result {
                    Ok(line) => {
                        if let Some(event) = parse_monitor_line(&line, &monitor_regex) {
                            app.emit("redis-monitor", event).ok();
                        }
                    }
                    Err(_) => {
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn stop_monitor(&self, server_id: &str) -> Result<(), String> {
        let connections = self.connections.read().await;
        if let Some(redis_conn) = connections.get(server_id) {
            redis_conn.monitor_stop.store(true, Ordering::SeqCst);
        }
        Ok(())
    }

    pub async fn get_slow_log(&self, server_id: &str, count: u32) -> Result<Vec<SlowLogEntry>, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: Vec<redis::Value> = redis::cmd("SLOWLOG")
            .arg("GET")
            .arg(count)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(parse_slow_log(&result))
    }

    pub async fn get_memory_stats(&self, server_id: &str) -> Result<MemoryStats, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: Vec<redis::Value> = redis::cmd("MEMORY")
            .arg("STATS")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        parse_memory_stats(&result)
    }

    pub async fn get_memory_doctor(&self, server_id: &str) -> Result<String, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: String = redis::cmd("MEMORY")
            .arg("DOCTOR")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(result)
    }

    pub async fn get_command_stats(&self, server_id: &str) -> Result<Vec<CommandStat>, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .arg("commandstats")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(parse_command_stats(&info_str))
    }

    pub async fn get_cluster_info(&self, server_id: &str) -> Result<Option<ClusterInfo>, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .arg("cluster")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        if !info_str.contains("cluster_enabled:1") {
            return Ok(None);
        }

        let cluster_info: String = redis::cmd("CLUSTER")
            .arg("INFO")
            .query_async(&mut redis_conn.conn)
            .await
            .unwrap_or_default();

        Ok(Some(parse_cluster_info(&cluster_info)))
    }

    pub async fn get_cluster_nodes(&self, server_id: &str) -> Result<Vec<ClusterNode>, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let nodes_str: String = redis::cmd("CLUSTER")
            .arg("NODES")
            .query_async(&mut redis_conn.conn)
            .await
            .unwrap_or_default();

        Ok(parse_cluster_nodes(&nodes_str))
    }

    pub async fn get_persistence_info(&self, server_id: &str) -> Result<PersistenceInfo, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .arg("persistence")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(parse_persistence_info(&info_str))
    }

    pub async fn get_cpu_stats(&self, server_id: &str) -> Result<CpuStats, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .arg("cpu")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(parse_cpu_stats(&info_str))
    }

    pub async fn get_error_stats(&self, server_id: &str) -> Result<Vec<ErrorStat>, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .arg("errorstats")
            .query_async(&mut redis_conn.conn)
            .await
            .unwrap_or_default();

        Ok(parse_error_stats(&info_str))
    }

    pub async fn get_latency_doctor(&self, server_id: &str) -> Result<String, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: String = redis::cmd("LATENCY")
            .arg("DOCTOR")
            .query_async(&mut redis_conn.conn)
            .await
            .unwrap_or_else(|_| "Latency monitoring not enabled. Use CONFIG SET latency-monitor-threshold 100".to_string());

        Ok(result)
    }

    pub async fn get_advanced_analytics(&self, server_id: &str) -> Result<AdvancedAnalytics, String> {
        let memory_stats = self.get_memory_stats(server_id).await.ok();
        let memory_doctor = self.get_memory_doctor(server_id).await.ok();
        let slow_log = self.get_slow_log(server_id, 50).await.unwrap_or_default();
        let command_stats = self.get_command_stats(server_id).await.unwrap_or_default();
        let cluster_info = self.get_cluster_info(server_id).await.unwrap_or(None);
        let cluster_nodes = if cluster_info.is_some() {
            self.get_cluster_nodes(server_id).await.unwrap_or_default()
        } else {
            vec![]
        };
        let persistence = self.get_persistence_info(server_id).await.ok();
        let cpu_stats = self.get_cpu_stats(server_id).await.ok();
        let error_stats = self.get_error_stats(server_id).await.unwrap_or_default();
        let latency_doctor = self.get_latency_doctor(server_id).await.ok();

        Ok(AdvancedAnalytics {
            memory_stats,
            memory_doctor,
            slow_log,
            command_stats,
            cluster_info,
            cluster_nodes,
            persistence,
            cpu_stats,
            error_stats,
            latency_doctor,
        })
    }

    pub async fn scan_keys(&self, server_id: &str, pattern: &str, cursor: &str, count: u32) -> Result<KeyScanResult, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let pattern = if pattern.is_empty() { "*" } else { pattern };
        
        let (new_cursor, keys): (String, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(pattern)
            .arg("COUNT")
            .arg(count)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        let mut key_infos = Vec::new();
        for key in keys.iter().take(100) {
            if let Ok(info) = self.get_key_info_internal(&mut redis_conn.conn, key).await {
                key_infos.push(info);
            }
        }

        Ok(KeyScanResult {
            keys: key_infos,
            cursor: new_cursor.clone(),
            has_more: new_cursor != "0",
            total_scanned: count as u64,
        })
    }

    async fn get_key_info_internal(&self, conn: &mut MultiplexedConnection, key: &str) -> Result<KeyInfo, String> {
        let key_type: String = redis::cmd("TYPE")
            .arg(key)
            .query_async(conn)
            .await
            .unwrap_or_else(|_| "unknown".to_string());

        let ttl: i64 = redis::cmd("TTL")
            .arg(key)
            .query_async(conn)
            .await
            .unwrap_or(-1);

        let size: Option<u64> = redis::cmd("MEMORY")
            .arg("USAGE")
            .arg(key)
            .arg("SAMPLES")
            .arg(0)
            .query_async(conn)
            .await
            .ok();

        let encoding: Option<String> = redis::cmd("OBJECT")
            .arg("ENCODING")
            .arg(key)
            .query_async(conn)
            .await
            .ok();

        Ok(KeyInfo {
            key: key.to_string(),
            key_type,
            ttl,
            size,
            encoding,
        })
    }

    pub async fn get_key_value(&self, server_id: &str, key: &str) -> Result<KeyValue, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let key_type: String = redis::cmd("TYPE")
            .arg(key)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        let ttl: i64 = redis::cmd("TTL")
            .arg(key)
            .query_async(&mut redis_conn.conn)
            .await
            .unwrap_or(-1);

        let size: Option<u64> = redis::cmd("MEMORY")
            .arg("USAGE")
            .arg(key)
            .query_async(&mut redis_conn.conn)
            .await
            .ok();

        let value = match key_type.as_str() {
            "string" => {
                let v: String = redis::cmd("GET")
                    .arg(key)
                    .query_async(&mut redis_conn.conn)
                    .await
                    .unwrap_or_default();
                KeyValueData::String(v)
            }
            "list" => {
                let v: Vec<String> = redis::cmd("LRANGE")
                    .arg(key)
                    .arg(0)
                    .arg(999)
                    .query_async(&mut redis_conn.conn)
                    .await
                    .unwrap_or_default();
                KeyValueData::List(v)
            }
            "set" => {
                let v: Vec<String> = redis::cmd("SMEMBERS")
                    .arg(key)
                    .query_async(&mut redis_conn.conn)
                    .await
                    .unwrap_or_default();
                KeyValueData::Set(v)
            }
            "zset" => {
                let v: Vec<(String, f64)> = redis::cmd("ZRANGE")
                    .arg(key)
                    .arg(0)
                    .arg(999)
                    .arg("WITHSCORES")
                    .query_async(&mut redis_conn.conn)
                    .await
                    .unwrap_or_default();
                KeyValueData::ZSet(v.into_iter().map(|(member, score)| ZSetMember { member, score }).collect())
            }
            "hash" => {
                let v: HashMap<String, String> = redis::cmd("HGETALL")
                    .arg(key)
                    .query_async(&mut redis_conn.conn)
                    .await
                    .unwrap_or_default();
                KeyValueData::Hash(v)
            }
            "stream" => {
                let entries: Vec<redis::Value> = redis::cmd("XRANGE")
                    .arg(key)
                    .arg("-")
                    .arg("+")
                    .arg("COUNT")
                    .arg(100)
                    .query_async(&mut redis_conn.conn)
                    .await
                    .unwrap_or_default();
                KeyValueData::Stream(parse_stream_entries(&entries))
            }
            _ => KeyValueData::Unknown(format!("Type '{}' not supported for viewing", key_type)),
        };

        Ok(KeyValue {
            key: key.to_string(),
            key_type,
            ttl,
            value,
            size,
        })
    }

    pub async fn get_server_capabilities(&self, server_id: &str) -> Result<ServerCapabilities, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let info_str: String = redis::cmd("INFO")
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        let mut map: HashMap<String, String> = HashMap::new();
        let mut total_keys: u64 = 0;
        
        for line in info_str.lines() {
            if line.starts_with('#') || line.is_empty() {
                continue;
            }
            if let Some((key, value)) = line.split_once(':') {
                if key.starts_with("db") {
                    if let Some(keys_str) = value.split(',').next() {
                        if let Some(k) = keys_str.strip_prefix("keys=") {
                            total_keys += k.parse::<u64>().unwrap_or(0);
                        }
                    }
                }
                map.insert(key.to_string(), value.to_string());
            }
        }

        let version = map.get("redis_version").cloned().unwrap_or_default();
        let server_name = map.get("redis_git_sha1")
            .or_else(|| map.get("server_name"))
            .cloned()
            .unwrap_or_default();
        
        let server_type = if version.to_lowercase().contains("valkey") 
            || server_name.to_lowercase().contains("valkey")
            || map.get("redis_version").map(|v| v.starts_with("7.2.") || v.starts_with("8.")).unwrap_or(false) 
                && map.get("os").map(|o| o.contains("valkey")).unwrap_or(false) {
            "Valkey".to_string()
        } else {
            "Redis".to_string()
        };

        let cluster_enabled_info = map.get("cluster_enabled").map(|v| v == "1").unwrap_or(false);
        
        let cluster_info_result: Result<String, _> = redis::cmd("CLUSTER")
            .arg("INFO")
            .query_async(&mut redis_conn.conn)
            .await;
        
        let (cluster_enabled, cluster_mode) = match cluster_info_result {
            Ok(info) => {
                let state = info.lines()
                    .find(|l| l.starts_with("cluster_state:"))
                    .and_then(|l| l.split(':').nth(1))
                    .unwrap_or("unknown");
                (true, format!("enabled ({})", state))
            }
            Err(e) => {
                let err_str = e.to_string().to_lowercase();
                if err_str.contains("cluster") && err_str.contains("disabled") {
                    (false, "disabled".to_string())
                } else if cluster_enabled_info {
                    (true, "enabled (connection may be to a node)".to_string())
                } else {
                    (false, "standalone".to_string())
                }
            }
        };

        let role = map.get("role").cloned().unwrap_or_else(|| "master".to_string());
        let is_read_replica = role == "slave" || role == "replica";

        let supports_memory = redis::cmd("MEMORY")
            .arg("DOCTOR")
            .query_async::<String>(&mut redis_conn.conn)
            .await
            .is_ok();

        let supports_latency = redis::cmd("LATENCY")
            .arg("DOCTOR")
            .query_async::<String>(&mut redis_conn.conn)
            .await
            .is_ok();

        let max_clients = map.get("maxclients")
            .and_then(|v| v.parse().ok())
            .unwrap_or(10000);

        Ok(ServerCapabilities {
            server_type,
            version,
            cluster_enabled,
            cluster_mode,
            supports_memory_commands: supports_memory,
            supports_latency_commands: supports_latency,
            supports_module_commands: true,
            is_read_replica,
            max_clients,
            total_keys,
        })
    }

    pub async fn check_operation_impact(&self, server_id: &str, operation: &str, pattern: &str) -> Result<PerformanceWarning, String> {
        let capabilities = self.get_server_capabilities(server_id).await?;
        
        let (level, message, estimated_impact) = match operation {
            "KEYS" => {
                if capabilities.total_keys > 10000 {
                    ("critical", 
                     format!("KEYS command will scan {} keys and block Redis. Use SCAN instead.", capabilities.total_keys),
                     "High - Server will be unresponsive during execution")
                } else if capabilities.total_keys > 1000 {
                    ("warning",
                     format!("KEYS will scan {} keys. Consider using SCAN for production.", capabilities.total_keys),
                     "Medium - Brief latency spike expected")
                } else {
                    ("info",
                     "KEYS command is safe for small datasets.".to_string(),
                     "Low - Minimal impact expected")
                }
            }
            "SCAN" => {
                ("info",
                 "SCAN is production-safe. It iterates incrementally without blocking.".to_string(),
                 "Minimal - Non-blocking cursor-based iteration")
            }
            "SMEMBERS" | "HGETALL" | "LRANGE" => {
                ("warning",
                 format!("{} fetches all elements. For large collections, consider pagination.", operation),
                 "Variable - Depends on collection size")
            }
            "FLUSHDB" | "FLUSHALL" => {
                ("critical",
                 "This operation will DELETE ALL DATA. Cannot be undone!".to_string(),
                 "Critical - All data will be lost")
            }
            "DEBUG" => {
                ("critical",
                 "DEBUG commands can crash or hang the server.".to_string(),
                 "Critical - May cause server instability")
            }
            _ => {
                ("info",
                 format!("{} operation", operation),
                 "Unknown - Check Redis documentation")
            }
        };

        Ok(PerformanceWarning {
            level: level.to_string(),
            message: message.to_string(),
            command: format!("{} {}", operation, pattern),
            estimated_impact: estimated_impact.to_string(),
        })
    }

    pub async fn delete_key(&self, server_id: &str, key: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("DEL")
            .arg(key)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;

        Ok(result > 0)
    }

    pub async fn set_key_ttl(&self, server_id: &str, key: &str, ttl: i64) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = if ttl < 0 {
            redis::cmd("PERSIST")
                .arg(key)
                .query_async(&mut redis_conn.conn)
                .await
                .map_err(|e| e.to_string())?
        } else {
            redis::cmd("EXPIRE")
                .arg(key)
                .arg(ttl)
                .query_async(&mut redis_conn.conn)
                .await
                .map_err(|e| e.to_string())?
        };

        Ok(result > 0)
    }

    pub async fn execute_command(&self, server_id: &str, command: &str) -> Result<CommandResult, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Err("Empty command".to_string());
        }

        let start = std::time::Instant::now();
        let mut cmd = redis::cmd(parts[0]);
        for arg in &parts[1..] {
            cmd.arg(*arg);
        }

        let result: Result<redis::Value, _> = cmd.query_async(&mut redis_conn.conn).await;
        let execution_time_ms = start.elapsed().as_millis() as u64;

        match result {
            Ok(value) => Ok(CommandResult {
                success: true,
                result: format_redis_value(&value),
                execution_time_ms,
                error: None,
            }),
            Err(e) => Ok(CommandResult {
                success: false,
                result: String::new(),
                execution_time_ms,
                error: Some(e.to_string()),
            }),
        }
    }

    pub async fn set_string(&self, server_id: &str, key: &str, value: &str, ttl: Option<i64>) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let mut cmd = redis::cmd("SET");
        cmd.arg(key).arg(value);
        if let Some(t) = ttl {
            if t > 0 {
                cmd.arg("EX").arg(t);
            }
        }

        let _: String = cmd.query_async(&mut redis_conn.conn).await.map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub async fn hash_set(&self, server_id: &str, key: &str, field: &str, value: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let _: i64 = redis::cmd("HSET")
            .arg(key).arg(field).arg(value)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub async fn hash_delete(&self, server_id: &str, key: &str, field: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("HDEL")
            .arg(key).arg(field)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result > 0)
    }

    pub async fn list_push(&self, server_id: &str, key: &str, value: &str, position: &str) -> Result<i64, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let cmd = if position == "left" { "LPUSH" } else { "RPUSH" };
        let result: i64 = redis::cmd(cmd)
            .arg(key).arg(value)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    pub async fn list_remove(&self, server_id: &str, key: &str, index: i64) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let placeholder = "__DELETED__";
        let _: () = redis::cmd("LSET")
            .arg(key).arg(index).arg(placeholder)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        let _: i64 = redis::cmd("LREM")
            .arg(key).arg(1).arg(placeholder)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub async fn set_add(&self, server_id: &str, key: &str, member: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("SADD")
            .arg(key).arg(member)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result > 0)
    }

    pub async fn set_remove(&self, server_id: &str, key: &str, member: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("SREM")
            .arg(key).arg(member)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result > 0)
    }

    pub async fn zset_add(&self, server_id: &str, key: &str, score: f64, member: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("ZADD")
            .arg(key).arg(score).arg(member)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result >= 0)
    }

    pub async fn zset_remove(&self, server_id: &str, key: &str, member: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("ZREM")
            .arg(key).arg(member)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result > 0)
    }

    pub async fn bulk_delete(&self, server_id: &str, pattern: &str) -> Result<BulkDeleteResult, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let start = std::time::Instant::now();
        let mut deleted_count = 0u64;
        let mut failed_count = 0u64;
        let mut errors = Vec::new();
        let mut cursor = "0".to_string();

        loop {
            let (new_cursor, keys): (String, Vec<String>) = redis::cmd("SCAN")
                .arg(&cursor)
                .arg("MATCH").arg(pattern)
                .arg("COUNT").arg(100)
                .query_async(&mut redis_conn.conn)
                .await
                .map_err(|e| e.to_string())?;

            for key in keys {
                match redis::cmd("DEL").arg(&key).query_async::<i64>(&mut redis_conn.conn).await {
                    Ok(n) => deleted_count += n as u64,
                    Err(e) => {
                        failed_count += 1;
                        if errors.len() < 10 {
                            errors.push(format!("{}: {}", key, e));
                        }
                    }
                }
            }

            cursor = new_cursor;
            if cursor == "0" {
                break;
            }
        }

        Ok(BulkDeleteResult {
            deleted_count,
            failed_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
            errors,
        })
    }

    pub async fn analyze_database(&self, server_id: &str, sample_size: u32) -> Result<DatabaseAnalysis, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let mut type_counts: HashMap<String, u64> = HashMap::new();
        let mut type_memory: HashMap<String, u64> = HashMap::new();
        let mut namespaces: HashMap<String, (u64, u64)> = HashMap::new();
        let mut top_keys: Vec<KeyMemoryInfo> = Vec::new();
        let mut keys_with_ttl = 0u64;
        let mut keys_without_ttl = 0u64;
        let mut expiring_1h = 0u64;
        let mut expiring_24h = 0u64;
        let mut expiring_7d = 0u64;
        let mut memory_1h = 0u64;
        let mut memory_24h = 0u64;
        let mut total_memory = 0u64;
        let mut cursor = "0".to_string();
        let mut sampled = 0u32;

        while sampled < sample_size {
            let (new_cursor, keys): (String, Vec<String>) = redis::cmd("SCAN")
                .arg(&cursor)
                .arg("COUNT").arg(100)
                .query_async(&mut redis_conn.conn)
                .await
                .map_err(|e| e.to_string())?;

            for key in keys {
                if sampled >= sample_size { break; }
                sampled += 1;

                let key_type: String = redis::cmd("TYPE").arg(&key)
                    .query_async(&mut redis_conn.conn).await.unwrap_or_else(|_| "unknown".to_string());

                let ttl: i64 = redis::cmd("TTL").arg(&key)
                    .query_async(&mut redis_conn.conn).await.unwrap_or(-1);

                let mem: u64 = redis::cmd("MEMORY").arg("USAGE").arg(&key).arg("SAMPLES").arg(0)
                    .query_async(&mut redis_conn.conn).await.unwrap_or(0);

                *type_counts.entry(key_type.clone()).or_insert(0) += 1;
                *type_memory.entry(key_type.clone()).or_insert(0) += mem;
                total_memory += mem;

                if ttl > 0 {
                    keys_with_ttl += 1;
                    if ttl <= 3600 { expiring_1h += 1; memory_1h += mem; }
                    if ttl <= 86400 { expiring_24h += 1; memory_24h += mem; }
                    if ttl <= 604800 { expiring_7d += 1; }
                } else {
                    keys_without_ttl += 1;
                }

                let ns = key.split(':').next().unwrap_or(&key).to_string();
                let entry = namespaces.entry(ns).or_insert((0, 0));
                entry.0 += 1;
                entry.1 += mem;

                top_keys.push(KeyMemoryInfo { key: key.clone(), key_type, memory_bytes: mem, ttl });
            }

            cursor = new_cursor;
            if cursor == "0" { break; }
        }

        top_keys.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
        top_keys.truncate(20);

        let total_keys = sampled as u64;
        let type_distribution: Vec<TypeDistribution> = type_counts.iter()
            .map(|(t, c)| TypeDistribution {
                key_type: t.clone(),
                count: *c,
                percentage: if total_keys > 0 { (*c as f64 / total_keys as f64) * 100.0 } else { 0.0 },
            }).collect();

        let memory_by_type: Vec<TypeMemory> = type_memory.iter()
            .map(|(t, m)| TypeMemory {
                key_type: t.clone(),
                memory_bytes: *m,
                percentage: if total_memory > 0 { (*m as f64 / total_memory as f64) * 100.0 } else { 0.0 },
            }).collect();

        let mut ns_vec: Vec<NamespaceInfo> = namespaces.iter()
            .map(|(n, (c, m))| NamespaceInfo { namespace: n.clone(), key_count: *c, memory_bytes: *m })
            .collect();
        ns_vec.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
        ns_vec.truncate(20);

        let mut recommendations = Vec::new();
        if keys_without_ttl > keys_with_ttl {
            recommendations.push("Consider setting TTL on keys to prevent memory growth".to_string());
        }
        if let Some(top) = top_keys.first() {
            if top.memory_bytes > 1024 * 1024 {
                recommendations.push(format!("Large key detected: {} ({} MB)", top.key, top.memory_bytes / (1024 * 1024)));
            }
        }

        Ok(DatabaseAnalysis {
            total_keys,
            total_memory,
            type_distribution,
            memory_by_type,
            expiry_analysis: ExpiryAnalysis {
                keys_with_ttl,
                keys_without_ttl,
                expiring_in_1h: expiring_1h,
                expiring_in_24h: expiring_24h,
                expiring_in_7d: expiring_7d,
                memory_to_free_1h: memory_1h,
                memory_to_free_24h: memory_24h,
            },
            top_keys_by_memory: top_keys,
            namespaces: ns_vec,
            recommendations,
        })
    }

    pub async fn analyze_clients(&self, server_id: &str) -> Result<ClientAnalysis, String> {
        let clients = self.get_clients(server_id).await?;
        
        let mut idle_clients = Vec::new();
        let mut high_memory_clients = Vec::new();
        let mut command_map: HashMap<String, Vec<String>> = HashMap::new();
        let mut suspicious_patterns = Vec::new();
        let mut anomalies = Vec::new();

        let mut connect_only = Vec::new();
        let mut high_idle = Vec::new();

        for client in &clients {
            if client.idle > 300 {
                idle_clients.push(IdleClient {
                    id: client.id.clone(),
                    addr: client.addr.clone(),
                    idle_seconds: client.idle,
                    last_command: client.cmd.clone(),
                    connected_seconds: client.age,
                });
                high_idle.push(client.addr.clone());
            }

            if client.qbuf > 1024 * 1024 || client.obl > 1024 * 1024 {
                high_memory_clients.push(ClientMemoryInfo {
                    id: client.id.clone(),
                    addr: client.addr.clone(),
                    output_buffer_bytes: client.obl,
                    query_buffer_bytes: client.qbuf,
                });
            }

            command_map.entry(client.cmd.clone()).or_default().push(client.ip.clone());

            if client.cmd == "NULL" || client.cmd.is_empty() {
                connect_only.push(client.addr.clone());
            }

            if client.age > 0 && client.idle as f64 / client.age as f64 > 0.95 {
                anomalies.push(ClientAnomaly {
                    anomaly_type: "Mostly Idle".to_string(),
                    client_addr: client.addr.clone(),
                    details: format!("Client idle {}% of connection time", (client.idle as f64 / client.age as f64 * 100.0) as u32),
                    severity: "warning".to_string(),
                });
            }
        }

        if !connect_only.is_empty() {
            suspicious_patterns.push(SuspiciousPattern {
                pattern_type: "Connect Only".to_string(),
                severity: "warning".to_string(),
                description: format!("{} clients connected but never executed commands", connect_only.len()),
                affected_clients: connect_only.iter().take(10).cloned().collect(),
                recommendation: "Check if these are health checks or misconfigured clients".to_string(),
            });
        }

        if high_idle.len() > clients.len() / 2 && clients.len() > 5 {
            suspicious_patterns.push(SuspiciousPattern {
                pattern_type: "High Idle Rate".to_string(),
                severity: "warning".to_string(),
                description: format!("{}% of clients are idle for >5 minutes", (high_idle.len() * 100) / clients.len()),
                affected_clients: high_idle.iter().take(10).cloned().collect(),
                recommendation: "Consider connection pooling or reducing idle timeout".to_string(),
            });
        }

        let clients_by_command: Vec<CommandClientInfo> = command_map.iter()
            .map(|(cmd, ips)| CommandClientInfo {
                command: cmd.clone(),
                client_count: ips.len() as u64,
                client_ips: ips.iter().take(10).cloned().collect(),
            })
            .collect();

        Ok(ClientAnalysis {
            total_clients: clients.len() as u64,
            idle_clients,
            high_memory_clients,
            clients_by_command,
            suspicious_patterns,
            anomalies,
        })
    }

    pub async fn rename_key(&self, server_id: &str, old_key: &str, new_key: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let _: () = redis::cmd("RENAME")
            .arg(old_key).arg(new_key)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub async fn copy_key(&self, server_id: &str, source: &str, dest: &str) -> Result<bool, String> {
        let mut connections = self.connections.write().await;
        let redis_conn = connections.get_mut(server_id).ok_or("Server not connected")?;

        let result: i64 = redis::cmd("COPY")
            .arg(source).arg(dest)
            .query_async(&mut redis_conn.conn)
            .await
            .map_err(|e| e.to_string())?;
        Ok(result > 0)
    }
}

fn format_redis_value(value: &redis::Value) -> String {
    match value {
        redis::Value::Nil => "(nil)".to_string(),
        redis::Value::Int(i) => format!("(integer) {}", i),
        redis::Value::BulkString(s) => String::from_utf8_lossy(s).to_string(),
        redis::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().enumerate()
                .map(|(i, v)| format!("{}) {}", i + 1, format_redis_value(v)))
                .collect();
            items.join("\n")
        }
        redis::Value::SimpleString(s) => s.clone(),
        redis::Value::Okay => "OK".to_string(),
        redis::Value::Map(map) => {
            let items: Vec<String> = map.iter()
                .map(|(k, v)| format!("{}: {}", format_redis_value(k), format_redis_value(v)))
                .collect();
            items.join("\n")
        }
        redis::Value::Set(set) => {
            let items: Vec<String> = set.iter()
                .map(|v| format_redis_value(v))
                .collect();
            items.join("\n")
        }
        redis::Value::Double(d) => format!("(double) {}", d),
        redis::Value::Boolean(b) => format!("(boolean) {}", b),
        redis::Value::VerbatimString { format: _, text } => text.clone(),
        redis::Value::BigNumber(n) => format!("(big number) {}", n),
        redis::Value::Push { kind: _, data } => {
            let items: Vec<String> = data.iter().map(|v| format_redis_value(v)).collect();
            items.join("\n")
        }
        redis::Value::ServerError(e) => format!("(error) {}", e.details().unwrap_or("Unknown error")),
        redis::Value::Attribute { data, attributes: _ } => format_redis_value(data),
    }
}

fn parse_stream_entries(entries: &[redis::Value]) -> Vec<StreamEntry> {
    entries.iter().filter_map(|entry| {
        if let redis::Value::Array(parts) = entry {
            let id = match parts.get(0) {
                Some(redis::Value::BulkString(s)) => String::from_utf8_lossy(s).to_string(),
                _ => return None,
            };
            let fields = match parts.get(1) {
                Some(redis::Value::Array(field_values)) => {
                    let mut map = HashMap::new();
                    let mut iter = field_values.iter();
                    while let (Some(k), Some(v)) = (iter.next(), iter.next()) {
                        if let (redis::Value::BulkString(key), redis::Value::BulkString(val)) = (k, v) {
                            map.insert(
                                String::from_utf8_lossy(key).to_string(),
                                String::from_utf8_lossy(val).to_string(),
                            );
                        }
                    }
                    map
                }
                _ => HashMap::new(),
            };
            Some(StreamEntry { id, fields })
        } else {
            None
        }
    }).collect()
}

fn parse_redis_info(info: &str) -> Result<RedisInfo, String> {
    let mut map: HashMap<String, String> = HashMap::new();
    let mut keyspace: HashMap<String, KeyspaceDbInfo> = HashMap::new();

    for line in info.lines() {
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if let Some((key, value)) = line.split_once(':') {
            if key.starts_with("db") {
                if let Some(db_info) = parse_keyspace_db(value) {
                    keyspace.insert(key.to_string(), db_info);
                }
            } else {
                map.insert(key.to_string(), value.to_string());
            }
        }
    }

    let get_str = |key: &str| map.get(key).cloned().unwrap_or_default();
    let get_u64 = |key: &str| map.get(key).and_then(|v| v.parse().ok()).unwrap_or(0);
    let get_f64 = |key: &str| map.get(key).and_then(|v| v.parse().ok()).unwrap_or(0.0);

    Ok(RedisInfo {
        server: ServerInfo {
            redis_version: get_str("redis_version"),
            os: get_str("os"),
            uptime_in_seconds: get_u64("uptime_in_seconds"),
            connected_clients: get_u64("connected_clients"),
            tcp_port: get_u64("tcp_port") as u16,
        },
        memory: MemoryInfo {
            used_memory: get_u64("used_memory"),
            used_memory_human: get_str("used_memory_human"),
            used_memory_peak: get_u64("used_memory_peak"),
            used_memory_peak_human: get_str("used_memory_peak_human"),
            maxmemory: get_u64("maxmemory"),
            maxmemory_human: get_str("maxmemory_human"),
            mem_fragmentation_ratio: get_f64("mem_fragmentation_ratio"),
        },
        stats: StatsInfo {
            total_connections_received: get_u64("total_connections_received"),
            total_commands_processed: get_u64("total_commands_processed"),
            instantaneous_ops_per_sec: get_u64("instantaneous_ops_per_sec"),
            keyspace_hits: get_u64("keyspace_hits"),
            keyspace_misses: get_u64("keyspace_misses"),
            expired_keys: get_u64("expired_keys"),
            evicted_keys: get_u64("evicted_keys"),
        },
        replication: ReplicationInfo {
            role: get_str("role"),
            connected_slaves: get_u64("connected_slaves"),
            master_host: map.get("master_host").cloned(),
            master_port: map.get("master_port").and_then(|v| v.parse().ok()),
            master_link_status: map.get("master_link_status").cloned(),
        },
        keyspace,
    })
}

fn parse_keyspace_db(value: &str) -> Option<KeyspaceDbInfo> {
    let mut keys = 0u64;
    let mut expires = 0u64;
    let mut avg_ttl = 0u64;

    for part in value.split(',') {
        if let Some((k, v)) = part.split_once('=') {
            match k {
                "keys" => keys = v.parse().unwrap_or(0),
                "expires" => expires = v.parse().unwrap_or(0),
                "avg_ttl" => avg_ttl = v.parse().unwrap_or(0),
                _ => {}
            }
        }
    }

    Some(KeyspaceDbInfo { keys, expires, avg_ttl })
}

fn parse_client_list(list: &str) -> Vec<ClientInfo> {
    list.lines()
        .filter_map(|line| {
            let mut map: HashMap<&str, &str> = HashMap::new();
            for part in line.split_whitespace() {
                if let Some((k, v)) = part.split_once('=') {
                    map.insert(k, v);
                }
            }

            let addr = map.get("addr")?.to_string();
            let (ip, port) = addr.split_once(':')?;

            Some(ClientInfo {
                id: map.get("id").unwrap_or(&"").to_string(),
                addr: addr.clone(),
                ip: ip.to_string(),
                port: port.to_string(),
                name: map.get("name").filter(|n| !n.is_empty()).map(|s| s.to_string()),
                age: map.get("age").and_then(|v| v.parse().ok()).unwrap_or(0),
                idle: map.get("idle").and_then(|v| v.parse().ok()).unwrap_or(0),
                flags: map.get("flags").unwrap_or(&"").to_string(),
                db: map.get("db").and_then(|v| v.parse().ok()).unwrap_or(0),
                cmd: map.get("cmd").unwrap_or(&"").to_string(),
                qbuf: map.get("qbuf").and_then(|v| v.parse().ok()).unwrap_or(0),
                obl: map.get("obl").and_then(|v| v.parse().ok()).unwrap_or(0),
                oll: map.get("oll").and_then(|v| v.parse().ok()).unwrap_or(0),
            })
        })
        .collect()
}

fn parse_monitor_line(line: &str, regex: &Regex) -> Option<MonitorEvent> {
    let caps = regex.captures(line)?;

    let timestamp = caps.get(1)?.as_str().parse::<f64>().ok()?;
    let db = caps.get(2)?.as_str().parse::<u8>().ok()?;
    let client_addr = caps.get(3)?.as_str();
    let command = caps.get(4)?.as_str().to_uppercase();
    let args_str = caps.get(5).map(|m| m.as_str()).unwrap_or("");

    let (client_ip, client_port) = if client_addr.contains(':') {
        let parts: Vec<&str> = client_addr.rsplitn(2, ':').collect();
        (parts.get(1).unwrap_or(&"").to_string(), parts.get(0).unwrap_or(&"").to_string())
    } else {
        (client_addr.to_string(), "0".to_string())
    };

    let args: Vec<String> = args_str
        .split('"')
        .enumerate()
        .filter(|(i, s)| i % 2 == 1 && !s.is_empty())
        .map(|(_, s)| s.to_string())
        .collect();

    Some(MonitorEvent {
        timestamp: (timestamp * 1000.0) as u64,
        client_ip,
        client_port,
        db,
        command,
        args,
        raw: line.to_string(),
    })
}

fn parse_slow_log(entries: &[redis::Value]) -> Vec<SlowLogEntry> {
    entries.iter().filter_map(|entry| {
        if let redis::Value::Array(parts) = entry {
            let id = match parts.get(0) {
                Some(redis::Value::Int(i)) => *i as u64,
                _ => return None,
            };
            let timestamp = match parts.get(1) {
                Some(redis::Value::Int(i)) => *i as u64,
                _ => return None,
            };
            let duration_us = match parts.get(2) {
                Some(redis::Value::Int(i)) => *i as u64,
                _ => return None,
            };
            let (command, args) = match parts.get(3) {
                Some(redis::Value::Array(cmd_parts)) => {
                    let cmd = cmd_parts.first().and_then(|v| {
                        if let redis::Value::BulkString(s) = v {
                            String::from_utf8(s.clone()).ok()
                        } else { None }
                    }).unwrap_or_default();
                    let args: Vec<String> = cmd_parts.iter().skip(1).filter_map(|v| {
                        if let redis::Value::BulkString(s) = v {
                            String::from_utf8(s.clone()).ok()
                        } else { None }
                    }).collect();
                    (cmd, args)
                }
                _ => return None,
            };
            let client_addr = parts.get(4).and_then(|v| {
                if let redis::Value::BulkString(s) = v {
                    String::from_utf8(s.clone()).ok()
                } else { None }
            });
            let client_name = parts.get(5).and_then(|v| {
                if let redis::Value::BulkString(s) = v {
                    let name = String::from_utf8(s.clone()).ok();
                    name.filter(|n| !n.is_empty())
                } else { None }
            });

            Some(SlowLogEntry { id, timestamp, duration_us, command, args, client_addr, client_name })
        } else { None }
    }).collect()
}

fn parse_memory_stats(values: &[redis::Value]) -> Result<MemoryStats, String> {
    let mut map: HashMap<String, i64> = HashMap::new();
    let mut iter = values.iter();
    
    while let Some(key) = iter.next() {
        if let redis::Value::BulkString(k) = key {
            let key_str = String::from_utf8_lossy(k).to_string();
            if let Some(val) = iter.next() {
                match val {
                    redis::Value::Int(i) => { map.insert(key_str, *i); }
                    redis::Value::BulkString(s) => {
                        if let Ok(i) = String::from_utf8_lossy(s).parse::<i64>() {
                            map.insert(key_str, i);
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    let get = |k: &str| map.get(k).copied().unwrap_or(0) as u64;
    let get_f = |k: &str| map.get(k).copied().unwrap_or(0) as f64;

    Ok(MemoryStats {
        peak_allocated: get("peak.allocated"),
        total_allocated: get("total.allocated"),
        startup_allocated: get("startup.allocated"),
        replication_backlog: get("replication.backlog"),
        clients_slaves: get("clients.slaves"),
        clients_normal: get("clients.normal"),
        aof_buffer: get("aof.buffer"),
        lua_caches: get("lua.caches"),
        db_hashtable_overhead: get("db.hashtable-overhead") + get("overhead.hashtable.main") + get("overhead.hashtable.expires"),
        keys_count: get("keys.count"),
        keys_bytes_per_key: get("keys.bytes-per-key"),
        dataset_bytes: get("dataset.bytes"),
        dataset_percentage: get_f("dataset.percentage"),
        peak_percentage: get_f("peak.percentage"),
        fragmentation_ratio: get_f("fragmentation"),
    })
}

fn parse_command_stats(info: &str) -> Vec<CommandStat> {
    info.lines()
        .filter(|l| l.starts_with("cmdstat_"))
        .filter_map(|line| {
            let (cmd_part, stats_part) = line.split_once(':')?;
            let command = cmd_part.strip_prefix("cmdstat_")?.to_uppercase();
            
            let mut calls = 0u64;
            let mut usec = 0u64;
            let mut usec_per_call = 0.0f64;
            let mut rejected_calls = 0u64;
            let mut failed_calls = 0u64;

            for part in stats_part.split(',') {
                if let Some((k, v)) = part.split_once('=') {
                    match k.trim() {
                        "calls" => calls = v.parse().unwrap_or(0),
                        "usec" => usec = v.parse().unwrap_or(0),
                        "usec_per_call" => usec_per_call = v.parse().unwrap_or(0.0),
                        "rejected_calls" => rejected_calls = v.parse().unwrap_or(0),
                        "failed_calls" => failed_calls = v.parse().unwrap_or(0),
                        _ => {}
                    }
                }
            }

            Some(CommandStat { command, calls, usec, usec_per_call, rejected_calls, failed_calls })
        })
        .collect()
}

fn parse_cluster_info(info: &str) -> ClusterInfo {
    let mut map: HashMap<String, String> = HashMap::new();
    for line in info.lines() {
        if let Some((k, v)) = line.split_once(':') {
            map.insert(k.to_string(), v.to_string());
        }
    }

    let get_str = |k: &str| map.get(k).cloned().unwrap_or_default();
    let get_u64 = |k: &str| map.get(k).and_then(|v| v.parse().ok()).unwrap_or(0);

    ClusterInfo {
        cluster_enabled: true,
        cluster_state: get_str("cluster_state"),
        cluster_slots_assigned: get_u64("cluster_slots_assigned"),
        cluster_slots_ok: get_u64("cluster_slots_ok"),
        cluster_slots_pfail: get_u64("cluster_slots_pfail"),
        cluster_slots_fail: get_u64("cluster_slots_fail"),
        cluster_known_nodes: get_u64("cluster_known_nodes"),
        cluster_size: get_u64("cluster_size"),
        cluster_current_epoch: get_u64("cluster_current_epoch"),
        cluster_my_epoch: get_u64("cluster_my_epoch"),
    }
}

fn parse_cluster_nodes(nodes: &str) -> Vec<ClusterNode> {
    nodes.lines().filter_map(|line| {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 8 { return None; }

        Some(ClusterNode {
            id: parts[0].to_string(),
            addr: parts[1].to_string(),
            flags: parts[2].to_string(),
            master_id: if parts[3] == "-" { None } else { Some(parts[3].to_string()) },
            ping_sent: parts[4].parse().unwrap_or(0),
            pong_recv: parts[5].parse().unwrap_or(0),
            config_epoch: parts[6].parse().unwrap_or(0),
            link_state: parts[7].to_string(),
            slots: parts.get(8..).map(|s| s.iter().map(|x| x.to_string()).collect()).unwrap_or_default(),
        })
    }).collect()
}

fn parse_persistence_info(info: &str) -> PersistenceInfo {
    let mut map: HashMap<String, String> = HashMap::new();
    for line in info.lines() {
        if let Some((k, v)) = line.split_once(':') {
            map.insert(k.to_string(), v.to_string());
        }
    }

    let get_str = |k: &str| map.get(k).cloned().unwrap_or_default();
    let get_u64 = |k: &str| map.get(k).and_then(|v| v.parse().ok()).unwrap_or(0);
    let get_i64 = |k: &str| map.get(k).and_then(|v| v.parse().ok()).unwrap_or(-1);
    let get_bool = |k: &str| map.get(k).map(|v| v == "1").unwrap_or(false);

    PersistenceInfo {
        rdb_last_save_time: get_u64("rdb_last_save_time"),
        rdb_changes_since_last_save: get_u64("rdb_changes_since_last_save"),
        rdb_bgsave_in_progress: get_bool("rdb_bgsave_in_progress"),
        rdb_last_bgsave_status: get_str("rdb_last_bgsave_status"),
        rdb_last_bgsave_time_sec: get_i64("rdb_last_bgsave_time_sec"),
        aof_enabled: get_bool("aof_enabled"),
        aof_rewrite_in_progress: get_bool("aof_rewrite_in_progress"),
        aof_last_rewrite_time_sec: get_i64("aof_last_rewrite_time_sec"),
        aof_last_bgrewrite_status: get_str("aof_last_bgrewrite_status"),
        aof_current_size: get_u64("aof_current_size"),
        aof_base_size: get_u64("aof_base_size"),
    }
}

fn parse_cpu_stats(info: &str) -> CpuStats {
    let mut map: HashMap<String, String> = HashMap::new();
    for line in info.lines() {
        if let Some((k, v)) = line.split_once(':') {
            map.insert(k.to_string(), v.to_string());
        }
    }

    let get_f64 = |k: &str| map.get(k).and_then(|v| v.parse().ok()).unwrap_or(0.0);

    CpuStats {
        used_cpu_sys: get_f64("used_cpu_sys"),
        used_cpu_user: get_f64("used_cpu_user"),
        used_cpu_sys_children: get_f64("used_cpu_sys_children"),
        used_cpu_user_children: get_f64("used_cpu_user_children"),
    }
}

fn parse_error_stats(info: &str) -> Vec<ErrorStat> {
    info.lines()
        .filter(|l| l.starts_with("errorstat_"))
        .filter_map(|line| {
            let (err_part, count_part) = line.split_once(':')?;
            let error_type = err_part.strip_prefix("errorstat_")?.to_string();
            let count = count_part.strip_prefix("count=")?.parse().ok()?;
            Some(ErrorStat { error_type, count })
        })
        .collect()
}
