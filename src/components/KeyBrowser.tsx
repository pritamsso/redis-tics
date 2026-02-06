import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Key,
  RefreshCw,
  Trash2,
  Clock,
  ChevronRight,
  AlertTriangle,
  Info,
  XCircle,
  Database,
  List,
  Hash,
  FileText,
  Layers,
  Radio,
  Plus,
  Save,
  Edit3,
  Copy,
} from "lucide-react";
import type {
  KeyInfo,
  KeyValue,
  KeyScanResult,
  ServerCapabilities,
  PerformanceWarning,
} from "@/types";

interface KeyBrowserProps {
  serverId: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  string: <FileText className="h-4 w-4 text-green-500" />,
  list: <List className="h-4 w-4 text-blue-500" />,
  set: <Layers className="h-4 w-4 text-purple-500" />,
  zset: <Layers className="h-4 w-4 text-orange-500" />,
  hash: <Hash className="h-4 w-4 text-yellow-500" />,
  stream: <Radio className="h-4 w-4 text-pink-500" />,
  unknown: <Key className="h-4 w-4 text-gray-500" />,
};

const TYPE_COLORS: Record<string, string> = {
  string: "bg-green-500/10 text-green-500 border-green-500/20",
  list: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  set: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  zset: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  hash: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  stream: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  unknown: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTTL(ttl: number): string {
  if (ttl === -1) return "No expiry";
  if (ttl === -2) return "Key not found";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
  return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`;
}

export function KeyBrowser({ serverId }: KeyBrowserProps) {
  const [pattern, setPattern] = useState("*");
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [cursor, setCursor] = useState("0");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState<KeyValue | null>(null);
  const [loadingValue, setLoadingValue] = useState(false);
  const [capabilities, setCapabilities] = useState<ServerCapabilities | null>(null);
  const [warning, setWarning] = useState<PerformanceWarning | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [addItemValue, setAddItemValue] = useState("");
  const [addItemScore, setAddItemScore] = useState("");
  const [newHashField, setNewHashField] = useState("");
  const [newHashValue, setNewHashValue] = useState("");

  useEffect(() => {
    loadCapabilities();
  }, [serverId]);

  const loadCapabilities = async () => {
    try {
      const caps = await invoke<ServerCapabilities>("get_server_capabilities", {
        serverId,
      });
      setCapabilities(caps);
    } catch (err) {
      console.error("Failed to load capabilities:", err);
    }
  };

  const checkImpact = async (operation: string) => {
    try {
      const warn = await invoke<PerformanceWarning>("check_operation_impact", {
        serverId,
        operation,
        pattern,
      });
      if (warn.level === "critical" || warn.level === "warning") {
        setWarning(warn);
        return false;
      }
      setWarning(null);
      return true;
    } catch {
      return true;
    }
  };

  const scanKeys = useCallback(async (newSearch = false) => {
    setLoading(true);
    setError(null);
    
    const searchCursor = newSearch ? "0" : cursor;
    
    try {
      const result = await invoke<KeyScanResult>("scan_keys", {
        serverId,
        pattern: pattern || "*",
        cursor: searchCursor,
        count: 100,
      });

      if (newSearch) {
        setKeys(result.keys);
      } else {
        setKeys((prev) => [...prev, ...result.keys]);
      }
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [serverId, pattern, cursor]);

  const loadKeyValue = async (key: string) => {
    setSelectedKey(key);
    setLoadingValue(true);
    setError("");
    try {
      const value = await invoke<KeyValue>("get_key_value", {
        serverId,
        key,
      });
      console.log("Loaded key value:", value);
      setKeyValue(value);
    } catch (err) {
      console.error("Failed to load key value:", err);
      setError(String(err));
      setKeyValue(null);
    } finally {
      setLoadingValue(false);
    }
  };

  const deleteKey = async (key: string) => {
    if (!confirm(`Are you sure you want to delete "${key}"? This cannot be undone.`)) {
      return;
    }
    try {
      await invoke<boolean>("delete_key", { serverId, key });
      setKeys((prev) => prev.filter((k) => k.key !== key));
      if (selectedKey === key) {
        setSelectedKey(null);
        setKeyValue(null);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSearch = async () => {
    const safe = await checkImpact("SCAN");
    if (safe) {
      scanKeys(true);
    }
  };

  const saveStringValue = async () => {
    if (!selectedKey) return;
    try {
      await invoke<boolean>("set_string", { serverId, key: selectedKey, value: editValue, ttl: null });
      setEditMode(false);
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const addListItem = async (position: string) => {
    if (!selectedKey || !addItemValue) return;
    try {
      await invoke<number>("list_push", { serverId, key: selectedKey, value: addItemValue, position });
      setAddItemValue("");
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const removeListItem = async (index: number) => {
    if (!selectedKey) return;
    try {
      await invoke<boolean>("list_remove", { serverId, key: selectedKey, index });
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const addSetMember = async () => {
    if (!selectedKey || !addItemValue) return;
    try {
      await invoke<boolean>("set_add", { serverId, key: selectedKey, member: addItemValue });
      setAddItemValue("");
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const removeSetMember = async (member: string) => {
    if (!selectedKey) return;
    try {
      await invoke<boolean>("set_remove", { serverId, key: selectedKey, member });
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const addZSetMember = async () => {
    if (!selectedKey || !addItemValue) return;
    try {
      const score = parseFloat(addItemScore) || 0;
      await invoke<boolean>("zset_add", { serverId, key: selectedKey, score, member: addItemValue });
      setAddItemValue("");
      setAddItemScore("");
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const removeZSetMember = async (member: string) => {
    if (!selectedKey) return;
    try {
      await invoke<boolean>("zset_remove", { serverId, key: selectedKey, member });
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const addHashFieldFn = async () => {
    if (!selectedKey || !newHashField || !newHashValue) return;
    try {
      await invoke<boolean>("hash_set", { serverId, key: selectedKey, field: newHashField, value: newHashValue });
      setNewHashField("");
      setNewHashValue("");
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const removeHashField = async (field: string) => {
    if (!selectedKey) return;
    try {
      await invoke<boolean>("hash_delete", { serverId, key: selectedKey, field });
      loadKeyValue(selectedKey);
    } catch (err) {
      setError(String(err));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderValue = (value: KeyValue) => {
    const data = value.value;
    console.log("Rendering value:", data);
    console.log("Value type:", typeof data);
    console.log("Value keys:", Object.keys(data));

    if ("String" in data) {
      const stringValue = data.String;
      console.log("String value:", stringValue, "Length:", stringValue?.length);
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">String Value</div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(stringValue)}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(true); setEditValue(stringValue); }}>
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {editMode ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value)}
                className="font-mono text-sm min-h-32"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveStringValue}>
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <pre className="bg-secondary p-3 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {stringValue || "(empty string)"}
              </pre>
              {stringValue && (
                <div className="text-xs text-muted-foreground">
                  Length: {stringValue.length} characters
                </div>
              )}
            </div>
          )}
        </div>
      );
    } else if ("string" in data) {
      const stringValue = data.string;
      console.log("String value (lowercase):", stringValue, "Length:", (stringValue as string)?.length);
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">String Value</div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(stringValue as string)}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(true); setEditValue(stringValue as string); }}>
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {editMode ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value)}
                className="font-mono text-sm min-h-32"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveStringValue}>
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <pre className="bg-secondary p-3 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {(stringValue as string) || "(empty string)"}
              </pre>
              {(stringValue as string) && (
                <div className="text-xs text-muted-foreground">
                  Length: {(stringValue as string).length} characters
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if ("List" in data) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            List ({data.List.length} items)
          </div>
          <div className="flex gap-2">
            <Input placeholder="New item" value={addItemValue} onChange={(e) => setAddItemValue(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={() => addListItem("left")}><Plus className="h-3 w-3 mr-1" />Left</Button>
            <Button size="sm" onClick={() => addListItem("right")}><Plus className="h-3 w-3 mr-1" />Right</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {data.List.map((item, i) => (
                <div key={i} className="flex gap-2 p-2 bg-secondary rounded text-sm group">
                  <span className="text-muted-foreground w-8">{i}</span>
                  <span className="break-all flex-1">{item}</span>
                  <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removeListItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("list" in data) {
      const listData = data.list as string[];
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            List ({listData.length} items)
          </div>
          <div className="flex gap-2">
            <Input placeholder="New item" value={addItemValue} onChange={(e) => setAddItemValue(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={() => addListItem("left")}><Plus className="h-3 w-3 mr-1" />Left</Button>
            <Button size="sm" onClick={() => addListItem("right")}><Plus className="h-3 w-3 mr-1" />Right</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {listData.map((item, i) => (
                <div key={i} className="flex gap-2 p-2 bg-secondary rounded text-sm group">
                  <span className="text-muted-foreground w-8">{i}</span>
                  <span className="break-all flex-1">{item}</span>
                  <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removeListItem(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("Set" in data) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Set ({data.Set.length} members)
          </div>
          <div className="flex gap-2">
            <Input placeholder="New member" value={addItemValue} onChange={(e) => setAddItemValue(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={addSetMember}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="flex flex-wrap gap-2">
              {data.Set.map((item, i) => (
                <Badge key={i} variant="secondary" className="text-sm cursor-pointer hover:bg-red-500/20" onClick={() => removeSetMember(item)}>
                  {item} <XCircle className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("set" in data) {
      const setData = data.set as string[];
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Set ({setData.length} members)
          </div>
          <div className="flex gap-2">
            <Input placeholder="New member" value={addItemValue} onChange={(e) => setAddItemValue(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={addSetMember}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="flex flex-wrap gap-2">
              {setData.map((item, i) => (
                <Badge key={i} variant="secondary" className="text-sm cursor-pointer hover:bg-red-500/20" onClick={() => removeSetMember(item)}>
                  {item} <XCircle className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("ZSet" in data) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Sorted Set ({data.ZSet.length} members)
          </div>
          <div className="flex gap-2">
            <Input placeholder="Member" value={addItemValue} onChange={(e) => setAddItemValue(e.target.value)} className="flex-1" />
            <Input placeholder="Score" type="number" value={addItemScore} onChange={(e) => setAddItemScore(e.target.value)} className="w-24" />
            <Button size="sm" onClick={addZSetMember}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {data.ZSet.map((item, i) => (
                <div key={i} className="flex justify-between p-2 bg-secondary rounded text-sm group">
                  <span className="break-all">{item.member}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.score}</Badge>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removeZSetMember(item.member)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("zset" in data) {
      const zsetData = data.zset as any[];
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Sorted Set ({zsetData.length} members)
          </div>
          <div className="flex gap-2">
            <Input placeholder="Member" value={addItemValue} onChange={(e) => setAddItemValue(e.target.value)} className="flex-1" />
            <Input placeholder="Score" type="number" value={addItemScore} onChange={(e) => setAddItemScore(e.target.value)} className="w-24" />
            <Button size="sm" onClick={addZSetMember}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {zsetData.map((item, i) => (
                <div key={i} className="flex justify-between p-2 bg-secondary rounded text-sm group">
                  <span className="break-all">{item.member}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.score}</Badge>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removeZSetMember(item.member)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("Hash" in data) {
      const entries = Object.entries(data.Hash);
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Hash ({entries.length} fields)
          </div>
          <div className="flex gap-2">
            <Input placeholder="Field" value={newHashField} onChange={(e) => setNewHashField(e.target.value)} className="w-32" />
            <Input placeholder="Value" value={newHashValue} onChange={(e) => setNewHashValue(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={addHashFieldFn}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {entries.map(([field, val], i) => (
                <div key={i} className="p-2 bg-secondary rounded text-sm group">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-primary">{field}</div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removeHashField(field)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-muted-foreground break-all">{val}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("hash" in data) {
      const entries = Object.entries(data.hash as Record<string, string>);
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Hash ({entries.length} fields)
          </div>
          <div className="flex gap-2">
            <Input placeholder="Field" value={newHashField} onChange={(e) => setNewHashField(e.target.value)} className="w-32" />
            <Input placeholder="Value" value={newHashValue} onChange={(e) => setNewHashValue(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={addHashFieldFn}><Plus className="h-3 w-3 mr-1" />Add</Button>
          </div>
          <ScrollArea className="h-80">
            <div className="space-y-1">
              {entries.map(([field, val], i) => (
                <div key={i} className="p-2 bg-secondary rounded text-sm group">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-primary">{field}</div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removeHashField(field)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-muted-foreground break-all">{val}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("Stream" in data) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Stream ({data.Stream.length} entries)
          </div>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {data.Stream.map((entry, i) => (
                <div key={i} className="p-2 bg-secondary rounded text-sm">
                  <div className="font-mono text-xs text-primary mb-1">{entry.id}</div>
                  <div className="space-y-1">
                    {Object.entries(entry.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("stream" in data) {
      const streamData = data.stream as any[];
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Stream ({streamData.length} entries)
          </div>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {streamData.map((entry, i) => (
                <div key={i} className="p-2 bg-secondary rounded text-sm">
                  <div className="font-mono text-xs text-primary mb-1">{entry.id}</div>
                  <div className="space-y-1">
                    {Object.entries(entry.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if ("Unknown" in data) {
      return (
        <div className="text-muted-foreground text-sm">{data.Unknown}</div>
      );
    }

    return (
      <div className="text-muted-foreground text-sm">
        <div className="mb-2">Unable to render value</div>
        <pre className="bg-secondary p-3 rounded-lg text-xs overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {capabilities && (
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            {capabilities.serverType} {capabilities.version}
          </Badge>
          <Badge
            variant="outline"
            className={
              capabilities.clusterEnabled
                ? "text-green-500 border-green-500/30"
                : "text-muted-foreground"
            }
          >
            {capabilities.clusterMode}
          </Badge>
          <span className="text-muted-foreground">
            {capabilities.totalKeys.toLocaleString()} keys
          </span>
          {capabilities.isReadReplica && (
            <Badge variant="secondary">Read Replica</Badge>
          )}
        </div>
      )}

      {warning && (
        <div
          className={`p-3 rounded-lg border flex items-start gap-3 ${
            warning.level === "critical"
              ? "bg-red-500/10 border-red-500/30 text-red-500"
              : "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
          }`}
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{warning.message}</div>
            <div className="text-sm opacity-80">{warning.estimatedImpact}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setWarning(null)}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pattern (e.g., user:*, *:session:*, prefix*suffix)"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Scan
        </Button>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-3 w-3" />
        <span>
          Patterns: <code className="bg-secondary px-1 rounded">*</code> matches any,{" "}
          <code className="bg-secondary px-1 rounded">?</code> matches one,{" "}
          <code className="bg-secondary px-1 rounded">[abc]</code> matches chars,{" "}
          <code className="bg-secondary px-1 rounded">[^a]</code> excludes chars
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        <div className="border rounded-lg flex flex-col">
          <div className="p-3 border-b bg-secondary/50 flex items-center justify-between">
            <span className="font-medium">
              Keys ({keys.length}
              {hasMore ? "+" : ""})
            </span>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => scanKeys(false)}
                disabled={loading}
              >
                Load More
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {keys.map((key) => (
                <div
                  key={key.key}
                  className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 group ${
                    selectedKey === key.key
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-secondary"
                  }`}
                  onClick={() => loadKeyValue(key.key)}
                >
                  {TYPE_ICONS[key.keyType] || TYPE_ICONS.unknown}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm truncate" title={key.key}>
                      {key.key}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={`text-xs ${TYPE_COLORS[key.keyType] || TYPE_COLORS.unknown}`}
                      >
                        {key.keyType}
                      </Badge>
                      {key.size && <span>{formatBytes(key.size)}</span>}
                      {key.ttl > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTTL(key.ttl)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteKey(key.key);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {keys.length === 0 && !loading && (
                <div className="text-center text-muted-foreground py-8">
                  No keys found. Try a different pattern.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="border rounded-lg flex flex-col">
          <div className="p-3 border-b bg-secondary/50">
            <span className="font-medium">
              {selectedKey ? (
                <span className="font-mono">{selectedKey}</span>
              ) : (
                "Select a key to view"
              )}
            </span>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {loadingValue ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-red-500 mb-2">Failed to load key value</div>
                  <div className="text-sm text-muted-foreground">{error}</div>
                </div>
              </div>
            ) : keyValue ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <Badge className={TYPE_COLORS[keyValue.keyType] || TYPE_COLORS.unknown}>
                    {keyValue.keyType}
                  </Badge>
                  {keyValue.size && (
                    <span className="text-muted-foreground">
                      {formatBytes(keyValue.size)}
                    </span>
                  )}
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTTL(keyValue.ttl)}
                  </span>
                </div>
                {renderValue(keyValue)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Click a key to view its value
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
