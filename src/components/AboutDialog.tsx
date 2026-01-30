import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, RefreshCw, Download, CheckCircle } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";

export function AboutDialog() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState("Loading...");

  // Load version on mount
  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(() => setCurrentVersion("1.0.0"));
  }, []);

  const checkForUpdates = async () => {
    setChecking(true);
    setError(null);
    setUpdateAvailable(null);
    try {
      const update = await check();
      if (update && update.available) {
        setUpdateAvailable(update.version);
      } else {
        setError("You're on the latest version!");
      }
    } catch (err) {
      // Handle common errors gracefully
      const errStr = String(err);
      if (errStr.includes("No updates available") || errStr.includes("up to date")) {
        setError("You're on the latest version!");
      } else if (errStr.includes("network") || errStr.includes("fetch")) {
        setError("Network error - check your connection");
      } else {
        setError("Could not check for updates");
      }
      console.error("Update check error:", err);
    } finally {
      setChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    setDownloading(true);
    try {
      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = (event.data as { contentLength?: number }).contentLength || 0;
        } else if (event.event === "Progress") {
          downloaded += (event.data as { chunkLength: number }).chunkLength;
          if (contentLength > 0) {
            setDownloadProgress(Math.round((downloaded / contentLength) * 100));
          }
        } else if (event.event === "Finished") {
          setInstalled(true);
          setDownloading(false);
        }
      });
    } catch (err) {
      setError(String(err));
      setDownloading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <div className="w-4 h-4 bg-gradient-to-br from-red-500 to-orange-500 rounded flex items-center justify-center text-[10px]">
            R
          </div>
          About
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
              RT
            </div>
            Redis Tics
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <p className="text-muted-foreground">
            A powerful, open-source Redis analytics and monitoring dashboard. Monitor multiple servers, 
            track commands in real-time, analyze memory usage, and diagnose performance issues.
          </p>
          
          <div className="space-y-3">
            <h4 className="font-semibold">Features</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Multi-server management</li>
              <li>• Real-time command monitoring</li>
              <li>• Memory & performance analytics</li>
              <li>• Slow log analysis</li>
              <li>• Cluster support</li>
              <li>• Persistence status tracking</li>
            </ul>
          </div>

          <div className="pt-4 border-t space-y-4">
            <button 
              onClick={() => open("https://redistics.com")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 flex items-center justify-center">🌐</div>
              <div className="flex-1 text-left">
                <div className="font-medium">Website</div>
                <div className="text-xs text-muted-foreground">redistics.com</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>

            <button 
              onClick={() => open("https://github.com/pritamsso/redis-tics")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Github className="h-5 w-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">View on GitHub</div>
                <div className="text-xs text-muted-foreground">github.com/pritamsso/redis-tics</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>

            <button 
              onClick={() => open("https://github.com/pritamsso")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                P
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">@pritamsso</div>
                <div className="text-xs text-muted-foreground">Developer</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Version {currentVersion}</p>
                <p className="text-xs text-muted-foreground">Open Source • Apache 2.0</p>
              </div>
              {installed ? (
                <Button size="sm" onClick={() => relaunch()} className="gap-2">
                  <RefreshCw className="h-3 w-3" />
                  Restart
                </Button>
              ) : downloading ? (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${downloadProgress}%` }} />
                  </div>
                  <span className="text-xs">{downloadProgress}%</span>
                </div>
              ) : updateAvailable ? (
                <Button size="sm" onClick={downloadAndInstall} className="gap-2">
                  <Download className="h-3 w-3" />
                  Update to v{updateAvailable}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={checkForUpdates} disabled={checking} className="gap-2">
                  <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
                  {checking ? "Checking..." : "Check Updates"}
                </Button>
              )}
            </div>
            {error && (
              <p className={`text-xs ${error.includes("latest") ? "text-green-500" : "text-red-500"} flex items-center gap-1`}>
                {error.includes("latest") && <CheckCircle className="h-3 w-3" />}
                {error}
              </p>
            )}
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              Made with ❤️ by 
              <button 
                onClick={() => open("https://github.com/pritamsso")}
                className="text-red-500 hover:underline font-medium cursor-pointer"
              >
                @pritamsso
              </button>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
