import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { RedisServer, RedisInfo, ClientInfo, MonitorEvent, IpStats, ConnectionState } from "@/types";

export function useRedis() {
  const [servers, setServers] = useState<RedisServer[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const [serverInfo, setServerInfo] = useState<Record<string, RedisInfo>>({});
  const [clients, setClients] = useState<Record<string, ClientInfo[]>>({});
  const [monitorEvents, setMonitorEvents] = useState<MonitorEvent[]>([]);
  const [ipStats, setIpStats] = useState<Record<string, IpStats>>({});
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    loadServers();
    setupEventListeners();
    return () => {
      if (unlistenRef.current) unlistenRef.current();
    };
  }, []);

  const setupEventListeners = async () => {
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
    try {
      const savedServers = await invoke<RedisServer[]>("get_servers");
      setServers(savedServers);
    } catch (error) {
      console.error("Failed to load servers:", error);
      setServers([]);
    }
  };

  const addServer = useCallback(async (server: Omit<RedisServer, "id">) => {
    let encryptedPassword = server.password;
    if (server.password) {
      try {
        encryptedPassword = await invoke<string>("encrypt_server_password", { password: server.password });
      } catch {
        // If encryption fails, store as-is (for dev mode)
      }
    }
    const newServer: RedisServer = { ...server, password: encryptedPassword, id: crypto.randomUUID() };
    const updatedServers = [...servers, newServer];
    setServers(updatedServers);
    await invoke("save_servers", { servers: updatedServers });
    return newServer;
  }, [servers]);

  const removeServer = useCallback(async (id: string) => {
    await disconnect(id);
    const updatedServers = servers.filter((s) => s.id !== id);
    setServers(updatedServers);
    await invoke("save_servers", { servers: updatedServers });
    if (activeServerId === id) setActiveServerId(null);
  }, [servers, activeServerId]);

  const connect = useCallback(async (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: false, monitoring: false } }));

    try {
      let decryptedPassword = server.password;
      if (server.password) {
        try {
          decryptedPassword = await invoke<string>("decrypt_server_password", { encrypted: server.password });
        } catch (decryptError) {
          console.warn("Password decryption failed, using as-is:", decryptError);
        }
      }
      const serverWithDecryptedPassword = { ...server, password: decryptedPassword };
      await invoke("connect_redis", { server: serverWithDecryptedPassword });
      setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: true, monitoring: false } }));
      setActiveServerId(serverId);
      await refreshInfo(serverId);
      await refreshClients(serverId);
    } catch (error) {
      console.error("Connection failed:", error);
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { serverId, connected: false, monitoring: false, error: String(error) },
      }));
    }
  }, [servers]);

  const disconnect = useCallback(async (serverId: string) => {
    try {
      await invoke("disconnect_redis", { serverId });
    } catch {}
    setConnectionStates((prev) => ({ ...prev, [serverId]: { serverId, connected: false, monitoring: false } }));
  }, []);

  const updateServer = useCallback(async (updatedServer: RedisServer) => {
    let encryptedPassword = updatedServer.password;
    if (updatedServer.password) {
      try {
        encryptedPassword = await invoke<string>("encrypt_server_password", { password: updatedServer.password });
      } catch {
        // If encryption fails, store as-is
      }
    }
    const serverToSave = { ...updatedServer, password: encryptedPassword };
    const updatedServers = servers.map((s) => (s.id === updatedServer.id ? serverToSave : s));
    setServers(updatedServers);
    await invoke("save_servers", { servers: updatedServers });

    const state = connectionStates[updatedServer.id];
    if (state?.connected) {
      await disconnect(updatedServer.id);
    }
  }, [servers, connectionStates, disconnect]);

  const refreshInfo = useCallback(async (serverId: string) => {
    try {
      const info = await invoke<RedisInfo>("get_redis_info", { serverId });
      setServerInfo((prev) => ({ ...prev, [serverId]: info }));
    } catch {}
  }, []);

  const refreshClients = useCallback(async (serverId: string) => {
    try {
      const clientList = await invoke<ClientInfo[]>("get_client_list", { serverId });
      setClients((prev) => ({ ...prev, [serverId]: clientList }));
    } catch {}
  }, []);

  const startMonitoring = useCallback(async (serverId: string) => {
    try {
      await invoke("start_monitor", { serverId });
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { ...prev[serverId], monitoring: true },
      }));
    } catch {}
  }, []);

  const stopMonitoring = useCallback(async (serverId: string) => {
    try {
      await invoke("stop_monitor", { serverId });
      setConnectionStates((prev) => ({
        ...prev,
        [serverId]: { ...prev[serverId], monitoring: false },
      }));
    } catch {}
  }, []);

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
  };
}
