import { Database, Plus, Trash2, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RedisServer, ConnectionState } from "@/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  servers: RedisServer[];
  activeServerId: string | null;
  connectionStates: Record<string, ConnectionState>;
  onSelectServer: (id: string) => void;
  onAddServer: () => void;
  onRemoveServer: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export function Sidebar({
  servers,
  activeServerId,
  connectionStates,
  onSelectServer,
  onAddServer,
  onRemoveServer,
  onConnect,
  onDisconnect,
}: SidebarProps) {
  return (
    <div className="w-64 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-[hsl(var(--redis))]" />
          <span className="font-semibold">Redis Servers</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onAddServer}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        {servers.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No servers added yet.
            <br />
            Click + to add one.
          </div>
        ) : (
          <div className="space-y-1">
            {servers.map((server) => {
              const state = connectionStates[server.id];
              const isConnected = state?.connected;
              const isActive = activeServerId === server.id;

              return (
                <div
                  key={server.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                    isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary"
                  )}
                  onClick={() => onSelectServer(server.id)}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isConnected ? "bg-green-500" : "bg-muted-foreground"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{server.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {server.host}:{server.port}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isConnected ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDisconnect(server.id);
                        }}
                      >
                        <Unplug className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConnect(server.id);
                        }}
                      >
                        <Plug className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveServer(server.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <Badge variant="secondary" className="w-full justify-center">
          {servers.length} server{servers.length !== 1 ? "s" : ""}
        </Badge>
      </div>
    </div>
  );
}
