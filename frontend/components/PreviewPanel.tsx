import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, ExternalLink, RefreshCw, AlertCircle, Zap, Wifi, WifiOff, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../hooks/useBackend';
import { useWebSocket } from '../hooks/useWebSocket';
import { cn } from '@/lib/utils';

interface PreviewPanelProps {
  projectId: string;
  previewUrl?: string;
  onClose?: () => void;
  enableHotReload?: boolean;
  autoRefresh?: boolean;
}

interface HotReloadState {
  enabled: boolean;
  lastUpdate: Date | null;
  updateCount: number;
  connected: boolean;
}

export default function PreviewPanel({ 
  projectId, 
  previewUrl: initialPreviewUrl, 
  onClose,
  enableHotReload = true,
  autoRefresh = true 
}: PreviewPanelProps) {
  const backend = useBackend();
  const [currentUrl, setCurrentUrl] = useState(initialPreviewUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotReload, setHotReload] = useState<HotReloadState>({
    enabled: enableHotReload,
    lastUpdate: null,
    updateCount: 0,
    connected: false
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastFileChangeRef = useRef<Date | null>(null);

  // Hot reload functionality
  const handleHotReload = useCallback(() => {
    if (!hotReload.enabled || !currentUrl) return;
    
    console.log('Hot reloading preview...');
    setRefreshKey(prev => prev + 1);
    setHotReload(prev => ({
      ...prev,
      lastUpdate: new Date(),
      updateCount: prev.updateCount + 1
    }));
    
    // Inject hot reload script into iframe if possible
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.location.reload();
      }
    } catch (e) {
      // Cross-origin restrictions, fallback to src update
      if (iframeRef.current) {
        const url = new URL(currentUrl);
        url.searchParams.set('_reload', Date.now().toString());
        iframeRef.current.src = url.toString();
      }
    }
  }, [hotReload.enabled, currentUrl]);

  // WebSocket connection for real-time updates
  const { connected } = useWebSocket({
    projectId,
    onPreviewReady: (url: string) => {
      console.log('Preview ready via WebSocket:', url);
      setCurrentUrl(url);
      setError(null);
      
      if (autoRefresh) {
        handleHotReload();
      }
    },
    onBuildUpdate: (status: string) => {
      if (status === 'completed') {
        refetch();
        if (autoRefresh) {
          setTimeout(handleHotReload, 1000); // Delay to ensure server is ready
        }
      }
    },
    onFileUpdate: (filePath: string, operation: string) => {
      lastFileChangeRef.current = new Date();
      
      if (hotReload.enabled && autoRefresh) {
        // Debounce file changes to avoid excessive reloads
        setTimeout(() => {
          const now = new Date();
          if (lastFileChangeRef.current && 
              now.getTime() - lastFileChangeRef.current.getTime() >= 500) {
            handleHotReload();
          }
        }, 500);
      }
    }
  });

  // Update hot reload connection status
  useEffect(() => {
    setHotReload(prev => ({ ...prev, connected }));
  }, [connected]);

  // Query for current preview URL - reduce polling when WebSocket is connected
  const { data: previewData, refetch } = useQuery({
    queryKey: ['preview-url', projectId],
    queryFn: () => backend.workspace.getPreviewUrl({ projectId }),
    refetchInterval: connected ? 10000 : 2000, // Poll every 10s if WS connected, 2s if not
  });

  useEffect(() => {
    if (previewData?.url && previewData.url !== currentUrl) {
      setCurrentUrl(previewData.url);
      setError(null);
    }
  }, [previewData]);

  useEffect(() => {
    if (initialPreviewUrl && initialPreviewUrl !== currentUrl) {
      setCurrentUrl(initialPreviewUrl);
      setError(null);
    }
  }, [initialPreviewUrl]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    handleHotReload();
    refetch().finally(() => setLoading(false));
  };

  const toggleHotReload = () => {
    setHotReload(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const openInNewTab = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank');
    }
  };

  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError('Failed to load preview. The server might still be starting up.');
  };

  if (!currentUrl && previewData?.status !== 'running') {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-muted-foreground p-8">
          <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium mb-2">No Preview Available</h3>
          <p className="text-sm mb-4">
            Generate a website or start a preview server to see your project here.
          </p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Check for Preview
          </Button>
        </div>
      </div>
    );
  }

  if (previewData?.status === 'starting') {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-muted-foreground p-8">
          <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50 animate-pulse" />
          <h3 className="font-medium mb-2">Starting Preview Server</h3>
          <p className="text-sm mb-4">
            Please wait while we start your development server...
          </p>
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium">Preview</span>
          
          {/* Hot Reload Status */}
          <div className="flex items-center gap-1">
            {hotReload.connected ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-gray-400" />
            )}
            
            {hotReload.enabled && (
              <Badge variant="secondary" className="h-5 text-xs">
                <Zap className="h-2 w-2 mr-1" />
                Hot Reload
              </Badge>
            )}
            
            {hotReload.updateCount > 0 && (
              <Badge variant="outline" className="h-5 text-xs">
                {hotReload.updateCount} updates
              </Badge>
            )}
          </div>
          
          {currentUrl && (
            <span className="text-xs text-gray-500 font-mono truncate max-w-xs">
              {currentUrl}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Hot Reload Toggle */}
          <Button
            size="sm"
            variant={hotReload.enabled ? "default" : "outline"}
            onClick={toggleHotReload}
            className={cn(
              "gap-1",
              hotReload.enabled && "bg-blue-500 hover:bg-blue-600"
            )}
          >
            <Zap className="h-3 w-3" />
            {hotReload.enabled ? "On" : "Off"}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {currentUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={openInNewTab}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          )}
          
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative">
        {error ? (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center text-muted-foreground p-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="font-medium mb-2 text-red-700">Preview Error</h3>
              <p className="text-sm mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleRefresh} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                {currentUrl && (
                  <Button onClick={openInNewTab} variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Tab
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : currentUrl ? (
          <>
            {loading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Loading preview...</p>
                </div>
              </div>
            )}
            
            <iframe
              ref={iframeRef}
              key={refreshKey}
              src={currentUrl}
              className="w-full h-full border-0"
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ 
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
            />
            
            {/* Hot Reload Indicator */}
            {hotReload.lastUpdate && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-md animate-in fade-in duration-500">
                <Zap className="h-3 w-3 inline mr-1" />
                Updated {hotReload.lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center text-muted-foreground p-8">
              <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-2">Preparing Preview</h3>
              <p className="text-sm">
                Your preview is being prepared...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}