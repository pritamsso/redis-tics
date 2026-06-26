import { useState, useEffect } from "react";
import { Plus, Trash2, Plug, Unplug, Heart, Github, Pencil, Sun, Moon } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RedisServer, ConnectionState } from "@/types";
import type { Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { isTauriRuntime } from "@/lib/tauriRuntime";

interface SidebarProps {
  servers: RedisServer[];
  activeServerId: string | null;
  connectionStates: Record<string, ConnectionState>;
  onSelectServer: (id: string) => void;
  onAddServer: () => void;
  onEditServer: (server: RedisServer) => void;
  onRemoveServer: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onAboutOpen: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Sidebar({
  servers,
  activeServerId,
  connectionStates,
  onSelectServer,
  onAddServer,
  onEditServer,
  onRemoveServer,
  onConnect,
  onDisconnect,
  onAboutOpen,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion(null));
  }, []);

  return (
    <div className="w-64 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.svg" alt="Redis Tics" className="w-10 h-10 rounded-xl shadow-lg" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Redis Tics</h1>
            <p className="text-xs text-muted-foreground">Monitor &amp; Manage</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Servers</span>
          <Button variant="ghost" size="icon" onClick={onAddServer} className="h-7 w-7">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
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
                    isActive
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-secondary"
                  )}
                  onClick={() => onSelectServer(server.id)}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      isConnected ? "bg-green-500" : "bg-muted-foreground"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{server.name}</div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <span className="truncate">
                        {server.host}:{server.port}
                      </span>
                      {server.tls && (
                        <span className="text-[10px] uppercase">TLS</span>
                      )}
                      {server.connectionMode === "cluster" && (
                        <span className="text-[10px] uppercase">Cluster</span>
                      )}
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
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditServer(server);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="p-4 border-t space-y-3">
        <Badge variant="secondary" className="w-full justify-center">
          {servers.length} server{servers.length !== 1 ? "s" : ""}
        </Badge>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> by
            <button
              onClick={() => {
                open("https://github.com/pritamsso").catch(console.error);
              }}
              className="text-red-500 hover:underline font-medium cursor-pointer active:opacity-70 transition-opacity"
            >
              @pritamsso
            </button>
          </p>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                open("https://redistics.com").catch(console.error);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground active:opacity-70 transition-all cursor-pointer"
            >
              🌐 redistics.com
            </button>
            <button
              onClick={() => {
                open("https://github.com/pritamsso/redis-tics").catch(
                  console.error
                );
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground active:opacity-70 transition-all cursor-pointer"
            >
              <Github className="h-3 w-3" />
              GitHub
            </button>
          </div>
        </div>

        {/* Version badge + theme toggle row */}
        <div className="flex items-center gap-2">
          {currentVersion && (
            <button
              onClick={onAboutOpen}
              title="About Redis Tics"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-secondary/50 hover:bg-secondary hover:border-primary/40 active:scale-[0.98] transition-all group"
            >
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-mono">
                v{currentVersion}
              </span>
              <span className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                • About
              </span>
            </button>
          )}

          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border/60 bg-secondary/50 hover:bg-secondary hover:border-primary/40 active:scale-[0.98] transition-all text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
