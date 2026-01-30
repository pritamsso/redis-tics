import { useState, useEffect } from "react";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date || "",
          body: update.body || "",
        });
      }
    } catch (err) {
      console.log("Update check failed:", err);
    }
  };

  const downloadAndInstall = async () => {
    try {
      setDownloading(true);
      setError(null);
      
      const update = await check();
      if (!update) {
        setError("Update no longer available");
        setDownloading(false);
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setInstalled(true);
            setDownloading(false);
            break;
        }
      });
    } catch (err) {
      setError(String(err));
      setDownloading(false);
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  if (dismissed || !updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-card border border-primary/30 rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 to-orange-500/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Update Available</span>
          </div>
          <Badge variant="outline" className="text-xs">
            v{updateInfo?.version}
          </Badge>
        </div>
        
        <div className="p-4 space-y-3">
          {error ? (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <XCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : installed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Update installed successfully!</span>
              </div>
              <Button onClick={handleRelaunch} className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Restart Now
              </Button>
            </div>
          ) : downloading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Downloading...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                A new version of Redis Tics is available with improvements and bug fixes.
              </p>
              <div className="flex gap-2">
                <Button onClick={downloadAndInstall} className="flex-1 gap-2">
                  <Download className="h-4 w-4" />
                  Update Now
                </Button>
                <Button variant="outline" onClick={() => setDismissed(true)}>
                  Later
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
