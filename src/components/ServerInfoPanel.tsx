import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, HardDrive, Activity, Users, Clock, Database, Zap } from "lucide-react";
import type { RedisInfo } from "@/types";
import { formatNumber, formatUptime } from "@/lib/utils";

interface ServerInfoPanelProps {
  info: RedisInfo | undefined;
  serverName: string;
}

export function ServerInfoPanel({ info, serverName }: ServerInfoPanelProps) {
  if (!info) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Connect to a server to view info
      </div>
    );
  }

  const hitRate = info.stats.keyspace_hits + info.stats.keyspace_misses > 0
    ? ((info.stats.keyspace_hits / (info.stats.keyspace_hits + info.stats.keyspace_misses)) * 100).toFixed(1)
    : "N/A";

  const totalKeys = Object.values(info.keyspace).reduce((sum, db) => sum + db.keys, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{serverName}</h2>
        <Badge variant="success" className="text-sm">
          {info.replication.role.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Version</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{info.server.redis_version}</div>
            <p className="text-xs text-muted-foreground mt-1">{info.server.os.split(" ")[0]}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(info.server.uptime_in_seconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">{info.server.uptime_in_seconds.toLocaleString()}s</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{info.server.connected_clients}</div>
            <p className="text-xs text-muted-foreground mt-1">Active connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ops/sec</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(info.stats.instantaneous_ops_per_sec)}</div>
            <p className="text-xs text-muted-foreground mt-1">Instantaneous</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Memory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Used Memory</span>
              <span className="font-semibold">{info.memory.used_memory_human}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Peak Memory</span>
              <span className="font-semibold">{info.memory.used_memory_peak_human}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Max Memory</span>
              <span className="font-semibold">{info.memory.maxmemory_human || "Unlimited"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Fragmentation Ratio</span>
              <Badge variant={info.memory.mem_fragmentation_ratio > 1.5 ? "warning" : "secondary"}>
                {info.memory.mem_fragmentation_ratio.toFixed(2)}
              </Badge>
            </div>
            {info.memory.maxmemory > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Memory Usage</span>
                  <span>{((info.memory.used_memory / info.memory.maxmemory) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min((info.memory.used_memory / info.memory.maxmemory) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Commands</span>
              <span className="font-semibold">{formatNumber(info.stats.total_commands_processed)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Connections</span>
              <span className="font-semibold">{formatNumber(info.stats.total_connections_received)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Cache Hit Rate</span>
              <Badge variant={parseFloat(hitRate) > 90 ? "success" : parseFloat(hitRate) > 70 ? "warning" : "destructive"}>
                {hitRate}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expired Keys</span>
              <span className="font-semibold">{formatNumber(info.stats.expired_keys)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Evicted Keys</span>
              <span className="font-semibold">{formatNumber(info.stats.evicted_keys)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Keyspace ({totalKeys.toLocaleString()} total keys)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(info.keyspace).length === 0 ? (
            <p className="text-muted-foreground text-sm">No databases with keys</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(info.keyspace).map(([db, data]) => (
                <div key={db} className="p-3 bg-secondary rounded-lg">
                  <div className="font-semibold">{db}</div>
                  <div className="text-sm text-muted-foreground">
                    {data.keys.toLocaleString()} keys
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.expires.toLocaleString()} expires
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {info.replication.role === "slave" && (
        <Card>
          <CardHeader>
            <CardTitle>Replication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Master</span>
              <span>{info.replication.master_host}:{info.replication.master_port}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Link Status</span>
              <Badge variant={info.replication.master_link_status === "up" ? "success" : "destructive"}>
                {info.replication.master_link_status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
