import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AddServerDialog } from "@/components/AddServerDialog";
import { ServerInfoPanel } from "@/components/ServerInfoPanel";
import { ClientsPanel } from "@/components/ClientsPanel";
import { MonitorPanel } from "@/components/MonitorPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database } from "lucide-react";
import { useRedis } from "@/hooks/useRedis";

function App() {
  const [showAddServer, setShowAddServer] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  const {
    servers,
    activeServerId,
    setActiveServerId,
    connectionStates,
    serverInfo,
    clients,
    monitorEvents,
    ipStats,
    selectedIp,
    setSelectedIp,
    addServer,
    removeServer,
    connect,
    disconnect,
    refreshInfo,
    refreshClients,
    startMonitoring,
    stopMonitoring,
    clearMonitorEvents,
  } = useRedis();

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeState = activeServerId ? connectionStates[activeServerId] : undefined;
  const isConnected = activeState?.connected ?? false;

  const handleSelectServer = (id: string) => {
    setActiveServerId(id);
    const state = connectionStates[id];
    if (!state?.connected) {
      connect(id);
    }
  };

  const handleRefresh = () => {
    if (activeServerId) {
      refreshInfo(activeServerId);
      refreshClients(activeServerId);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        servers={servers}
        activeServerId={activeServerId}
        connectionStates={connectionStates}
        onSelectServer={handleSelectServer}
        onAddServer={() => setShowAddServer(true)}
        onRemoveServer={removeServer}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {!activeServerId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Database className="h-16 w-16 mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No Server Selected</h2>
            <p className="text-sm mb-4">Select a server from the sidebar or add a new one</p>
            <Button onClick={() => setShowAddServer(true)}>Add Redis Server</Button>
          </div>
        ) : !isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Database className="h-16 w-16 mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Not Connected</h2>
            <p className="text-sm mb-4">
              {activeState?.error || "Click connect to establish connection"}
            </p>
            <Button onClick={() => connect(activeServerId)}>Connect</Button>
          </div>
        ) : (
          <>
            <header className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="info">Server Info</TabsTrigger>
                    <TabsTrigger value="clients">Clients</TabsTrigger>
                    <TabsTrigger value="monitor">Monitor</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </header>

            <div className="flex-1 overflow-auto p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="info">
                  <ServerInfoPanel
                    info={serverInfo[activeServerId]}
                    serverName={activeServer?.name || ""}
                  />
                </TabsContent>
                <TabsContent value="clients">
                  <ClientsPanel
                    clients={clients[activeServerId]}
                    onSelectIp={(ip) => {
                      setSelectedIp(ip);
                      setActiveTab("monitor");
                    }}
                  />
                </TabsContent>
                <TabsContent value="monitor">
                  <MonitorPanel
                    events={monitorEvents}
                    ipStats={ipStats}
                    selectedIp={selectedIp}
                    onSelectIp={setSelectedIp}
                    connectionState={activeState}
                    onStartMonitor={() => startMonitoring(activeServerId)}
                    onStopMonitor={() => stopMonitoring(activeServerId)}
                    onClear={clearMonitorEvents}
                  />
                </TabsContent>
                <TabsContent value="analytics">
                  <AnalyticsPanel serverId={activeServerId} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </main>

      <AddServerDialog
        open={showAddServer}
        onOpenChange={setShowAddServer}
        onAdd={addServer}
      />
    </div>
  );
}

export default App;
