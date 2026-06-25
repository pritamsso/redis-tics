import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { RedisServer, RedisInfo, ClientInfo, MonitorEvent, IpStats, ConnectionState, AppLogEntry, AppLogLevel } from "@/types";
import { isTauriRuntime } from "@/lib/tauriRuntime";

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function describeConsoleArg(arg: unknown) {
  if (arg instanceof Error) return `${arg.message}${arg.stack ? `\n${arg.stack}` : ""}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function useRedis() {
  const [servers, setServers] = useState<RedisServer[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const [serverInfo, setServerInfo] = useState<Record<string, RedisInfo>>({});
  const [clients, setClients] = useState<Record<string, ClientInfo[]>>({});
  const [monitorEvents, setMonitorEvents] = useState<MonitorEvent[]>([]);
  const [ipStats, setIpStats] = useState<Record<string, IpStats>>({});
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const addLog = useCallback((
    level: AppLogLevel,
    source: string,
    message: string,
    details?: unknown,
    serverId?: string,
  ) => {
    const entry: AppLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details: details === undefined ? undefined : describeError(details),
      serverId,
    };
    setLogs((prev) => {
      const latest = prev[0];
      if (
        latest &&
        latest.level === entry.level &&
        latest.source === entry.source &&
        latest.message === entry.message &&
        latest.details === entry.details &&
        Date.parse(entry.timestamp) - Date.parse(latest.timestamp) < 1000
      ) {
        return prev;
      }
      return [entry, ...prev].slice(0, 500);
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: unknown[]) => {
      addLog("error", "console", args.map(describeConsoleArg).join(" "));
      originalError(...args);
    };
    console.warn = (...args: unknown[]) => {
      addLog("warn", "console", args.map(describeConsoleArg).join(" "));
      originalWarn(...args);
    };

    const onError = (event: ErrorEvent) => {
      addLog("error", "runtime", event.message, event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog("error", "runtime", "Unhandled promise rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [addLog]);

  useEffect(() => {
    loadServers();
    setupEventListeners();
    return () => {
      if (unlistenRef.current) unlistenRef.current();
    };
  }, []);

  const setupEventListeners = async () => {
    if (!isTauriRuntime()) {
      return;
    }

    unlistenRef.current = await listen<MonitorEvent>("redis-monitor", (event) => {
      const data = event.payload;
      setMonitorEvents((prev) => [data, ...prev].slice(0, 1000));
      updateIpStats(data);
    });
  };

  const updateIpStats = (event: MonitorEvent) => {
    setIpStats((prev) => {
      const ip = event.clientIp;
      const existing = prev[ip] || { ip, commandCount: 0, lastSeen: 0, commands: {}, bytesProcessed: 0 };
      return {
        ...prev,
        [ip]: {
          ...existing,
          commandCount: existing.commandCount + 1,
          lastSeen: event.timestamp,
          commands: {
            ...existing.commands,
            [event.command]: (existing.commands[event.command] || 0) + 1,
          },
          bytesProcessed: existing.bytesProcessed + event.raw.length,
        },
      };
    });
  };

  const loadServers = async () => {
    if (!isTauriRuntime()) {
      setServers([]);
      return;
    }

    try {
      const savedServers = await invoke<RedisServer[]>("get_servers");
      setServers(savedServers);
      addLog("debug", "config", `Loaded ${savedServers.length} saved server${savedServers.length === 1 ? "" : "s"}`);
    } catch (error) {
      addLog("error", "config", "Failed to load saved Redis servers", error);
      setServers([]);
    }
  };

  const addServer = useCallback(async (server: Omit<RedisServer, "id">) => {
    if (!isTauriRuntime()) {
      addLog("warn", "runtime", "Servers can only be saved inside the desktop app");
      return { ...server, id: crypto.randomUUID() };
    }

    let encryptedPassword = server.password;
    if (server.password) {
      try {
        encryptedPassword = await invoke<string>("encrypt_server_password", { password: server.password });
      } catch (error) {
        // If encryption fails, store as-is (for dev mode)
        addLog("warn", "crypto", "Password encryption failed; saving password as provided", error);
      }
    }
    const newServer: RedisServer = { ...server, password: encryptedPassword, id: crypto.randomUUID() };
    const updatedServers = [...servers, newServer];
    setServers(updatedServers);
    await invoke("save_servers", { servers: updatedServers });
    addLog(
      "info",
      "config",
      `Added ${server.connectionMode === "cluster" ? "cluster" : "standalone"} server ${server.name || `${server.host}:${server.port}`}`,
      `host=${server.host} port=${server.port} tls=${Boolean(server.tls)} db=${server.db ?? 0}`,
      newServer.id,
    );
    return newServer;
  }, [servers, addLog]);

  const removeServer = useCallback(async (id: string) => {
    if (!isTauriRuntime()) {
      setServers((prev) => prev.filter((server) => server.id !== id));
      addLog("warn", "runtime", "Server removal is temporary in browser preview", undefined, id);
      if (activeServerId === id) setActiveServerId(null);
      return;
    }

    await disconnect(id);
    const updatedServers = servers.filter((s) => s.id !== id);
    setServers(updatedServers);
    await invoke("save_servers", { servers: updatedServers });
    addLog("info", "config", "Removed Redis server", undefined, id);
    if (activeServerId === id) setActiveServerId(null);
  }, [servers, activeServerId, addLog]);

  const connect = useCallback(async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: false, monitoring: false } }));
    addLog(
      "info",
      "connection",
      `Connecting to ${server.name || `${server.host}:${server.port}`}`,
      `host=${server.host} port=${server.port} tls=${Boolean(server.tls)} mode=${server.connectionMode || "standalone"} db=${server.connectionMode === "cluster" ? 0 : server.db ?? 0}`,
      serverId,
    );

    if (!isTauriRuntime()) {
      const message = "Redis connections require the desktop app runtime";
      addLog("warn", "runtime", message, "Open the Tauri desktop app to connect to Redis. Browser preview can render the UI but cannot call native Redis commands.", serverId);
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { serverId, connected: false, monitoring: false, error: message },
      }));
      return;
    }

    try {
      let decryptedPassword = server.password;
      if (server.password) {
        try {
          decryptedPassword = await invoke<string>("decrypt_server_password", { encrypted: server.password });
        } catch (decryptError) {
          console.warn("Password decryption failed, using as-is:", decryptError);
          addLog("warn", "crypto", "Password decryption failed; using stored value as-is", decryptError, serverId);
        }
      }
      const serverWithDecryptedPassword = { ...server, password: decryptedPassword };
      await invoke("connect_redis", { server: serverWithDecryptedPassword });
      setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: true, monitoring: false } }));
      setActiveServerId(serverId);
      addLog("success", "connection", `Connected to ${server.name || `${server.host}:${server.port}`}`, undefined, serverId);
      await refreshInfo(serverId);
      await refreshClients(serverId);
    } catch (error) {
      addLog("error", "connection", `Connection failed for ${server.name || `${server.host}:${server.port}`}`, error, serverId);
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { serverId, connected: false, monitoring: false, error: String(error) },
      }));
    }
  }, [servers, addLog]);

  const disconnect = useCallback(async (serverId: string) => {
    if (!isTauriRuntime()) {
      setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: false, monitoring: false } }));
      return;
    }

    try {
      await invoke("disconnect_redis", { serverId });
      addLog("info", "connection", "Disconnected from Redis server", undefined, serverId);
    } catch (error) {
      addLog("warn", "connection", "Disconnect command failed", error, serverId);
    }
    setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: false, monitoring: false } }));
  }, [addLog]);

  const updateServer = useCallback(async (updatedServer: RedisServer) => {
    if (!isTauriRuntime()) {
      setServers((prev) => prev.map((server) => (server.id === updatedServer.id ? updatedServer : server)));
      addLog("warn", "runtime", "Server updates are temporary in browser preview", undefined, updatedServer.id);
      return;
    }

    let encryptedPassword = updatedServer.password;
    if (updatedServer.password) {
      try {
        encryptedPassword = await invoke<string>("encrypt_server_password", { password: updatedServer.password });
      } catch (error) {
        // If encryption fails, store as-is
        addLog("warn", "crypto", "Password encryption failed while updating server", error, updatedServer.id);
      }
    }
    const serverToSave = { ...updatedServer, password: encryptedPassword };
    const updatedServers = servers.map((s) => (s.id === updatedServer.id ? serverToSave : s));
    setServers(updatedServers);
    await invoke("save_servers", { servers: updatedServers });
    addLog("info", "config", `Updated server ${updatedServer.name || `${updatedServer.host}:${updatedServer.port}`}`, undefined, updatedServer.id);

    const state = connectionStates[updatedServer.id];
    if (state?.connected) {
      await disconnect(updatedServer.id);
    }
  }, [servers, connectionStates, disconnect, addLog]);

  const refreshInfo = useCallback(async (serverId: string) => {
    if (!isTauriRuntime()) return;

    try {
      const info = await invoke<RedisInfo>("get_redis_info", { serverId });
      setServerInfo((prev) => ({ ...prev, [serverId]: info }));
      addLog("debug", "info", "Refreshed INFO data", undefined, serverId);
    } catch (error) {
      addLog("warn", "info", "Failed to refresh INFO data", error, serverId);
    }
  }, [addLog]);

  const refreshClients = useCallback(async (serverId: string) => {
    if (!isTauriRuntime()) return;

    try {
      const clientList = await invoke<ClientInfo[]>("get_client_list", { serverId });
      setClients((prev) => ({ ...prev, [serverId]: clientList }));
      addLog("debug", "clients", `Refreshed client list (${clientList.length} clients)`, undefined, serverId);
    } catch (error) {
      addLog("warn", "clients", "Failed to refresh client list", error, serverId);
    }
  }, [addLog]);

  const startMonitoring = useCallback(async (serverId: string) => {
    if (!isTauriRuntime()) {
      addLog("warn", "runtime", "MONITOR requires the desktop app runtime", undefined, serverId);
      return;
    }

    try {
      await invoke("start_monitor", { serverId });
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { ...prev[serverId], monitoring: true },
      }));
      addLog("success", "monitor", "Started MONITOR stream", undefined, serverId);
    } catch (error) {
      addLog("error", "monitor", "Failed to start MONITOR stream", error, serverId);
    }
  }, [addLog]);

  const stopMonitoring = useCallback(async (serverId: string) => {
    if (!isTauriRuntime()) return;

    try {
      await invoke("stop_monitor", { serverId });
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { ...prev[serverId], monitoring: false },
      }));
      addLog("info", "monitor", "Stopped MONITOR stream", undefined, serverId);
    } catch (error) {
      addLog("warn", "monitor", "Failed to stop MONITOR stream", error, serverId);
    }
  }, [addLog]);

  const clearMonitorEvents = useCallback(() => {
    setMonitorEvents([]);
    setIpStats({});
  }, []);

  const filteredEvents = selectedIp
    ? monitorEvents.filter((e) => e.clientIp === selectedIp)
    : monitorEvents;

  return {
    servers,
    activeServerId,
    setActiveServerId,
    connectionStates,
    logs,
    serverInfo,
    clients,
    monitorEvents: filteredEvents,
    ipStats,
    selectedIp,
    setSelectedIp,
    addServer,
    updateServer,
    removeServer,
    connect,
    disconnect,
    refreshInfo,
    refreshClients,
    startMonitoring,
    stopMonitoring,
    clearMonitorEvents,
    addLog,
    clearLogs,
  };
}
