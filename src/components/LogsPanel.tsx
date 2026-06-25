import { useMemo, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, ChevronDown, Copy, Info, Terminal, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AppLogEntry, AppLogLevel } from "@/types";

interface LogsPanelProps {
  logs: AppLogEntry[];
  onClear: () => void;
}

const levelStyles: Record<AppLogLevel, { label: string; text: string; bg: string; icon: typeof Info }> = {
  debug: { label: "debug", text: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/30", icon: Bug },
  info: { label: "info", text: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30", icon: Info },
  success: { label: "ok", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  warn: { label: "warn", text: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: AlertTriangle },
  error: { label: "error", text: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: XCircle },
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function serializeLogs(logs: AppLogEntry[]) {
  return logs
    .slice()
    .reverse()
    .map((log) => {
      const base = `[${log.timestamp}] ${log.level.toUpperCase()} ${log.source}: ${log.message}`;
      return log.details ? `${base}\n  ${log.details}` : base;
    })
    .join("\n");
}

export function LogsPanel({ logs, onClear }: LogsPanelProps) {
  const [open, setOpen] = useState(false);
  const errorCount = useMemo(() => logs.filter((log) => log.level === "error").length, [logs]);
  const warnCount = useMemo(() => logs.filter((log) => log.level === "warn").length, [logs]);

  const copyLogs = async () => {
    await navigator.clipboard.writeText(serializeLogs(logs));
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-lg hover:bg-secondary"
      >
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span>Logs</span>
        {errorCount > 0 && <Badge variant="destructive">{errorCount}</Badge>}
        {errorCount === 0 && warnCount > 0 && <Badge variant="warning">{warnCount}</Badge>}
        {logs.length > 0 && <span className="text-xs text-muted-foreground">{logs.length}</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[360px] w-[min(760px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border bg-[#07101f] text-slate-100 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-950/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-300" />
          <span className="text-sm font-semibold">Logs</span>
          <Badge variant="outline" className="border-slate-600 text-slate-300">
            {logs.length}
          </Badge>
          {errorCount > 0 && <Badge variant="destructive">{errorCount} errors</Badge>}
          {warnCount > 0 && <Badge variant="warning">{warnCount} warnings</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:bg-slate-800" onClick={copyLogs} disabled={logs.length === 0}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:bg-slate-800" onClick={onClear} disabled={logs.length === 0}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:bg-slate-800" onClick={() => setOpen(false)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
            No log entries yet
          </div>
        ) : (
          <div className="space-y-2 p-3 font-mono text-xs">
            {logs.map((log) => {
              const style = levelStyles[log.level];
              const Icon = style.icon;
              return (
                <div key={log.id} className={cn("rounded-md border p-2", style.bg)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-500">{timeLabel(log.timestamp)}</span>
                    <span className={cn("inline-flex items-center gap-1 font-semibold uppercase", style.text)}>
                      <Icon className="h-3.5 w-3.5" />
                      {style.label}
                    </span>
                    <span className="text-slate-400">[{log.source}]</span>
                    <span className="text-slate-100">{log.message}</span>
                  </div>
                  {log.details && (
                    <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/25 p-2 text-[11px] leading-relaxed text-slate-300">
                      {log.details}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
