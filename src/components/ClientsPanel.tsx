import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Globe, Clock, Terminal, Search, Tag } from "lucide-react";
import type { ClientInfo } from "@/types";

interface ClientsPanelProps {
  clients: ClientInfo[] | undefined;
  onSelectIp: (ip: string) => void;
}

export function ClientsPanel({ clients, onSelectIp }: ClientsPanelProps) {
  const [search, setSearch] = useState("");

  const ipData = useMemo(() => {
    if (!clients) return [];
    const grouped: Record<string, { count: number; names: Set<string> }> = {};
    for (const client of clients) {
      if (!grouped[client.ip]) {
        grouped[client.ip] = { count: 0, names: new Set() };
      }
      grouped[client.ip].count++;
      if (client.name) grouped[client.ip].names.add(client.name);
    }
    return Object.entries(grouped)
      .map(([ip, data]) => ({ ip, count: data.count, names: Array.from(data.names) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [clients]);

  const uniqueIpCount = useMemo(() => {
    if (!clients) return 0;
    return new Set(clients.map((c) => c.ip)).size;
  }, [clients]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.ip.toLowerCase().includes(q) ||
        c.addr.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.cmd.toLowerCase().includes(q),
    );
  }, [clients, search]);

  if (!clients || clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No connected clients
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
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
            <div className="text-2xl font-bold">{uniqueIpCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top IP</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{ipData[0]?.ip || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              {ipData[0]?.count || 0} connections
              {ipData[0]?.names.length ? ` · ${ipData[0].names[0]}` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Top IPs by Connection Count
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-2">
                {ipData.map(({ ip, count, names }) => (
                  <div
                    key={ip}
                    className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={() => onSelectIp(ip)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm">{ip}</div>
                      {names.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <Tag className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{names.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2 flex-shrink-0">
                      {count} conn
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Connected Clients
              </div>
              <Badge variant="outline" className="font-normal">
                {filteredClients.length}{search ? ` / ${clients.length}` : ""}
              </Badge>
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, IP, address, or command..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-[calc(100vh-430px)]">
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={() => onSelectIp(client.ip)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm truncate">{client.addr}</span>
                        {client.name && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {client.name}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2 flex-shrink-0">db{client.db}</Badge>
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
                  </div>
                ))}
                {filteredClients.length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No clients matching "{search}"
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
