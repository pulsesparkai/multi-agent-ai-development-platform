import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bug, Copy, CheckCircle, AlertCircle, Database, Key, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';
import { config } from '../config';

interface DebugInfoProps {
  projectId?: string;
}

export default function DebugInfo({ projectId }: DebugInfoProps) {
  const backend = useBackend();
  const { toast } = useToast();

  const { data: debugData, isLoading, error } = useQuery({
    queryKey: ['debugData'],
    queryFn: async () => {
      try {
        return await backend.ai.debug();
      } catch (error) {
        console.error('Debug data fetch failed:', error);
        throw error;
      }
    },
  });

  const { data: apiKeys } = useQuery({
    queryKey: ['debugApiKeys'],
    queryFn: async () => {
      try {
        const result = await backend.ai.listKeys();
        return result.apiKeys;
      } catch (error) {
        return [];
      }
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['debugProjects'],
    queryFn: async () => {
      try {
        const result = await backend.projects.list();
        return result.projects;
      } catch (error) {
        return [];
      }
    },
  });

  const debugInfo = {
    timestamp: new Date().toISOString(),
    config: {
      offlineMode: config.offlineMode,
      defaultAutoApply: config.defaultAutoApply,
      defaultAutoBuild: config.defaultAutoBuild,
      defaultAutoPreview: config.defaultAutoPreview,
    },
    currentProject: projectId,
    debugData,
    apiKeys: apiKeys?.map(key => ({
      provider: key.provider,
      hasKey: key.hasKey,
      createdAt: key.createdAt
    })) || [],
    projects: projects?.map(p => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt
    })) || [],
    browser: {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    },
    error: error?.message
  };

  const copyDebugInfo = () => {
    const debugText = JSON.stringify(debugInfo, null, 2);
    navigator.clipboard.writeText(debugText);
    toast({
      title: 'Debug Info Copied',
      description: 'Debug information has been copied to clipboard',
    });
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground mt-2">Loading debug information...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          <h3 className="font-medium">Debug Information</h3>
        </div>
        <Button size="sm" variant="outline" onClick={copyDebugInfo}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Debug Info
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Debug Data Error</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
        </div>
      )}

      <div className="space-y-4 text-sm">
        {/* Authentication Status */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Authentication
          </h4>
          <div className="space-y-1 pl-6">
            <div className="flex items-center gap-2">
              {getStatusIcon(debugData?.user?.authenticated || false)}
              <span>Authenticated: {debugData?.user?.authenticated ? 'Yes' : 'No'}</span>
            </div>
            {debugData?.user?.id && (
              <div className="text-xs text-muted-foreground">
                User ID: {debugData.user.id}
              </div>
            )}
          </div>
        </div>

        {/* Database Status */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database
          </h4>
          <div className="space-y-1 pl-6">
            <div className="flex items-center gap-2">
              {getStatusIcon(debugData?.database?.connected || false)}
              <span>Connected: {debugData?.database?.connected ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(debugData?.database?.tablesExist || false)}
              <span>Tables Exist: {debugData?.database?.tablesExist ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* API Keys Status */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </h4>
          <div className="space-y-1 pl-6">
            {debugData?.apiKeys?.map(key => (
              <div key={key.provider} className="flex items-center gap-2">
                {getStatusIcon(key.hasKey)}
                <span>{key.provider}: {key.hasKey ? 'Configured' : 'Not set'}</span>
                {key.keyPreview && (
                  <span className="text-xs text-muted-foreground">({key.keyPreview})</span>
                )}
              </div>
            )) || (
              <div className="text-muted-foreground">No API key data available</div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="space-y-2">
          <h4 className="font-medium">System Status</h4>
          <div className="space-y-1 pl-6">
            <div className="flex items-center gap-2">
              {getStatusIcon(!!projects && projects.length > 0)}
              <span>Projects Created: {projects?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(!!projectId)}
              <span>Current Project: {projectId ? 'Selected' : 'None'}</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(!config.offlineMode)}
              <span>Online Mode: {config.offlineMode ? 'Disabled' : 'Enabled'}</span>
            </div>
          </div>
        </div>

        {/* Errors */}
        {debugData?.errors && debugData.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-800">Errors Found</h4>
            <div className="space-y-1 pl-6">
              {debugData.errors.map((error, index) => (
                <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="space-y-2">
          <h4 className="font-medium">Configuration</h4>
          <div className="text-xs text-muted-foreground space-y-1 pl-6">
            <div>Auto-apply: {config.defaultAutoApply ? 'ON' : 'OFF'}</div>
            <div>Auto-build: {config.defaultAutoBuild ? 'ON' : 'OFF'}</div>
            <div>Auto-preview: {config.defaultAutoPreview ? 'ON' : 'OFF'}</div>
            <div>Preview Port: {config.previewPort}</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t">
        Generated at {new Date().toLocaleString()}
      </div>
    </div>
  );
}