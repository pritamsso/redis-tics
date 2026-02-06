use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisServer {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub db: Option<u8>,
    pub tls: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub redis_version: String,
    pub os: String,
    pub uptime_in_seconds: u64,
    pub connected_clients: u64,
    pub tcp_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    pub used_memory: u64,
    pub used_memory_human: String,
    pub used_memory_peak: u64,
    pub used_memory_peak_human: String,
    pub maxmemory: u64,
    pub maxmemory_human: String,
    pub mem_fragmentation_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsInfo {
    pub total_connections_received: u64,
    pub total_commands_processed: u64,
    pub instantaneous_ops_per_sec: u64,
    pub keyspace_hits: u64,
    pub keyspace_misses: u64,
    pub expired_keys: u64,
    pub evicted_keys: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplicationInfo {
    pub role: String,
    pub connected_slaves: u64,
    pub master_host: Option<String>,
    pub master_port: Option<u16>,
    pub master_link_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyspaceDbInfo {
    pub keys: u64,
    pub expires: u64,
    pub avg_ttl: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisInfo {
    pub server: ServerInfo,
    pub memory: MemoryInfo,
    pub stats: StatsInfo,
    pub replication: ReplicationInfo,
    pub keyspace: HashMap<String, KeyspaceDbInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub id: String,
    pub addr: String,
    pub ip: String,
    pub port: String,
    pub name: Option<String>,
    pub age: u64,
    pub idle: u64,
    pub flags: String,
    pub db: u8,
    pub cmd: String,
    pub qbuf: u64,
    pub obl: u64,
    pub oll: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorEvent {
    pub timestamp: u64,
    pub client_ip: String,
    pub client_port: String,
    pub db: u8,
    pub command: String,
    pub args: Vec<String>,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlowLogEntry {
    pub id: u64,
    pub timestamp: u64,
    pub duration_us: u64,
    pub command: String,
    pub args: Vec<String>,
    pub client_addr: Option<String>,
    pub client_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStats {
    pub peak_allocated: u64,
    pub total_allocated: u64,
    pub startup_allocated: u64,
    pub replication_backlog: u64,
    pub clients_slaves: u64,
    pub clients_normal: u64,
    pub aof_buffer: u64,
    pub lua_caches: u64,
    pub db_hashtable_overhead: u64,
    pub keys_count: u64,
    pub keys_bytes_per_key: u64,
    pub dataset_bytes: u64,
    pub dataset_percentage: f64,
    pub peak_percentage: f64,
    pub fragmentation_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandStat {
    pub command: String,
    pub calls: u64,
    pub usec: u64,
    pub usec_per_call: f64,
    pub rejected_calls: u64,
    pub failed_calls: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterInfo {
    pub cluster_enabled: bool,
    pub cluster_state: String,
    pub cluster_slots_assigned: u64,
    pub cluster_slots_ok: u64,
    pub cluster_slots_pfail: u64,
    pub cluster_slots_fail: u64,
    pub cluster_known_nodes: u64,
    pub cluster_size: u64,
    pub cluster_current_epoch: u64,
    pub cluster_my_epoch: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterNode {
    pub id: String,
    pub addr: String,
    pub flags: String,
    pub master_id: Option<String>,
    pub ping_sent: u64,
    pub pong_recv: u64,
    pub config_epoch: u64,
    pub link_state: String,
    pub slots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistenceInfo {
    pub rdb_last_save_time: u64,
    pub rdb_changes_since_last_save: u64,
    pub rdb_bgsave_in_progress: bool,
    pub rdb_last_bgsave_status: String,
    pub rdb_last_bgsave_time_sec: i64,
    pub aof_enabled: bool,
    pub aof_rewrite_in_progress: bool,
    pub aof_last_rewrite_time_sec: i64,
    pub aof_last_bgrewrite_status: String,
    pub aof_current_size: u64,
    pub aof_base_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuStats {
    pub used_cpu_sys: f64,
    pub used_cpu_user: f64,
    pub used_cpu_sys_children: f64,
    pub used_cpu_user_children: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorStat {
    pub error_type: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct BigKey {
    pub key: String,
    pub key_type: String,
    pub size: u64,
    pub encoding: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatencyHistoryEntry {
    pub timestamp: u64,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedAnalytics {
    pub memory_stats: Option<MemoryStats>,
    pub memory_doctor: Option<String>,
    pub slow_log: Vec<SlowLogEntry>,
    pub command_stats: Vec<CommandStat>,
    pub cluster_info: Option<ClusterInfo>,
    pub cluster_nodes: Vec<ClusterNode>,
    pub persistence: Option<PersistenceInfo>,
    pub cpu_stats: Option<CpuStats>,
    pub error_stats: Vec<ErrorStat>,
    pub latency_doctor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyInfo {
    pub key: String,
    pub key_type: String,
    pub ttl: i64,
    pub size: Option<u64>,
    pub encoding: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    pub key: String,
    pub key_type: String,
    pub ttl: i64,
    pub value: KeyValueData,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KeyValueData {
    String(String),
    List(Vec<String>),
    Set(Vec<String>),
    ZSet(Vec<ZSetMember>),
    Hash(HashMap<String, String>),
    Stream(Vec<StreamEntry>),
    Unknown(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZSetMember {
    pub member: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamEntry {
    pub id: String,
    pub fields: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyScanResult {
    pub keys: Vec<KeyInfo>,
    pub cursor: String,
    pub has_more: bool,
    pub total_scanned: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerCapabilities {
    pub server_type: String,
    pub version: String,
    pub cluster_enabled: bool,
    pub cluster_mode: String,
    pub supports_memory_commands: bool,
    pub supports_latency_commands: bool,
    pub supports_module_commands: bool,
    pub is_read_replica: bool,
    pub max_clients: u64,
    pub total_keys: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceWarning {
    pub level: String,
    pub message: String,
    pub command: String,
    pub estimated_impact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub success: bool,
    pub result: String,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteResult {
    pub deleted_count: u64,
    pub failed_count: u64,
    pub execution_time_ms: u64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseAnalysis {
    pub total_keys: u64,
    pub total_memory: u64,
    pub type_distribution: Vec<TypeDistribution>,
    pub memory_by_type: Vec<TypeMemory>,
    pub expiry_analysis: ExpiryAnalysis,
    pub top_keys_by_memory: Vec<KeyMemoryInfo>,
    pub namespaces: Vec<NamespaceInfo>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeDistribution {
    pub key_type: String,
    pub count: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeMemory {
    pub key_type: String,
    pub memory_bytes: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpiryAnalysis {
    pub keys_with_ttl: u64,
    pub keys_without_ttl: u64,
    pub expiring_in_1h: u64,
    pub expiring_in_24h: u64,
    pub expiring_in_7d: u64,
    pub memory_to_free_1h: u64,
    pub memory_to_free_24h: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyMemoryInfo {
    pub key: String,
    pub key_type: String,
    pub memory_bytes: u64,
    pub ttl: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceInfo {
    pub namespace: String,
    pub key_count: u64,
    pub memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientAnalysis {
    pub total_clients: u64,
    pub idle_clients: Vec<IdleClient>,
    pub high_memory_clients: Vec<ClientMemoryInfo>,
    pub clients_by_command: Vec<CommandClientInfo>,
    pub suspicious_patterns: Vec<SuspiciousPattern>,
    pub anomalies: Vec<ClientAnomaly>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdleClient {
    pub id: String,
    pub addr: String,
    pub idle_seconds: u64,
    pub last_command: String,
    pub connected_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientMemoryInfo {
    pub id: String,
    pub addr: String,
    pub output_buffer_bytes: u64,
    pub query_buffer_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandClientInfo {
    pub command: String,
    pub client_count: u64,
    pub client_ips: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousPattern {
    pub pattern_type: String,
    pub severity: String,
    pub description: String,
    pub affected_clients: Vec<String>,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientAnomaly {
    pub anomaly_type: String,
    pub client_addr: String,
    pub details: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomAlert {
    pub id: String,
    pub name: String,
    pub condition_type: String,
    pub threshold: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertTrigger {
    pub alert_id: String,
    pub alert_name: String,
    pub triggered_at: u64,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
}
