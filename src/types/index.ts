export interface RedisServer {
  id: string;
  name: string;
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
}

export interface RedisInfo {
  server: {
    redis_version: string;
    os: string;
    uptime_in_seconds: number;
    connected_clients: number;
    tcp_port: number;
  };
  memory: {
    used_memory: number;
    used_memory_human: string;
    used_memory_peak: number;
    used_memory_peak_human: string;
    maxmemory: number;
    maxmemory_human: string;
    mem_fragmentation_ratio: number;
  };
  stats: {
    total_connections_received: number;
    total_commands_processed: number;
    instantaneous_ops_per_sec: number;
    keyspace_hits: number;
    keyspace_misses: number;
    expired_keys: number;
    evicted_keys: number;
  };
  replication: {
    role: string;
    connected_slaves: number;
    master_host?: string;
    master_port?: number;
    master_link_status?: string;
  };
  keyspace: Record<string, { keys: number; expires: number; avg_ttl: number }>;
}

export interface ClientInfo {
  id: string;
  addr: string;
  ip: string;
  port: string;
  name?: string;
  age: number;
  idle: number;
  flags: string;
  db: number;
  cmd: string;
  qbuf: number;
  obl: number;
  oll: number;
}

export interface MonitorEvent {
  timestamp: number;
  clientIp: string;
  clientPort: string;
  db: number;
  command: string;
  args: string[];
  raw: string;
}

export interface IpStats {
  ip: string;
  commandCount: number;
  lastSeen: number;
  commands: Record<string, number>;
  bytesProcessed: number;
}

export interface CommandStats {
  command: string;
  count: number;
  percentage: number;
}

export interface ConnectionState {
  serverId: string;
  connected: boolean;
  monitoring: boolean;
  error?: string;
}

export interface SlowLogEntry {
  id: number;
  timestamp: number;
  durationUs: number;
  command: string;
  args: string[];
  clientAddr?: string;
  clientName?: string;
}

export interface MemoryStats {
  peakAllocated: number;
  totalAllocated: number;
  startupAllocated: number;
  replicationBacklog: number;
  clientsSlaves: number;
  clientsNormal: number;
  aofBuffer: number;
  luaCaches: number;
  dbHashtableOverhead: number;
  keysCount: number;
  keysBytesPerKey: number;
  datasetBytes: number;
  datasetPercentage: number;
  peakPercentage: number;
  fragmentationRatio: number;
}

export interface CommandStat {
  command: string;
  calls: number;
  usec: number;
  usecPerCall: number;
  rejectedCalls: number;
  failedCalls: number;
}

export interface ClusterInfo {
  clusterEnabled: boolean;
  clusterState: string;
  clusterSlotsAssigned: number;
  clusterSlotsOk: number;
  clusterSlotsPfail: number;
  clusterSlotsFail: number;
  clusterKnownNodes: number;
  clusterSize: number;
  clusterCurrentEpoch: number;
  clusterMyEpoch: number;
}

export interface ClusterNode {
  id: string;
  addr: string;
  flags: string;
  masterId?: string;
  pingSent: number;
  pongRecv: number;
  configEpoch: number;
  linkState: string;
  slots: string[];
}

export interface PersistenceInfo {
  rdbLastSaveTime: number;
  rdbChangesSinceLastSave: number;
  rdbBgsaveInProgress: boolean;
  rdbLastBgsaveStatus: string;
  rdbLastBgsaveTimeSec: number;
  aofEnabled: boolean;
  aofRewriteInProgress: boolean;
  aofLastRewriteTimeSec: number;
  aofLastBgrewriteStatus: string;
  aofCurrentSize: number;
  aofBaseSize: number;
}

export interface CpuStats {
  usedCpuSys: number;
  usedCpuUser: number;
  usedCpuSysChildren: number;
  usedCpuUserChildren: number;
}

export interface ErrorStat {
  errorType: string;
  count: number;
}

export interface AdvancedAnalytics {
  memoryStats?: MemoryStats;
  memoryDoctor?: string;
  slowLog: SlowLogEntry[];
  commandStats: CommandStat[];
  clusterInfo?: ClusterInfo;
  clusterNodes: ClusterNode[];
  persistence?: PersistenceInfo;
  cpuStats?: CpuStats;
  errorStats: ErrorStat[];
  latencyDoctor?: string;
}
