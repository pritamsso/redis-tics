import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, Activity, Clock, Database, Gauge, Network, RefreshCw, Server, Terminal, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { NodeInvestigation, RedisInvestigation } from "@/types";
import { formatBytes, formatNumber } from "@/lib/utils";

interface InvestigationPanelProps {
  serverId: string;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function duration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function roleLabel(role: string) {
  if (role === "master") return "primary";
  if (role === "slave") return "replica";
  return role || "unknown";
}

function findingVariant(level: string) {
  if (level === "critical") return "destructive" as const;
  if (level === "warning") return "warning" as const;
  return "secondary" as const;
}

function pressureLabel(score: number) {
  if (score >= 70) return "high";
  if (score >= 40) return "elevated";
  return "normal";
}

function Bar({ value, tone = "bg-primary" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Gauge }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function NodeCard({ node }: { node: NodeInvestigation }) {
  const memoryPct = node.maxMemory > 0 ? (node.usedMemory / node.maxMemory) * 100 : 0;
  const clientPct = node.maxClients > 0 ? (node.connectedClients / node.maxClients) * 100 : 0;
  const topCommands = node.clientsByCommand.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              <span className="truncate">{node.endpoint}</span>
            </CardTitle>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant={node.role === "master" || node.role === "primary" ? "default" : "secondary"}>
                {roleLabel(node.role)}
              </Badge>
              {node.clusterFlags.map((flag) => (
                <Badge key={flag} variant="outline">
                  {flag === "master" ? "primary" : flag === "slave" ? "replica" : flag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{formatNumber(node.opsPerSec)} ops/s</div>
            <div className="text-muted-foreground">{pct(node.hitRate)} hit rate</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>Memory</span>
              <span>{node.maxMemory > 0 ? `${memoryPct.toFixed(0)}%` : "n/a"}</span>
            </div>
            <Bar value={memoryPct} tone={memoryPct > 85 ? "bg-yellow-500" : "bg-primary"} />
            <div className="mt-1 text-xs text-muted-foreground">
              {node.usedMemoryHuman || formatBytes(node.usedMemory)}
              {node.maxMemory > 0 ? ` / ${formatBytes(node.maxMemory)}` : ""}
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>Clients</span>
              <span>{node.maxClients > 0 ? `${clientPct.toFixed(0)}%` : "n/a"}</span>
            </div>
            <Bar value={clientPct} tone={clientPct > 80 ? "bg-yellow-500" : "bg-primary"} />
            <div className="mt-1 text-xs text-muted-foreground">
              {node.connectedClients}
              {node.maxClients > 0 ? ` / ${node.maxClients}` : ""} connected
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="rounded-md bg-secondary/50 p-2">
            <div className="text-muted-foreground">Blocked</div>
            <div className="font-semibold">{node.blockedClients}</div>
          </div>
          <div className="rounded-md bg-secondary/50 p-2">
            <div className="text-muted-foreground">Fragmentation</div>
            <div className="font-semibold">{node.memFragmentationRatio.toFixed(2)}</div>
          </div>
          <div className="rounded-md bg-secondary/50 p-2">
            <div className="text-muted-foreground">Input</div>
            <div className="font-semibold">{node.instantaneousInputKbps.toFixed(1)} KB/s</div>
          </div>
          <div className="rounded-md bg-secondary/50 p-2">
            <div className="text-muted-foreground">Output</div>
            <div className="font-semibold">{node.instantaneousOutputKbps.toFixed(1)} KB/s</div>
          </div>
        </div>

        {node.notes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {node.notes.map((note) => (
              <Badge key={note} variant="warning">{note}</Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Terminal className="h-4 w-4" />
              Client Commands
            </div>
            <div className="space-y-2">
              {topCommands.length > 0 ? topCommands.map((cmd) => (
                <div key={cmd.command} className="flex items-center gap-2 text-sm">
                  <span className="w-24 truncate font-mono">{cmd.command || "NULL"}</span>
                  <Bar value={(cmd.clientCount / Math.max(1, node.connectedClients)) * 100} />
                  <span className="w-10 text-right text-muted-foreground">{cmd.clientCount}</span>
                </div>
              )) : <div className="text-sm text-muted-foreground">No clients reporting commands</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" />
              Clients to Inspect
            </div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {node.topClients.slice(0, 8).map((client) => (
                <div key={client.id} className="rounded-md bg-secondary/40 p-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-mono truncate">{client.addr}</span>
                    <Badge variant="outline" className="shrink-0">{client.cmd || "NULL"}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    idle {duration(client.idle)} · qbuf {formatBytes(client.qbuf)} · obl {formatBytes(client.obl)}
                    {client.name ? ` · ${client.name}` : ""}
                  </div>
                </div>
              ))}
              {node.topClients.length === 0 && <div className="text-sm text-muted-foreground">No connected clients</div>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvestigationPanel({ serverId }: InvestigationPanelProps) {
  const [data, setData] = useState<RedisInvestigation | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<"nodes" | "commands" | "latency">("nodes");

  const load = async () => {
    setLoading(true);
    try {
      setData(await invoke<RedisInvestigation>("investigate_redis", { serverId }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [serverId]);

  const slowCommands = useMemo(() => {
    return (data?.nodes || [])
      .flatMap((node) => node.commandStats.map((cmd) => ({ ...cmd, node: node.endpoint })))
      .sort((a, b) => b.usecPerCall - a.usecPerCall)
      .slice(0, 20);
  }, [data]);

  const latencyEvents = useMemo(() => {
    return (data?.nodes || [])
      .flatMap((node) => node.latencyEvents.map((event) => ({ ...event, node: node.endpoint })))
      .sort((a, b) => b.maxMs - a.maxMs);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-56" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Button onClick={load}>Run Investigation</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant={activeView === "nodes" ? "default" : "outline"} size="sm" onClick={() => setActiveView("nodes")}>
            <Network className="mr-2 h-4 w-4" />
            Nodes
          </Button>
          <Button variant={activeView === "commands" ? "default" : "outline"} size="sm" onClick={() => setActiveView("commands")}>
            <Terminal className="mr-2 h-4 w-4" />
            Commands
          </Button>
          <Button variant={activeView === "latency" ? "default" : "outline"} size="sm" onClick={() => setActiveView("latency")}>
            <Clock className="mr-2 h-4 w-4" />
            Latency
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Metric label="Pressure" value={`${data.summary.pressureScore} ${pressureLabel(data.summary.pressureScore)}`} icon={Gauge} />
        <Metric label="Nodes" value={`${data.summary.nodeCount}`} icon={Server} />
        <Metric label="Clients" value={formatNumber(data.summary.connectedClients)} icon={Users} />
        <Metric label="Ops/Sec" value={formatNumber(data.summary.opsPerSec)} icon={Activity} />
        <Metric label="Memory" value={formatBytes(data.summary.usedMemory)} icon={Database} />
        <Metric label="Hit Rate" value={pct(data.summary.hitRate)} icon={Zap} />
      </div>

      {data.findings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {data.findings.map((finding, index) => (
                <div key={`${finding.title}-${index}`} className="flex gap-3 rounded-md border bg-secondary/30 p-3">
                  <Badge variant={findingVariant(finding.level)} className="h-fit">{finding.level}</Badge>
                  <div className="min-w-0">
                    <div className="font-medium">{finding.title}</div>
                    <div className="text-sm text-muted-foreground">{finding.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === "nodes" && (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          {data.nodes.map((node) => <NodeCard key={node.nodeId} node={node} />)}
        </div>
      )}

      {activeView === "commands" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Slowest Command Families</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <div className="space-y-2">
                  {slowCommands.map((cmd) => (
                    <div key={`${cmd.node}-${cmd.command}`} className="rounded-md bg-secondary/40 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono font-semibold">{cmd.command}</span>
                        <Badge variant={cmd.usecPerCall > 10_000 ? "warning" : "secondary"}>
                          {cmd.usecPerCall.toFixed(2)} us/call
                        </Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {cmd.node} · {formatNumber(cmd.calls)} calls · failed {cmd.failedCalls} · rejected {cmd.rejectedCalls}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Slow Log</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <div className="space-y-2">
                  {data.nodes.flatMap((node) => node.slowLog.map((entry) => ({ ...entry, node: node.endpoint }))).map((entry) => (
                    <div key={`${entry.node}-${entry.id}`} className="rounded-md bg-secondary/40 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono font-semibold">{entry.command}</span>
                        <Badge variant={entry.durationUs > 100_000 ? "destructive" : "warning"}>
                          {(entry.durationUs / 1000).toFixed(2)} ms
                        </Badge>
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{entry.args.join(" ")}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{entry.node}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === "latency" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Latency Events</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {latencyEvents.map((event) => (
                  <div key={`${event.node}-${event.event}`} className="rounded-md bg-secondary/40 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{event.event}</span>
                      <Badge variant={event.maxMs > 100 ? "warning" : "secondary"}>{event.maxMs} ms max</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">{event.node} · latest {event.latestMs} ms</div>
                  </div>
                ))}
                {latencyEvents.length === 0 && <div className="text-sm text-muted-foreground">No latency events reported</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Errors and Evictions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.nodes.map((node) => (
                  <div key={node.nodeId} className="rounded-md bg-secondary/40 p-3 text-sm">
                    <div className="font-semibold">{node.endpoint}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div><span className="text-muted-foreground">Evicted</span><div>{formatNumber(node.evictedKeys)}</div></div>
                      <div><span className="text-muted-foreground">Expired</span><div>{formatNumber(node.expiredKeys)}</div></div>
                      <div><span className="text-muted-foreground">Rejected</span><div>{formatNumber(node.rejectedConnections)}</div></div>
                    </div>
                    {node.errorStats.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {node.errorStats.map((err) => <Badge key={err.errorType} variant="outline">{err.errorType}: {err.count}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
