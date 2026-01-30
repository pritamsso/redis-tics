import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [password, setPassword] = useState("");
  const [db, setDb] = useState("0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name: name || `${host}:${port}`,
      host,
      port: parseInt(port, 10),
      password: password || undefined,
      db: parseInt(db, 10),
    });
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName("");
    setHost("localhost");
    setPort("6379");
    setPassword("");
    setDb("0");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Add Redis Server</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Password (optional)</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
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
