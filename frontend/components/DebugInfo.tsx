import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bug, Copy, CheckCircle, AlertCircle } from 'lucide-react';
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
      // apiBaseUrl: config.apiBaseUrl,
    },
    currentProject: projectId,
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
    }
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

      <div className="space-y-3 text-sm">
        <div className="space-y-2">
          <h4 className="font-medium">System Status</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getStatusIcon(!!apiKeys && apiKeys.length > 0)}
              <span>API Keys Configured: {apiKeys?.length || 0}</span>
            </div>
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

        <div className="space-y-2">
          <h4 className="font-medium">Configuration</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Auto-apply: {config.defaultAutoApply ? 'ON' : 'OFF'}</div>
            <div>Auto-build: {config.defaultAutoBuild ? 'ON' : 'OFF'}</div>
            <div>Auto-preview: {config.defaultAutoPreview ? 'ON' : 'OFF'}</div>
            <div>Preview Port: {config.previewPort}</div>
          </div>
        </div>

        {apiKeys && apiKeys.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">API Keys</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              {apiKeys.map(key => (
                <div key={key.provider}>
                  {key.provider}: {key.hasKey ? '✓' : '✗'}
                </div>
              ))}
            </div>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Projects</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              {projects.slice(0, 3).map(project => (
                <div key={project.id}>
                  {project.name}
                </div>
              ))}
              {projects.length > 3 && (
                <div>... and {projects.length - 3} more</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t">
        Generated at {new Date().toLocaleString()}
      </div>
    </div>
  );
}