import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wifi, 
  WifiOff, 
  Download, 
  Upload, 
  Cloud,
  CloudOff,
  Settings,
  Loader2,
  Check,
  X
} from "lucide-react";
import { useBackend } from '../hooks/useBackend';

interface OfflineModeDialogProps {
  projectId: string;
  projectName: string;
}

interface OfflineCapabilities {
  storage: boolean;
  editor: boolean;
  localLLM: boolean;
  deployment: boolean;
}

interface LocalLLMConfig {
  provider: "ollama" | "llamacpp" | "custom";
  endpoint: string;
  model: string;
  apiKey?: string;
}

export default function OfflineModeDialog({ projectId, projectName }: OfflineModeDialogProps) {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<OfflineCapabilities | null>(null);
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [localLLMEnabled, setLocalLLMEnabled] = useState(false);
  const [llmConfig, setLLMConfig] = useState<LocalLLMConfig>({
    provider: "ollama",
    endpoint: "http://localhost:11434",
    model: "llama2"
  });
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();

  useEffect(() => {
    loadCapabilities();
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCapabilities = async () => {
    try {
      const caps = await backend.localstorage.getOfflineCapabilities();
      setCapabilities(caps);
    } catch (error) {
      console.error("Failed to load offline capabilities:", error);
    }
  };

  const enableOfflineMode = async () => {
    setLoading(true);
    try {
      const result = await backend.localstorage.enableOfflineMode({ projectId });
      
      if (result.success && result.project) {
        // Store project data in IndexedDB
        await storeProjectLocally(result.project);
        setOfflineEnabled(true);
        
        toast({
          title: "Offline Mode Enabled",
          description: "Project data has been downloaded for offline use",
        });
      }
    } catch (error) {
      console.error("Failed to enable offline mode:", error);
      toast({
        title: "Error",
        description: "Failed to enable offline mode",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const configureLocalLLM = async () => {
    setLoading(true);
    try {
      const result = await backend.localstorage.configureLocalLLM(llmConfig);
      
      if (result.success) {
        setLocalLLMEnabled(true);
        toast({
          title: "Local LLM Configured",
          description: "AI assistance is now available offline",
        });
      } else {
        toast({
          title: "Configuration Failed",
          description: result.error || "Failed to configure local LLM",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to configure local LLM:", error);
      toast({
        title: "Error",
        description: "Failed to configure local LLM",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const syncWithServer = async () => {
    if (!isOnline) {
      toast({
        title: "No Internet Connection",
        description: "Cannot sync while offline",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const localData = await getLocalProjectData(projectId);
      
      if (localData && typeof localData === 'object' && 'id' in localData) {
        const result = await backend.localstorage.syncWithServer({
          projectId,
          localData: localData as any,
          forceSync: false
        });

        if (result.success) {
          toast({
            title: "Sync Successful",
            description: "Local changes have been synced with the server",
          });
        } else if (result.conflicts) {
          toast({
            title: "Conflicts Detected",
            description: `${result.conflicts.length} conflicts need to be resolved`,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Failed to sync with server:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync with server",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const storeProjectLocally = async (project: any) => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      await store.put(project);
    } catch (error) {
      console.error("Failed to store project locally:", error);
      throw error;
    }
  };

  const getLocalProjectData = async (projectId: string) => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.get(projectId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get local project data:", error);
      return null;
    }
  };

  const openIndexedDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MultiAgentDevPlatform', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
      };
    });
  };

  const CapabilityItem = ({ 
    name, 
    supported, 
    description 
  }: { 
    name: string; 
    supported: boolean; 
    description: string; 
  }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {supported ? (
        <Check className="h-5 w-5 text-green-600" />
      ) : (
        <X className="h-5 w-5 text-red-600" />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          Offline Mode
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Offline Mode Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Cloud className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Online</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-4 w-4 text-orange-600" />
                  <span className="text-orange-600">Offline</span>
                </>
              )}
            </div>
            {offlineEnabled && (
              <Badge variant="secondary">Offline Mode Enabled</Badge>
            )}
          </div>

          {capabilities && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Offline Capabilities</CardTitle>
                <CardDescription>
                  Features available when working offline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <CapabilityItem
                  name="Local Storage"
                  supported={capabilities.storage}
                  description="Store projects locally using IndexedDB"
                />
                <CapabilityItem
                  name="Code Editor"
                  supported={capabilities.editor}
                  description="Full-featured Monaco editor with syntax highlighting"
                />
                <CapabilityItem
                  name="Local AI"
                  supported={capabilities.localLLM}
                  description="AI assistance using local language models"
                />
                <CapabilityItem
                  name="Deployment"
                  supported={capabilities.deployment}
                  description="Deploy projects to hosting platforms"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Offline Access</CardTitle>
              <CardDescription>
                Download {projectName} for offline development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Offline Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Download project files to work without internet
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={offlineEnabled} 
                    onCheckedChange={(checked) => {
                      if (checked) {
                        enableOfflineMode();
                      } else {
                        setOfflineEnabled(false);
                      }
                    }}
                    disabled={loading}
                  />
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Local AI Configuration</CardTitle>
              <CardDescription>
                Set up local language models for offline AI assistance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="llm-provider">Provider</Label>
                  <select
                    id="llm-provider"
                    value={llmConfig.provider}
                    onChange={(e) => setLLMConfig({ 
                      ...llmConfig, 
                      provider: e.target.value as any 
                    })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="ollama">Ollama</option>
                    <option value="llamacpp">LlamaCpp</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm-model">Model</Label>
                  <Input
                    id="llm-model"
                    value={llmConfig.model}
                    onChange={(e) => setLLMConfig({ 
                      ...llmConfig, 
                      model: e.target.value 
                    })}
                    placeholder="llama2, codellama, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-endpoint">Endpoint URL</Label>
                <Input
                  id="llm-endpoint"
                  value={llmConfig.endpoint}
                  onChange={(e) => setLLMConfig({ 
                    ...llmConfig, 
                    endpoint: e.target.value 
                  })}
                  placeholder="http://localhost:11434"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Local AI Enabled</div>
                  <div className="text-sm text-muted-foreground">
                    {localLLMEnabled ? "AI assistance available offline" : "Configure local LLM to enable"}
                  </div>
                </div>
                <Button
                  onClick={configureLocalLLM}
                  disabled={loading || !llmConfig.endpoint}
                  variant={localLLMEnabled ? "outline" : "default"}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Settings className="mr-2 h-4 w-4" />
                  {localLLMEnabled ? "Reconfigure" : "Configure"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {offlineEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sync with Server</CardTitle>
                <CardDescription>
                  Synchronize local changes with the server when online
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Sync Status</div>
                    <div className="text-sm text-muted-foreground">
                      {isOnline ? "Ready to sync" : "Waiting for internet connection"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={syncWithServer}
                      disabled={!isOnline || loading}
                      variant="outline"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Upload className="mr-2 h-4 w-4" />
                      Sync Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}