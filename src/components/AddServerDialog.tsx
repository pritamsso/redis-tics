import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2 } from "lucide-react";
import type { RedisServer } from "@/types";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (server: Omit<RedisServer, "id">) => void;
}

export function AddServerDialog({ open, onOpenChange, onAdd }: AddServerDialogProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("6379");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [db, setDb] = useState("0");
  const [tls, setTls] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState("");
  const [useUrl, setUseUrl] = useState(false);

  const parseRedisUrl = (url: string) => {
    try {
      const cleanUrl = url.replace(/^redis-cli\s+-u\s+/, "").trim();
      const urlObj = new URL(cleanUrl);
      
      setHost(urlObj.hostname);
      setPort(urlObj.port || "6379");
      setTls(urlObj.protocol === "rediss:");
      
      if (urlObj.username && urlObj.username !== "") {
        setUsername(decodeURIComponent(urlObj.username));
      }
      if (urlObj.password) {
        setPassword(decodeURIComponent(urlObj.password));
      }
      if (urlObj.pathname && urlObj.pathname !== "/") {
        const dbNum = urlObj.pathname.replace("/", "");
        if (dbNum) setDb(dbNum);
      }
      
      setName(`${urlObj.hostname}:${urlObj.port || "6379"}`);
    } catch {
      console.error("Failed to parse Redis URL");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name: name || `${host}:${port}`,
      host,
      port: parseInt(port, 10),
      username: username || undefined,
      password: password || undefined,
      db: parseInt(db, 10),
      tls,
    });
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName("");
    setHost("localhost");
    setPort("6379");
    setUsername("");
    setPassword("");
    setDb("0");
    setTls(false);
    setConnectionUrl("");
    setUseUrl(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Add Redis Server</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border">
            <input
              type="checkbox"
              id="useUrl"
              checked={useUrl}
              onChange={(e) => setUseUrl(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="useUrl" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <Link2 className="h-4 w-4" />
              Import from connection URL
            </label>
          </div>

          {useUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Connection URL</label>
              <Input
                placeholder="redis://user:password@host:port/db or rediss://..."
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                onBlur={() => {
                  if (connectionUrl) parseRedisUrl(connectionUrl);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Paste your Redis URL (e.g., redis://default:password@host:port)
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Name (optional)</label>
            <Input
              placeholder="My Redis Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Host</label>
              <Input
                placeholder="localhost"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Port</label>
              <Input
                type="number"
                placeholder="6379"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username (optional)</label>
              <Input
                placeholder="default"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password (optional)</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Database</label>
              <Input
                type="number"
                placeholder="0"
                value={db}
                onChange={(e) => setDb(e.target.value)}
                min="0"
                max="15"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border cursor-pointer w-full justify-center">
                <input
                  type="checkbox"
                  checked={tls}
                  onChange={(e) => setTls(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Use TLS/SSL</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Server</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
