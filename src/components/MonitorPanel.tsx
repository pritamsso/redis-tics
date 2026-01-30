import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Trash2, Filter, Globe, Terminal, BarChart3, X } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import type { MonitorEvent, IpStats, ConnectionState } from "@/types";
import { formatNumber } from "@/lib/utils";

interface MonitorPanelProps {
  events: MonitorEvent[];
  ipStats: Record<string, IpStats>;
  selectedIp: string | null;
  onSelectIp: (ip: string | null) => void;
  connectionState: ConnectionState | undefined;
  onStartMonitor: () => void;
  onStopMonitor: () => void;
  onClear: () => void;
}

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export function MonitorPanel({
  events,
  ipStats,
  selectedIp,
  onSelectIp,
  connectionState,
  onStartMonitor,
  onStopMonitor,
  onClear,
}: MonitorPanelProps) {
  const [commandFilter, setCommandFilter] = useState("");

  const isMonitoring = connectionState?.monitoring ?? false;

  const filteredEvents = useMemo(() => {
    if (!commandFilter) return events;
    return events.filter((e) => e.command.toLowerCase().includes(commandFilter.toLowerCase()));
  }, [events, commandFilter]);

  const commandStats = useMemo(() => {
    const stats: Record<string, number> = {};
    events.forEach((e) => {
      stats[e.command] = (stats[e.command] || 0) + 1;
    });
    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([command, count]) => ({ command, count }));
  }, [events]);

  const topIps = useMemo(() => {
    return Object.values(ipStats)
      .sort((a, b) => b.commandCount - a.commandCount)
      .slice(0, 10);
  }, [ipStats]);

  const pieData = commandStats.map((s, i) => ({
    name: s.command,
    value: s.count,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Real-time Monitor</h2>
          {isMonitoring && (
            <Badge variant="success" className="animate-pulse">
              LIVE
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isMonitoring ? (
            <Button onClick={onStartMonitor} className="gap-2">
              <Play className="h-4 w-4" /> Start Monitoring
            </Button>
          ) : (
            <Button variant="destructive" onClick={onStopMonitor} className="gap-2">
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}
          <Button variant="outline" onClick={onClear} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      {selectedIp && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm">Filtering by IP:</span>
          <Badge variant="default">{selectedIp}</Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => onSelectIp(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Commands</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(events.length)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique IPs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(ipStats).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Commands</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commandStats.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Command Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commandStats.length > 0 ? (
              <div className="flex gap-4">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={60}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {commandStats.map((s, i) => (
                    <div key={s.command} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-mono">{s.command}</span>
                      </div>
                      <span className="text-muted-foreground">{formatNumber(s.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                No data yet. Start monitoring to see command distribution.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Top IPs by Commands
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topIps.length > 0 ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topIps.slice(0, 5)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="ip" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="commandCount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                No data yet. Start monitoring to see IP activity.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Live Commands
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Filter commands..."
                value={commandFilter}
                onChange={(e) => setCommandFilter(e.target.value)}
                className="w-48 h-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                {isMonitoring ? "Waiting for commands..." : "Start monitoring to capture commands"}
              </div>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {filteredEvents.slice(0, 200).map((event, i) => (
                  <div
                    key={`${event.timestamp}-${i}`}
                    className="flex gap-2 p-2 rounded hover:bg-secondary cursor-pointer"
                    onClick={() => onSelectIp(event.clientIp)}
                  >
                    <span className="text-muted-foreground w-24 flex-shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className="text-blue-400 w-36 flex-shrink-0 truncate cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectIp(event.clientIp);
                      }}
                    >
                      {event.clientIp}:{event.clientPort}
                    </span>
                    <span className="text-green-400 w-16 flex-shrink-0">[{event.db}]</span>
                    <span className="text-yellow-400 font-semibold">{event.command}</span>
                    <span className="text-muted-foreground truncate">{event.args.join(" ")}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {topIps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              IP Address Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topIps.map((ip) => (
                <div
                  key={ip.ip}
                  className="p-4 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => onSelectIp(ip.ip)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-semibold">{ip.ip}</span>
                    <Badge variant="outline">{formatNumber(ip.commandCount)} cmds</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Last seen: {new Date(ip.lastSeen).toLocaleTimeString()}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(ip.commands)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([cmd, count]) => (
                        <Badge key={cmd} variant="secondary" className="text-xs">
                          {cmd}: {count}
                        </Badge>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
