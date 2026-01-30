import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Github, ExternalLink } from "lucide-react";

export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Heart className="h-4 w-4 text-red-500" />
          About
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center text-2xl">
              📊
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
            <a 
              href="https://github.com/pritamsso/redis-tics" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <Github className="h-5 w-5" />
              <div className="flex-1">
                <div className="font-medium">View on GitHub</div>
                <div className="text-xs text-muted-foreground">github.com/pritamsso/redis-tics</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>

            <a 
              href="https://github.com/pritamsso" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                P
              </div>
              <div className="flex-1">
                <div className="font-medium">@pritamsso</div>
                <div className="text-xs text-muted-foreground">Developer</div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              Made with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> by 
              <a 
                href="https://github.com/pritamsso" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-red-500 hover:underline font-medium"
              >
                @pritamsso
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Version 1.0.0 • Open Source
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
