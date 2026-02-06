import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Users,
  AlertTriangle,
  TrendingUp,
  Zap,
  Database,
  ArrowRight,
  CheckCircle,
  XCircle,
  Info,
  Server,
  Gauge,
  MemoryStick,
  Network,
  Loader2,
  Key,
  Layers,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import type { RedisInfo } from "@/types";

interface DashboardProps {
  serverName: string;
  info: RedisInfo | null;
  onNavigate: (tab: string) => void;
}

interface HealthIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  metric: string;
  value: string;
  threshold: string;
  action: string;
  navigateTo?: string;
}

interface MetricHistory {
  timestamp: number;
  opsPerSec: number;
  usedMemory: number;
  connectedClients: number;
  hitRate: number;
  fragRatio: number;
  totalKeys: number;
  evictedKeys: number;
  expiredKeys: number;
  totalCommands: number;
}

const MAX_HISTORY = 60;

export function Dashboard({ serverName, info, onNavigate }: DashboardProps) {
  const [history, setHistory] = useState<MetricHistory[]>([]);
  const [issues, setIssues] = useState<HealthIssue[]>([]);

  const calculateHitRate = useCallback((info: RedisInfo | null): number => {
    if (!info?.stats) return 0;
    const hits = info.stats.keyspace_hits || 0;
    const misses = info.stats.keyspace_misses || 0;
    if (hits + misses === 0) return 100;
    return (hits / (hits + misses)) * 100;
  }, []);

  const getTotalKeys = useCallback((info: RedisInfo | null): number => {
    if (!info?.keyspace) return 0;
    return Object.values(info.keyspace).reduce((sum, db) => sum + (db.keys || 0), 0);
  }, []);

  const getTotalExpires = useCallback((info: RedisInfo | null): number => {
    if (!info?.keyspace) return 0;
    return Object.values(info.keyspace).reduce((sum, db) => sum + (db.expires || 0), 0);
  }, []);

  const detectIssues = useCallback((info: RedisInfo | null): HealthIssue[] => {
    if (!info) return [];
    const issues: HealthIssue[] = [];

    const fragRatio = info.memory?.mem_fragmentation_ratio || 0;
    if (fragRatio > 1.5) {
      issues.push({
        id: "high-fragmentation",
        severity: "warning",
        title: "High Memory Fragmentation",
        description: "Memory fragmentation is above 1.5x. Consider restarting Redis to reclaim memory.",
        metric: "mem_fragmentation_ratio",
        value: fragRatio.toFixed(2),
        threshold: "> 1.5",
        action: "Review memory usage",
        navigateTo: "db-analysis",
      });
    } else if (fragRatio < 1 && fragRatio > 0) {
      issues.push({
        id: "low-fragmentation",
        severity: "critical",
        title: "Memory Swapping Risk",
        description: "Fragmentation ratio below 1 indicates Redis needs more memory than available.",
        metric: "mem_fragmentation_ratio",
        value: fragRatio.toFixed(2),
        threshold: "< 1.0",
        action: "Increase available memory",
        navigateTo: "info",
      });
    }

    const hitRate = calculateHitRate(info);
    const totalOps = (info.stats?.keyspace_hits || 0) + (info.stats?.keyspace_misses || 0);
    if (hitRate < 80 && totalOps > 100) {
      issues.push({
        id: "low-hit-rate",
        severity: "warning",
        title: "Low Cache Hit Rate",
        description: `Only ${hitRate.toFixed(1)}% of requests are cache hits. Check if keys are being evicted or expiring too quickly.`,
        metric: "hit_rate",
        value: `${hitRate.toFixed(1)}%`,
        threshold: "< 80%",
        action: "Review key expiration",
        navigateTo: "keys",
      });
    }

    const evictedKeys = info.stats?.evicted_keys || 0;
    if (evictedKeys > 1000) {
      issues.push({
        id: "high-eviction",
        severity: "warning",
        title: "High Key Eviction",
        description: `${evictedKeys.toLocaleString()} keys have been evicted. Consider increasing maxmemory.`,
        metric: "evicted_keys",
        value: evictedKeys.toLocaleString(),
        threshold: "> 1000",
        action: "Increase memory limit",
        navigateTo: "info",
      });
    }

    const maxMem = info.memory?.maxmemory || 0;
    const usedMem = info.memory?.used_memory || 0;
    const memUsagePercent = maxMem > 0 ? (usedMem / maxMem) * 100 : 0;
    if (memUsagePercent > 90) {
      issues.push({
        id: "high-memory",
        severity: "critical",
        title: "Critical Memory Usage",
        description: `Memory usage is at ${memUsagePercent.toFixed(1)}%. Redis may start evicting keys or refuse writes.`,
        metric: "used_memory",
        value: `${memUsagePercent.toFixed(1)}%`,
        threshold: "> 90%",
        action: "Free up memory immediately",
        navigateTo: "db-analysis",
      });
    } else if (memUsagePercent > 80) {
      issues.push({
        id: "warning-memory",
        severity: "warning",
        title: "High Memory Usage",
        description: `Memory usage is at ${memUsagePercent.toFixed(1)}%. Consider monitoring closely.`,
        metric: "used_memory",
        value: `${memUsagePercent.toFixed(1)}%`,
        threshold: "> 80%",
        action: "Monitor memory",
        navigateTo: "db-analysis",
      });
    }

    const clients = info.server?.connected_clients || 0;
    if (clients > 1000) {
      issues.push({
        id: "high-clients",
        severity: "warning",
        title: "High Client Connections",
        description: `${clients} clients connected. This may impact performance.`,
        metric: "connected_clients",
        value: clients.toString(),
        threshold: "> 1000",
        action: "Review client connections",
        navigateTo: "clients",
      });
    }

    return issues;
  }, [calculateHitRate]);

  useEffect(() => {
    if (info) {
      const newPoint: MetricHistory = {
        timestamp: Date.now(),
        opsPerSec: info.stats?.instantaneous_ops_per_sec || 0,
        usedMemory: info.memory?.used_memory || 0,
        connectedClients: info.server?.connected_clients || 0,
        hitRate: calculateHitRate(info),
        fragRatio: info.memory?.mem_fragmentation_ratio || 0,
        totalKeys: getTotalKeys(info),
        evictedKeys: info.stats?.evicted_keys || 0,
        expiredKeys: info.stats?.expired_keys || 0,
        totalCommands: info.stats?.total_commands_processed || 0,
      };
      setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), newPoint]);
      setIssues(detectIssues(info));
    }
  }, [info, calculateHitRate, detectIssues]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const formatCompact = (val: number): string => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const renderMiniChart = (data: number[], color: string, height: number = 40) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const width = 100;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" preserveAspectRatio="none">
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
      </svg>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 border-red-500/30 text-red-500";
      case "warning": return "bg-yellow-500/10 border-yellow-500/30 text-yellow-500";
      default: return "bg-blue-500/10 border-blue-500/30 text-blue-500";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <XCircle className="h-5 w-5" />;
      case "warning": return <AlertTriangle className="h-5 w-5" />;
      default: return <Info className="h-5 w-5" />;
    }
  };

  if (!info) {
    return (
      <div className="space-y-6 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-secondary/30 border">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
              <div className="mt-2 flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border">
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hitRate = calculateHitRate(info);
  const maxMem = info.memory?.maxmemory || 0;
  const usedMem = info.memory?.used_memory || 0;
  const memUsagePercent = maxMem > 0 ? (usedMem / maxMem) * 100 : 0;
  const opsPerSec = info.stats?.instantaneous_ops_per_sec || 0;
  const connectedClients = info.server?.connected_clients || 0;
  const totalKeys = getTotalKeys(info);
  const totalExpires = getTotalExpires(info);
  const fragRatio = info.memory?.mem_fragmentation_ratio || 0;
  const evictedKeys = info.stats?.evicted_keys || 0;
  const expiredKeys = info.stats?.expired_keys || 0;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{serverName}</h2>
            <p className="text-muted-foreground">
              Redis {info.server?.redis_version} • Uptime: {formatUptime(info.server?.uptime_in_seconds || 0)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {issues.filter(i => i.severity === "critical").length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {issues.filter(i => i.severity === "critical").length} Critical
              </Badge>
            )}
            {issues.filter(i => i.severity === "warning").length > 0 && (
              <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
                <AlertTriangle className="h-3 w-3" />
                {issues.filter(i => i.severity === "warning").length} Warnings
              </Badge>
            )}
            {issues.length === 0 && (
              <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                <CheckCircle className="h-3 w-3" />
                Healthy
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div 
            className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 cursor-pointer hover:border-green-500/40 transition-colors"
            onClick={() => onNavigate("analytics")}
          >
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-green-500" />
              <Badge variant="outline" className="text-xs">ops/sec</Badge>
            </div>
            <div className="text-2xl font-bold">{opsPerSec.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Commands per second</div>
            {renderMiniChart(history.map(h => h.opsPerSec), "rgb(34, 197, 94)")}
          </div>

          <div 
            className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 cursor-pointer hover:border-blue-500/40 transition-colors"
            onClick={() => onNavigate("db-analysis")}
          >
            <div className="flex items-center justify-between mb-2">
              <MemoryStick className="h-5 w-5 text-blue-500" />
              <Badge variant="outline" className="text-xs">
                {memUsagePercent > 0 ? `${memUsagePercent.toFixed(0)}%` : "N/A"}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{formatBytes(usedMem)}</div>
            <div className="text-xs text-muted-foreground">Memory Used</div>
            {renderMiniChart(history.map(h => h.usedMemory), "rgb(59, 130, 246)")}
          </div>

          <div 
            className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors"
            onClick={() => onNavigate("clients")}
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-purple-500" />
              <Badge variant="outline" className="text-xs">active</Badge>
            </div>
            <div className="text-2xl font-bold">{connectedClients}</div>
            <div className="text-xs text-muted-foreground">Connected Clients</div>
            {renderMiniChart(history.map(h => h.connectedClients), "rgb(168, 85, 247)")}
          </div>

          <div 
            className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 cursor-pointer hover:border-orange-500/40 transition-colors"
            onClick={() => onNavigate("keys")}
          >
            <div className="flex items-center justify-between mb-2">
              <Gauge className="h-5 w-5 text-orange-500" />
              <Badge 
                variant="outline" 
                className={`text-xs ${hitRate >= 90 ? "text-green-500" : hitRate >= 70 ? "text-yellow-500" : "text-red-500"}`}
              >
                {hitRate >= 90 ? "Good" : hitRate >= 70 ? "Fair" : "Poor"}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{hitRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Cache Hit Rate</div>
            {renderMiniChart(history.map(h => h.hitRate), "rgb(249, 115, 22)")}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div
            className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/20 cursor-pointer hover:border-yellow-500/40 transition-colors"
            onClick={() => onNavigate("keys")}
          >
            <div className="flex items-center justify-between mb-2">
              <Key className="h-5 w-5 text-yellow-500" />
              <Badge variant="outline" className="text-xs">{totalExpires.toLocaleString()} expiring</Badge>
            </div>
            <div className="text-2xl font-bold">{totalKeys.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Keys</div>
            {renderMiniChart(history.map(h => h.totalKeys), "rgb(234, 179, 8)")}
          </div>

          <div
            className={`p-4 rounded-xl bg-gradient-to-br border cursor-pointer transition-colors ${
              fragRatio > 1.5
                ? "from-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/40"
                : "from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40"
            }`}
            onClick={() => onNavigate("db-analysis")}
          >
            <div className="flex items-center justify-between mb-2">
              <Layers className="h-5 w-5 text-cyan-500" />
              <Badge variant="outline" className={`text-xs ${fragRatio > 1.5 ? "text-red-500" : fragRatio < 1 && fragRatio > 0 ? "text-yellow-500" : ""}`}>
                {fragRatio > 1.5 ? "High" : fragRatio < 1 && fragRatio > 0 ? "Swapping" : "Normal"}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{fragRatio.toFixed(2)}x</div>
            <div className="text-xs text-muted-foreground">Fragmentation Ratio</div>
            {renderMiniChart(history.map(h => h.fragRatio), "rgb(6, 182, 212)")}
          </div>

          <div
            className={`p-4 rounded-xl bg-gradient-to-br border transition-colors ${
              evictedKeys > 0
                ? "from-red-500/10 to-red-500/5 border-red-500/20"
                : "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-red-400" />
              <Badge variant="outline" className={`text-xs ${evictedKeys > 0 ? "text-red-500" : "text-green-500"}`}>
                {evictedKeys > 0 ? "active" : "none"}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{evictedKeys.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Evicted Keys</div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/20">
            <div className="flex items-center justify-between mb-2">
              <Database className="h-5 w-5 text-pink-500" />
              <Badge variant="outline" className="text-xs">{info.replication?.role || "N/A"}</Badge>
            </div>
            <div className="text-2xl font-bold">{expiredKeys.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Expired Keys</div>
          </div>
        </div>

        {history.length > 5 && (() => {
          const tooltipStyle = { background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' };
          const axisStyle = { fontSize: 10, fill: '#888' };
          const chartData = history.slice(-30);

          return (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-card border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  Operations Over Time
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="opsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#444' }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={formatCompact} tick={axisStyle} tickLine={false} axisLine={false} width={45} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(Number(v))} formatter={(value) => [`${Number(value).toLocaleString()} ops/sec`, 'Throughput']} />
                      <Area type="monotone" dataKey="opsPerSec" stroke="#22c55e" fill="url(#opsGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-blue-500" />
                  Memory Usage Over Time
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.map(h => ({ ...h, memMB: h.usedMemory / (1024 * 1024) }))}>
                      <defs>
                        <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#444' }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)} MB`} tick={axisStyle} tickLine={false} axisLine={false} width={55} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(Number(v))} formatter={(value) => [`${Number(value).toFixed(1)} MB`, 'Memory']} />
                      <Area type="monotone" dataKey="memMB" stroke="#3b82f6" fill="url(#memGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  Connected Clients Over Time
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#444' }} interval="preserveStartEnd" />
                      <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={35} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(Number(v))} formatter={(value) => [`${Number(value)} clients`, 'Connected']} />
                      <Line type="monotone" dataKey="connectedClients" stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-orange-500" />
                  Cache Hit Rate Over Time
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="hitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#444' }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={axisStyle} tickLine={false} axisLine={false} width={40} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(Number(v))} formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Hit Rate']} />
                      <Area type="monotone" dataKey="hitRate" stroke="#f97316" fill="url(#hitGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-500" />
                  Memory Fragmentation Ratio
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#444' }} interval="preserveStartEnd" />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `${Number(v).toFixed(2)}x`} tick={axisStyle} tickLine={false} axisLine={false} width={45} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(Number(v))} formatter={(value) => [`${Number(value).toFixed(3)}x`, 'Frag Ratio']} />
                      <Line type="monotone" dataKey="fragRatio" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Key className="h-4 w-4 text-yellow-500" />
                  Total Keys Over Time
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="keysGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#444' }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={formatCompact} tick={axisStyle} tickLine={false} axisLine={false} width={45} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => formatTime(Number(v))} formatter={(value) => [`${Number(value).toLocaleString()} keys`, 'Total Keys']} />
                      <Area type="monotone" dataKey="totalKeys" stroke="#eab308" fill="url(#keysGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })()}

        {Object.keys(info.keyspace).length > 0 && (
          <div className="p-4 rounded-xl bg-card border">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-500" />
              Keyspace Distribution
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(info.keyspace).map(([db, data]) => ({ db, keys: data.keys, expires: data.expires }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="db" tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={{ stroke: '#444' }} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} width={45} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} formatter={(value, name) => [`${Number(value).toLocaleString()}`, name === 'keys' ? 'Total Keys' : 'With Expiry']} />
                  <Bar dataKey="keys" fill="#6366f1" radius={[4, 4, 0, 0]} name="keys" />
                  <Bar dataKey="expires" fill="#818cf8" radius={[4, 4, 0, 0]} name="expires" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {issues.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Health Issues Detected
            </h3>
            <div className="space-y-2">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)} cursor-pointer hover:opacity-90 transition-opacity`}
                  onClick={() => issue.navigateTo && onNavigate(issue.navigateTo)}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <div className="font-medium">{issue.title}</div>
                      <div className="text-sm opacity-80 mt-1">{issue.description}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="font-mono bg-black/20 px-2 py-1 rounded">
                          {issue.metric}: {issue.value}
                        </span>
                        <span className="opacity-60">Threshold: {issue.threshold}</span>
                      </div>
                    </div>
                    {issue.navigateTo && (
                      <Button variant="ghost" size="sm" className="gap-1">
                        {issue.action}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Server className="h-4 w-4" />
              Server Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Total Keys</div>
                <div className="text-lg font-semibold">{totalKeys.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Expires</div>
                <div className="text-lg font-semibold">{totalExpires.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Evicted Keys</div>
                <div className="text-lg font-semibold">{(info.stats?.evicted_keys || 0).toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Expired Keys</div>
                <div className="text-lg font-semibold">{(info.stats?.expired_keys || 0).toLocaleString()}</div>
              </div>
              <div 
                className="p-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => onNavigate("keys")}
              >
                <div className="text-xs text-muted-foreground">Keyspace Hits</div>
                <div className="text-lg font-semibold text-green-500">{(info.stats?.keyspace_hits || 0).toLocaleString()}</div>
              </div>
              <div 
                className="p-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors"
                onClick={() => onNavigate("keys")}
              >
                <div className="text-xs text-muted-foreground">Keyspace Misses</div>
                <div className="text-lg font-semibold text-red-500">{(info.stats?.keyspace_misses || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Network className="h-4 w-4" />
              Memory Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Used Memory</div>
                <div className="text-lg font-semibold">{info.memory?.used_memory_human || "N/A"}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Peak Memory</div>
                <div className="text-lg font-semibold">{info.memory?.used_memory_peak_human || "N/A"}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Max Memory</div>
                <div className="text-lg font-semibold">{info.memory?.maxmemory_human || "N/A"}</div>
              </div>
              <div 
                className={`p-3 rounded-lg ${(info.memory?.mem_fragmentation_ratio || 0) > 1.5 ? "bg-yellow-500/10" : "bg-secondary/50"}`}
              >
                <div className="text-xs text-muted-foreground">Fragmentation</div>
                <div className={`text-lg font-semibold ${(info.memory?.mem_fragmentation_ratio || 0) > 1.5 ? "text-yellow-500" : ""}`}>
                  {(info.memory?.mem_fragmentation_ratio || 0).toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Total Commands</div>
                <div className="text-lg font-semibold">{(info.stats?.total_commands_processed || 0).toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-xs text-muted-foreground">Total Connections</div>
                <div className="text-lg font-semibold">{(info.stats?.total_connections_received || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => onNavigate("keys")}
          >
            <Database className="h-5 w-5" />
            <span>Browse Keys</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => onNavigate("cli")}
          >
            <Activity className="h-5 w-5" />
            <span>Open CLI</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => onNavigate("monitor")}
          >
            <Zap className="h-5 w-5" />
            <span>Live Monitor</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => onNavigate("db-analysis")}
          >
            <TrendingUp className="h-5 w-5" />
            <span>Analysis</span>
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
