import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Globe, Clock, Terminal } from "lucide-react";
import type { ClientInfo } from "@/types";

interface ClientsPanelProps {
  clients: ClientInfo[] | undefined;
  onSelectIp: (ip: string) => void;
}

export function ClientsPanel({ clients, onSelectIp }: ClientsPanelProps) {
  if (!clients || clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No connected clients
      </div>
    );
  }

  const ipCounts = clients.reduce((acc, client) => {
    acc[client.ip] = (acc[client.ip] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedIps = Object.entries(ipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique IPs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(ipCounts).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top IP</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{sortedIps[0]?.[0] || "N/A"}</div>
            <p className="text-xs text-muted-foreground">{sortedIps[0]?.[1] || 0} connections</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Top IPs by Connection Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedIps.map(([ip, count]) => (
              <div
                key={ip}
                className="flex items-center justify-between p-2 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => onSelectIp(ip)}
              >
                <span className="font-mono text-sm">{ip}</span>
                <Badge variant="secondary">{count} connections</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connected Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => onSelectIp(client.ip)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm">{client.addr}</span>
                    <Badge variant="outline">db{client.db}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Age: {client.age}s</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Idle: {client.idle}s</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Terminal className="h-3 w-3" />
                      <span>{client.cmd}</span>
                    </div>
                  </div>
                  {client.name && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Name: {client.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
