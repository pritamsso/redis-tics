import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { AddServerDialog } from "@/components/AddServerDialog";
import { ServerInfoPanel } from "@/components/ServerInfoPanel";
import { ClientsPanel } from "@/components/ClientsPanel";
import { MonitorPanel } from "@/components/MonitorPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { KeyBrowser } from "@/components/KeyBrowser";
import { RedisCLI } from "@/components/RedisCLI";
import { DatabaseAnalytics } from "@/components/DatabaseAnalytics";
import { Dashboard } from "@/components/Dashboard";
import { UpdateNotification } from "@/components/UpdateNotification";
import { AboutDialog } from "@/components/AboutDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Database, Key, Terminal, BarChart3, LayoutDashboard, Users, Activity, Server } from "lucide-react";
import { useRedis } from "@/hooks/useRedis";

function App() {
  const [showAddServer, setShowAddServer] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

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
            <header className="border-b bg-card/50 backdrop-blur-sm">
              <div className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                    RT
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-secondary/80 p-1 gap-1 border border-border rounded-lg">
                      <TabsTrigger value="dashboard" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </TabsTrigger>
                      <TabsTrigger value="keys" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <Key className="h-4 w-4" />
                        Keys
                      </TabsTrigger>
                      <TabsTrigger value="cli" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <Terminal className="h-4 w-4" />
                        CLI
                      </TabsTrigger>
                      <TabsTrigger value="db-analysis" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <BarChart3 className="h-4 w-4" />
                        Analysis
                      </TabsTrigger>
                      <TabsTrigger value="clients" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <Users className="h-4 w-4" />
                        Clients
                      </TabsTrigger>
                      <TabsTrigger value="monitor" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <Activity className="h-4 w-4" />
                        Monitor
                      </TabsTrigger>
                      <TabsTrigger value="info" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
                        <Server className="h-4 w-4" />
                        Info
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 border-border hover:bg-secondary">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <AboutDialog />
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="dashboard" className="h-[calc(100vh-180px)]">
                  <Dashboard
                    serverName={activeServer?.name || ""}
                    info={serverInfo[activeServerId]}
                    onNavigate={setActiveTab}
                  />
                </TabsContent>
                <TabsContent value="info">
                  <ServerInfoPanel
                    info={serverInfo[activeServerId]}
                    serverName={activeServer?.name || ""}
                  />
                </TabsContent>
                <TabsContent value="keys" className="h-[calc(100vh-180px)]">
                  <KeyBrowser serverId={activeServerId} />
                </TabsContent>
                <TabsContent value="cli" className="h-[calc(100vh-180px)]">
                  <RedisCLI serverId={activeServerId} />
                </TabsContent>
                <TabsContent value="db-analysis" className="h-[calc(100vh-180px)]">
                  <DatabaseAnalytics serverId={activeServerId} />
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
      <UpdateNotification />
    </div>
  );
}

export default App;
