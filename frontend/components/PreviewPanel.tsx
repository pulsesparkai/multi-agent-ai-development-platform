import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '../hooks/useBackend';

interface PreviewPanelProps {
  projectId: string;
  previewUrl?: string;
  onClose?: () => void;
}

export default function PreviewPanel({ projectId, previewUrl: initialPreviewUrl, onClose }: PreviewPanelProps) {
  const backend = useBackend();
  const [currentUrl, setCurrentUrl] = useState(initialPreviewUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query for current preview URL
  const { data: previewData, refetch } = useQuery({
    queryKey: ['preview-url', projectId],
    queryFn: () => backend.workspace.getPreviewUrl({ projectId }),
    refetchInterval: 2000, // Check every 2 seconds
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
    refetch().finally(() => setLoading(false));
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
          {currentUrl && (
            <span className="text-xs text-gray-500 font-mono truncate max-w-xs">
              {currentUrl}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
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
              src={currentUrl}
              className="w-full h-full border-0"
              title="Project Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ 
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
            />
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