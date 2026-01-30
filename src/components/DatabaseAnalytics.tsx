import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Database,
  HardDrive,
  Clock,
  AlertTriangle,
  TrendingUp,
  Trash2,
  Users,
  Activity,
  Zap,
  PieChart,
  BarChart3,
  Lightbulb,
  Shield,
} from "lucide-react";
import type {
  DatabaseAnalysis,
  ClientAnalysis,
  BulkDeleteResult,
} from "@/types";

interface DatabaseAnalyticsProps {
  serverId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function DatabaseAnalytics({ serverId }: DatabaseAnalyticsProps) {
  const [analysis, setAnalysis] = useState<DatabaseAnalysis | null>(null);
  const [clientAnalysis, setClientAnalysis] = useState<ClientAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "clients" | "bulk">("overview");
  const [bulkPattern, setBulkPattern] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkDeleteResult | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const [dbAnalysis, clientData] = await Promise.all([
        invoke<DatabaseAnalysis>("analyze_database", { serverId, sampleSize: 1000 }),
        invoke<ClientAnalysis>("analyze_clients", { serverId }),
      ]);
      setAnalysis(dbAnalysis);
      setClientAnalysis(clientData);
    } catch (err) {
      console.error("Failed to analyze:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, [serverId]);

  const handleBulkDelete = async () => {
    if (!bulkPattern || !confirm(`Delete all keys matching "${bulkPattern}"? This cannot be undone!`)) {
      return;
    }
    setBulkLoading(true);
    try {
      const result = await invoke<BulkDeleteResult>("bulk_delete", {
        serverId,
        pattern: bulkPattern,
      });
      setBulkResult(result);
      loadAnalysis();
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setBulkLoading(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Database Overview", icon: Database },
    { id: "clients", label: "Client Analysis", icon: Users },
    { id: "bulk", label: "Bulk Actions", icon: Trash2 },
  ] as const;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className="gap-2"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={loadAnalysis} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === "overview" && analysis && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Database className="h-4 w-4" />
                  <span className="text-sm">Total Keys</span>
                </div>
                <div className="text-2xl font-bold">{analysis.totalKeys.toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <HardDrive className="h-4 w-4" />
                  <span className="text-sm">Memory Usage</span>
                </div>
                <div className="text-2xl font-bold">{formatBytes(analysis.totalMemory)}</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Keys with TTL</span>
                </div>
                <div className="text-2xl font-bold">{analysis.expiryAnalysis.keysWithTtl}</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Namespaces</span>
                </div>
                <div className="text-2xl font-bold">{analysis.namespaces.length}</div>
              </div>
            </div>

            {analysis.recommendations.length > 0 && (
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-center gap-2 text-yellow-500 mb-3">
                  <Lightbulb className="h-5 w-5" />
                  <span className="font-semibold">Recommendations</span>
                </div>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-yellow-200/80 flex items-start gap-2">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Type Distribution
                </h3>
                <div className="space-y-2">
                  {analysis.typeDistribution.map((type) => (
                    <div key={type.keyType} className="flex items-center gap-3">
                      <div className="w-20 text-sm font-medium">{type.keyType}</div>
                      <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${type.percentage}%` }}
                        />
                      </div>
                      <div className="w-20 text-sm text-right">
                        {type.count} ({type.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Memory by Type
                </h3>
                <div className="space-y-2">
                  {analysis.memoryByType.map((type) => (
                    <div key={type.keyType} className="flex items-center gap-3">
                      <div className="w-20 text-sm font-medium">{type.keyType}</div>
                      <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${type.percentage}%` }}
                        />
                      </div>
                      <div className="w-24 text-sm text-right">
                        {formatBytes(type.memoryBytes)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Expiry Analysis
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded bg-secondary/50">
                    <div className="text-sm text-muted-foreground">Expiring in 1h</div>
                    <div className="text-lg font-semibold">{analysis.expiryAnalysis.expiringIn1h}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(analysis.expiryAnalysis.memoryToFree1h)} to free
                    </div>
                  </div>
                  <div className="p-3 rounded bg-secondary/50">
                    <div className="text-sm text-muted-foreground">Expiring in 24h</div>
                    <div className="text-lg font-semibold">{analysis.expiryAnalysis.expiringIn24h}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(analysis.expiryAnalysis.memoryToFree24h)} to free
                    </div>
                  </div>
                  <div className="p-3 rounded bg-secondary/50">
                    <div className="text-sm text-muted-foreground">Expiring in 7d</div>
                    <div className="text-lg font-semibold">{analysis.expiryAnalysis.expiringIn7d}</div>
                  </div>
                  <div className="p-3 rounded bg-secondary/50">
                    <div className="text-sm text-muted-foreground">No TTL</div>
                    <div className="text-lg font-semibold text-yellow-500">
                      {analysis.expiryAnalysis.keysWithoutTtl}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Top Keys by Memory
                </h3>
                <div className="space-y-1 max-h-48 overflow-auto">
                  {analysis.topKeysByMemory.slice(0, 10).map((key, i) => (
                    <div
                      key={key.key}
                      className="flex items-center gap-2 p-2 rounded bg-secondary/30 text-sm"
                    >
                      <span className="text-muted-foreground w-4">{i + 1}</span>
                      <span className="flex-1 font-mono truncate" title={key.key}>
                        {key.key}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {key.keyType}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatBytes(key.memoryBytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                Top Namespaces
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {analysis.namespaces.slice(0, 10).map((ns) => (
                  <div
                    key={ns.namespace}
                    className="flex items-center justify-between p-3 rounded bg-secondary/30"
                  >
                    <span className="font-mono text-sm">{ns.namespace}:*</span>
                    <div className="text-right">
                      <div className="text-sm">{ns.keyCount} keys</div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(ns.memoryBytes)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "clients" && clientAnalysis && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Total Clients</span>
                </div>
                <div className="text-2xl font-bold">{clientAnalysis.totalClients}</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Idle Clients</span>
                </div>
                <div className="text-2xl font-bold text-yellow-500">
                  {clientAnalysis.idleClients.length}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Suspicious Patterns</span>
                </div>
                <div className="text-2xl font-bold text-red-500">
                  {clientAnalysis.suspiciousPatterns.length}
                </div>
              </div>
            </div>

            {clientAnalysis.suspiciousPatterns.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-red-500">
                  <Shield className="h-4 w-4" />
                  Suspicious Patterns Detected
                </h3>
                <div className="space-y-2">
                  {clientAnalysis.suspiciousPatterns.map((pattern, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border ${
                        pattern.severity === "critical"
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-yellow-500/10 border-yellow-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={
                            pattern.severity === "critical"
                              ? "text-red-500 border-red-500"
                              : "text-yellow-500 border-yellow-500"
                          }
                        >
                          {pattern.patternType}
                        </Badge>
                        <span className="text-sm font-medium">{pattern.description}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Affected: {pattern.affectedClients.slice(0, 5).join(", ")}
                        {pattern.affectedClients.length > 5 &&
                          ` and ${pattern.affectedClients.length - 5} more`}
                      </div>
                      <div className="text-sm text-primary flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        {pattern.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clientAnalysis.idleClients.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Idle Clients ({">"} 5 min)
                </h3>
                <div className="space-y-1 max-h-64 overflow-auto">
                  {clientAnalysis.idleClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-4 p-3 rounded bg-secondary/30 text-sm"
                    >
                      <span className="font-mono">{client.addr}</span>
                      <Badge variant="outline">
                        idle {formatDuration(client.idleSeconds)}
                      </Badge>
                      <span className="text-muted-foreground">
                        last cmd: {client.lastCommand || "none"}
                      </span>
                      <span className="text-muted-foreground ml-auto">
                        connected {formatDuration(client.connectedSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Clients by Last Command
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {clientAnalysis.clientsByCommand.slice(0, 12).map((cmd) => (
                  <div
                    key={cmd.command}
                    className="flex items-center justify-between p-3 rounded bg-secondary/30"
                  >
                    <span className="font-mono text-sm">{cmd.command || "NULL"}</span>
                    <Badge>{cmd.clientCount}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {clientAnalysis.anomalies.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Anomalies</h3>
                <div className="space-y-1">
                  {clientAnalysis.anomalies.map((anomaly, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded bg-yellow-500/10 text-sm"
                    >
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="font-mono">{anomaly.clientAddr}</span>
                      <span>{anomaly.details}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "bulk" && (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-semibold">Danger Zone</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Bulk delete operations are irreversible. Make sure you have the correct
                pattern before proceeding.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Bulk Delete by Pattern</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter pattern (e.g., cache:*, temp:*, session:expired:*)"
                  value={bulkPattern}
                  onChange={(e) => setBulkPattern(e.target.value)}
                  className="font-mono"
                />
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={!bulkPattern || bulkLoading}
                >
                  {bulkLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Matching Keys
                </Button>
              </div>

              {bulkResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    bulkResult.failedCount > 0
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : "bg-green-500/10 border-green-500/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Deleted</div>
                      <div className="text-2xl font-bold text-green-500">
                        {bulkResult.deletedCount}
                      </div>
                    </div>
                    {bulkResult.failedCount > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                        <div className="text-2xl font-bold text-red-500">
                          {bulkResult.failedCount}
                        </div>
                      </div>
                    )}
                    <div className="ml-auto text-right">
                      <div className="text-sm text-muted-foreground">Time</div>
                      <div className="text-lg">{bulkResult.executionTimeMs}ms</div>
                    </div>
                  </div>
                  {bulkResult.errors.length > 0 && (
                    <div className="mt-3 text-sm text-red-400">
                      Errors: {bulkResult.errors.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {analysis && (
              <div className="space-y-3">
                <h3 className="font-semibold">Quick Actions by Namespace</h3>
                <p className="text-sm text-muted-foreground">
                  Click a namespace to set it as the delete pattern
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {analysis.namespaces.map((ns) => (
                    <Button
                      key={ns.namespace}
                      variant="outline"
                      className="justify-between"
                      onClick={() => setBulkPattern(`${ns.namespace}:*`)}
                    >
                      <span className="font-mono text-sm truncate">{ns.namespace}:*</span>
                      <Badge variant="secondary">{ns.keyCount}</Badge>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!analysis && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Database className="h-12 w-12 mb-4 opacity-50" />
            <p>Click Refresh to analyze the database</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
