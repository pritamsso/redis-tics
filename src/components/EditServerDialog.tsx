import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import type { RedisServer } from "@/types";

interface EditServerDialogProps {
  server: RedisServer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (server: RedisServer) => void;
}

export function EditServerDialog({ server, open, onOpenChange, onSave }: EditServerDialogProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [db, setDb] = useState("0");
  const [tls, setTls] = useState(false);

  useEffect(() => {
    if (server) {
      setName(server.name);
      setHost(server.host);
      setPort(String(server.port));
      setUsername(server.username || "");
      setPassword(server.password || "");
      setDb(String(server.db || 0));
      setTls(server.tls || false);
    }
  }, [server]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;
    
    onSave({
      ...server,
      name: name || `${host}:${port}`,
      host,
      port: parseInt(port, 10),
      username: username || undefined,
      password: password || undefined,
      db: parseInt(db, 10),
      tls,
    });
    onOpenChange(false);
  };

  if (!server) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Server Connection
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
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
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
