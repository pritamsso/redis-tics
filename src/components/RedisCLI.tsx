import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Terminal,
  Play,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  Lightbulb,
} from "lucide-react";
import type { CommandResult, PerformanceWarning } from "@/types";

interface RedisCLIProps {
  serverId: string;
}

interface HistoryEntry {
  command: string;
  result: CommandResult;
  timestamp: number;
}

const DANGEROUS_COMMANDS = ["FLUSHDB", "FLUSHALL", "DEBUG", "SHUTDOWN", "CONFIG SET", "SLAVEOF", "REPLICAOF"];
const COMMAND_HINTS: Record<string, string> = {
  GET: "GET key - Get the value of a key",
  SET: "SET key value [EX seconds] - Set a key with optional expiry",
  DEL: "DEL key [key ...] - Delete one or more keys",
  KEYS: "KEYS pattern - Find all keys matching pattern (use SCAN for production)",
  SCAN: "SCAN cursor [MATCH pattern] [COUNT count] - Incrementally iterate keys",
  HGET: "HGET key field - Get the value of a hash field",
  HSET: "HSET key field value - Set the value of a hash field",
  HGETALL: "HGETALL key - Get all fields and values in a hash",
  LPUSH: "LPUSH key value - Prepend to a list",
  RPUSH: "RPUSH key value - Append to a list",
  LRANGE: "LRANGE key start stop - Get a range of elements from a list",
  SADD: "SADD key member - Add member to a set",
  SMEMBERS: "SMEMBERS key - Get all members of a set",
  ZADD: "ZADD key score member - Add member to sorted set with score",
  ZRANGE: "ZRANGE key start stop [WITHSCORES] - Get range from sorted set",
  INFO: "INFO [section] - Get server information",
  DBSIZE: "DBSIZE - Return the number of keys in the selected database",
  TTL: "TTL key - Get time to live for a key in seconds",
  EXPIRE: "EXPIRE key seconds - Set a key's time to live",
  TYPE: "TYPE key - Get the type of a key",
  MEMORY: "MEMORY USAGE key - Get memory usage of a key",
  CLIENT: "CLIENT LIST - Get list of connected clients",
  SLOWLOG: "SLOWLOG GET [count] - Get slow queries log",
};

export function RedisCLI({ serverId }: RedisCLIProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [warning, setWarning] = useState<PerformanceWarning | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    const cmd = command.split(" ")[0]?.toUpperCase();
    if (cmd && COMMAND_HINTS[cmd]) {
      setHint(COMMAND_HINTS[cmd]);
    } else {
      setHint(null);
    }
  }, [command]);

  const checkDangerous = (cmd: string): boolean => {
    const upper = cmd.toUpperCase();
    return DANGEROUS_COMMANDS.some((d) => upper.startsWith(d));
  };

  const executeCommand = async () => {
    if (!command.trim()) return;

    if (checkDangerous(command)) {
      try {
        const warn = await invoke<PerformanceWarning>("check_operation_impact", {
          serverId,
          operation: command.split(" ")[0].toUpperCase(),
          pattern: command,
        });
        if (warn.level === "critical") {
          setWarning(warn);
          return;
        }
      } catch {}
    }

    setLoading(true);
    setWarning(null);

    try {
      const result = await invoke<CommandResult>("execute_command", {
        serverId,
        command: command.trim(),
      });

      setHistory((prev) => [
        ...prev,
        { command: command.trim(), result, timestamp: Date.now() },
      ]);
      setCommand("");
      setHistoryIndex(-1);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          command: command.trim(),
          result: {
            success: false,
            result: "",
            executionTimeMs: 0,
            error: String(err),
          },
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const commandHistory = history.map((h) => h.command);
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const commandHistory = history.map((h) => h.command);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  const confirmDangerous = async () => {
    setWarning(null);
    setLoading(true);
    try {
      const result = await invoke<CommandResult>("execute_command", {
        serverId,
        command: command.trim(),
      });
      setHistory((prev) => [
        ...prev,
        { command: command.trim(), result, timestamp: Date.now() },
      ]);
      setCommand("");
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          command: command.trim(),
          result: { success: false, result: "", executionTimeMs: 0, error: String(err) },
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Redis CLI</h2>
        <Badge variant="outline" className="ml-auto">
          {history.length} commands
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistory([])}
          disabled={history.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {warning && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">{warning.message}</div>
              <div className="text-sm opacity-80">{warning.estimatedImpact}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" onClick={confirmDangerous}>
              Execute Anyway
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWarning(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 bg-black/50 rounded-lg font-mono text-sm" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {history.map((entry, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2 text-green-400">
                <span className="text-muted-foreground">{">"}</span>
                <span>{entry.command}</span>
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {entry.result.executionTimeMs}ms
                </span>
              </div>
              {entry.result.success ? (
                <pre className="text-gray-300 whitespace-pre-wrap pl-4">
                  {entry.result.result || "(empty)"}
                </pre>
              ) : (
                <div className="text-red-400 pl-4 flex items-start gap-2">
                  <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{entry.result.error}</span>
                </div>
              )}
            </div>
          ))}
          {history.length === 0 && (
            <div className="text-muted-foreground text-center py-8">
              Type a Redis command and press Enter to execute
            </div>
          )}
        </div>
      </ScrollArea>

      {hint && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
          <Lightbulb className="h-3 w-3 text-yellow-500" />
          <span className="font-mono">{hint}</span>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 font-mono">
            {">"}
          </span>
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter Redis command (e.g., GET key, SET key value, INFO)"
            className="pl-8 font-mono bg-black/30"
            disabled={loading}
          />
        </div>
        <Button onClick={executeCommand} disabled={loading || !command.trim()}>
          <Play className="h-4 w-4 mr-1" />
          Run
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <History className="h-3 w-3" />
          ↑↓ for history
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-500" />
          Enter to execute
        </span>
      </div>
    </div>
  );
}
