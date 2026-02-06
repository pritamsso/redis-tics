import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  HardDrive, Cpu, Clock, AlertTriangle, Database, Server,
  Activity, Zap, RefreshCw, CheckCircle, XCircle, Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { AdvancedAnalytics } from "@/types";
import { formatBytes, formatNumber } from "@/lib/utils";

interface AnalyticsPanelProps {
  serverId: string;
}

export function AnalyticsPanel({ serverId }: AnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("commands");
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [latencyLoading, setLatencyLoading] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await invoke<AdvancedAnalytics>("get_advanced_analytics", { serverId });
      setAnalytics(data);
    } catch (e) {
      console.error("Failed to load analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMemoryAnalytics = async () => {
    if (analytics?.memoryStats) return; // Already loaded
    setMemoryLoading(true);
    try {
      const [memoryStats, memoryDoctor] = await invoke<[unknown, string | null]>("get_memory_analytics", { serverId });
      setAnalytics(prev => prev ? {
        ...prev,
        memoryStats: memoryStats as AdvancedAnalytics['memoryStats'],
        memoryDoctor: memoryDoctor ?? undefined,
      } : null);
    } catch (e) {
      console.error("Failed to load memory analytics:", e);
    } finally {
      setMemoryLoading(false);
    }
  };

  const loadLatencyAnalytics = async () => {
    if (analytics?.latencyDoctor) return; // Already loaded
    setLatencyLoading(true);
    try {
      const latencyDoctor = await invoke<string | null>("get_latency_analytics", { serverId });
      setAnalytics(prev => prev ? {
        ...prev,
        latencyDoctor: latencyDoctor ?? undefined,
      } : null);
    } catch (e) {
      console.error("Failed to load latency analytics:", e);
    } finally {
      setLatencyLoading(false);
    }
  };

  // Load heavy analytics when tab is selected
  useEffect(() => {
    if (activeTab === "memory" && analytics && !analytics.memoryStats) {
      loadMemoryAnalytics();
    } else if (activeTab === "diagnostics" && analytics && !analytics.latencyDoctor) {
      loadLatencyAnalytics();
    }
  }, [activeTab, analytics]);

  useEffect(() => {
    loadAnalytics();
  }, [serverId]);

  if (loading && !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-10 w-full max-w-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <Skeleton className="h-5 w-32 mb-4" />
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics && !loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Button onClick={loadAnalytics}>Load Analytics</Button>
      </div>
    );
  }

  const topCommands = analytics?.commandStats
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10) || [];

  const slowestCommands = analytics?.commandStats
    .filter(c => c.usecPerCall > 0)
    .sort((a, b) => b.usecPerCall - a.usecPerCall)
    .slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Advanced Analytics</h2>
        <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-2xl">
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
          <TabsTrigger value="slowlog">Slow Log</TabsTrigger>
          <TabsTrigger value="persistence">Persistence</TabsTrigger>
          <TabsTrigger value="cluster">Cluster</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="memory">
          {memoryLoading && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading memory analytics...
            </div>
          )}
          {!memoryLoading && !analytics?.memoryStats && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <HardDrive className="h-12 w-12 mb-4 opacity-50" />
              <p>Memory analytics will load automatically</p>
              <Button onClick={loadMemoryAnalytics} variant="outline" className="mt-4">
                Load Now
              </Button>
            </div>
          )}
          {analytics?.memoryStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Allocated</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(analytics.memoryStats.totalAllocated)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Peak: {formatBytes(analytics.memoryStats.peakAllocated)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Dataset Size</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(analytics.memoryStats.datasetBytes)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.memoryStats.datasetPercentage.toFixed(1)}% of total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fragmentation</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.memoryStats.fragmentationRatio.toFixed(2)}</div>
                  <Badge variant={analytics.memoryStats.fragmentationRatio > 1.5 ? "warning" : "success"} className="mt-1">
                    {analytics.memoryStats.fragmentationRatio > 1.5 ? "High" : "Normal"}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Keys Count</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(analytics.memoryStats.keysCount)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {formatBytes(analytics.memoryStats.keysBytesPerKey)}/key
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Client Memory</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(analytics.memoryStats.clientsNormal)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Replicas: {formatBytes(analytics.memoryStats.clientsSlaves)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overhead</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(analytics.memoryStats.dbHashtableOverhead)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Hashtable overhead</p>
                </CardContent>
              </Card>
            </div>
          )}

          {analytics?.memoryDoctor && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Memory Doctor Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-secondary p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {analytics.memoryDoctor}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="commands">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Commands by Calls</CardTitle>
              </CardHeader>
              <CardContent>
                {topCommands.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topCommands} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="command" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatNumber(v as number)} />
                        <Bar dataKey="calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No command stats available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slowest Commands (μs/call)</CardTitle>
              </CardHeader>
              <CardContent>
                {slowestCommands.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={slowestCommands} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="command" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => `${(v as number).toFixed(2)} μs`} />
                        <Bar dataKey="usecPerCall" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No latency data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Command Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2">Command</th>
                        <th className="text-right py-2">Calls</th>
                        <th className="text-right py-2">Total Time (μs)</th>
                        <th className="text-right py-2">Avg (μs)</th>
                        <th className="text-right py-2">Rejected</th>
                        <th className="text-right py-2">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCommands.map((cmd) => (
                        <tr key={cmd.command} className="border-b border-secondary">
                          <td className="py-2 font-mono">{cmd.command}</td>
                          <td className="py-2 text-right">{formatNumber(cmd.calls)}</td>
                          <td className="py-2 text-right">{formatNumber(cmd.usec)}</td>
                          <td className="py-2 text-right">{cmd.usecPerCall.toFixed(2)}</td>
                          <td className="py-2 text-right text-yellow-500">{cmd.rejectedCalls}</td>
                          <td className="py-2 text-right text-red-500">{cmd.failedCalls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="slowlog">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Slow Log Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.slowLog && analytics.slowLog.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {analytics.slowLog.map((entry) => (
                      <div key={entry.id} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.durationUs > 100000 ? "destructive" : entry.durationUs > 10000 ? "warning" : "secondary"}>
                              {(entry.durationUs / 1000).toFixed(2)} ms
                            </Badge>
                            <span className="font-mono font-semibold text-yellow-400">{entry.command}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm font-mono text-muted-foreground truncate">
                          {entry.args.join(" ")}
                        </div>
                        {entry.clientAddr && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Client: {entry.clientAddr} {entry.clientName && `(${entry.clientName})`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                  <p>No slow queries recorded</p>
                  <p className="text-xs mt-1">Configure slowlog-log-slower-than to capture slow queries</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="persistence">
          {analytics?.persistence && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    RDB Persistence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last Save</span>
                    <span>{new Date(analytics.persistence.rdbLastSaveTime * 1000).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Changes Since Last Save</span>
                    <Badge variant={analytics.persistence.rdbChangesSinceLastSave > 1000 ? "warning" : "secondary"}>
                      {formatNumber(analytics.persistence.rdbChangesSinceLastSave)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last BGSAVE Status</span>
                    <Badge variant={analytics.persistence.rdbLastBgsaveStatus === "ok" ? "success" : "destructive"}>
                      {analytics.persistence.rdbLastBgsaveStatus}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Last BGSAVE Time</span>
                    <span>{analytics.persistence.rdbLastBgsaveTimeSec >= 0 ? `${analytics.persistence.rdbLastBgsaveTimeSec}s` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">BGSAVE In Progress</span>
                    {analytics.persistence.rdbBgsaveInProgress ? (
                      <Badge variant="warning" className="animate-pulse">Running</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    AOF Persistence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">AOF Enabled</span>
                    {analytics.persistence.aofEnabled ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  {analytics.persistence.aofEnabled && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Current Size</span>
                        <span>{formatBytes(analytics.persistence.aofCurrentSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Base Size</span>
                        <span>{formatBytes(analytics.persistence.aofBaseSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Rewrite Status</span>
                        <Badge variant={analytics.persistence.aofLastBgrewriteStatus === "ok" ? "success" : "destructive"}>
                          {analytics.persistence.aofLastBgrewriteStatus || "N/A"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Rewrite In Progress</span>
                        {analytics.persistence.aofRewriteInProgress ? (
                          <Badge variant="warning" className="animate-pulse">Running</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {analytics.cpuStats && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      CPU Usage (seconds)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <div className="text-2xl font-bold">{analytics.cpuStats.usedCpuSys.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">System</div>
                      </div>
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <div className="text-2xl font-bold">{analytics.cpuStats.usedCpuUser.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">User</div>
                      </div>
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <div className="text-2xl font-bold">{analytics.cpuStats.usedCpuSysChildren.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Sys Children</div>
                      </div>
                      <div className="text-center p-4 bg-secondary rounded-lg">
                        <div className="text-2xl font-bold">{analytics.cpuStats.usedCpuUserChildren.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">User Children</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cluster">
          {analytics?.clusterInfo ? (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Cluster State</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={analytics.clusterInfo.clusterState === "ok" ? "success" : "destructive"} className="text-lg">
                      {analytics.clusterInfo.clusterState.toUpperCase()}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Known Nodes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.clusterInfo.clusterKnownNodes}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Cluster Size</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.clusterInfo.clusterSize}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Slots OK</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.clusterInfo.clusterSlotsOk}</div>
                    <p className="text-xs text-muted-foreground">
                      of {analytics.clusterInfo.clusterSlotsAssigned} assigned
                    </p>
                  </CardContent>
                </Card>
              </div>

              {analytics.clusterNodes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Cluster Nodes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {analytics.clusterNodes.map((node) => (
                          <div key={node.id} className="p-3 bg-secondary rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-sm">{node.addr}</span>
                              <div className="flex gap-1">
                                {node.flags.split(",").map((flag) => (
                                  <Badge key={flag} variant={flag.includes("master") ? "default" : "secondary"} className="text-xs">
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ID: {node.id.slice(0, 16)}... | Link: {node.linkState}
                              {node.slots.length > 0 && ` | Slots: ${node.slots.join(", ")}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="mt-4">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Server className="h-12 w-12 mb-2" />
                  <p>Cluster mode is not enabled</p>
                  <p className="text-xs mt-1">This Redis instance is running in standalone mode</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="diagnostics">
          <div className="space-y-4 mt-4">
            {latencyLoading && (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading latency diagnostics...
              </div>
            )}
            {analytics?.latencyDoctor && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Latency Doctor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-secondary p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {analytics.latencyDoctor}
                  </pre>
                </CardContent>
              </Card>
            )}

            {analytics?.errorStats && analytics.errorStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    Error Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {analytics.errorStats.map((err) => (
                      <div key={err.errorType} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="text-2xl font-bold text-red-400">{formatNumber(err.count)}</div>
                        <div className="text-xs text-muted-foreground">{err.errorType}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {(!analytics?.errorStats || analytics.errorStats.length === 0) && (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                    <p>No errors recorded</p>
                    <p className="text-xs mt-1">Your Redis instance is running without errors</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
