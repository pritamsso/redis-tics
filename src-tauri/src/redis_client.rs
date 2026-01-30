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
