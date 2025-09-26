import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Editor } from '@monaco-editor/react';
import { 
  MessageSquare, Folder, File, Plus, Bot, Eye, EyeOff, 
  Play, Square, GitCommit, Diff, AlertCircle, CheckCircle,
  Loader2, ExternalLink, Hammer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';
import { useWebSocket } from '../hooks/useWebSocket';
import PreviewPanel from './PreviewPanel';
import type { File as ProjectFile } from '~backend/files/get';

interface EnhancedCodeEditorProps {
  projectId: string;
  onToggleChat: () => void;
  onToggleMultiAgent: () => void;
  showChat: boolean;
  showMultiAgent: boolean;
}

interface FileChange {
  id: string;
  operation: 'create' | 'update' | 'delete';
  filePath: string;
  content?: string;
  timestamp: Date;
  applied: boolean;
  source: string;
}

interface WorkspaceStatus {
  fileCount: number;
  pendingChanges: number;
  buildStatus?: {
    status: 'running' | 'completed' | 'failed';
    output?: string;
    error?: string;
  };
  previewServer?: {
    url: string;
    status: 'starting' | 'running' | 'stopped' | 'error';
  };
}

export default function EnhancedCodeEditor({ 
  projectId, 
  onToggleChat, 
  onToggleMultiAgent, 
  showChat, 
  showMultiAgent 
}: EnhancedCodeEditorProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'changes' | 'preview'>('code');
  const [realtimePreviewUrl, setRealtimePreviewUrl] = useState<string>('');
  
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebSocket for real-time updates
  const { connected: wsConnected } = useWebSocket({
    projectId,
    onFileUpdate: (filePath, operation) => {
      // Refresh file list when files are created/updated
      queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      if (selectedFile && filePath.includes(selectedFile)) {
        queryClient.invalidateQueries({ queryKey: ['file', projectId, selectedFile] });
      }
    },
    onPreviewReady: (url) => {
      setRealtimePreviewUrl(url);
      setShowPreview(true);
      setActiveTab('preview');
    },
    onBuildUpdate: (status) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-status', projectId] });
    }
  });

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => backend.projects.get({ id: projectId }),
  });

  const { data: files } = useQuery({
    queryKey: ['files', projectId],
    queryFn: () => backend.files.list({ projectId }),
  });

  const { data: currentFile, error: fileError } = useQuery({
    queryKey: ['file', projectId, selectedFile],
    queryFn: () => backend.files.get({ projectId, fileId: selectedFile! }),
    enabled: !!selectedFile,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors
      if (error?.status === 404 || error?.message?.includes('not found')) {
        console.warn('File not found, clearing selection:', selectedFile);
        setSelectedFile(null);
        return false;
      }
      return failureCount < 3;
    },
  });

  const { data: workspaceStatus, refetch: refetchWorkspaceStatus } = useQuery({
    queryKey: ['workspace-status', projectId],
    queryFn: () => backend.workspace.getWorkspaceStatus({ projectId }),
    refetchInterval: wsConnected ? 15000 : 2000, // Poll every 15s if WS connected, 2s if not
  });

  const { data: previewUrl } = useQuery({
    queryKey: ['preview-url', projectId],
    queryFn: () => backend.workspace.getPreviewUrl({ projectId }),
    refetchInterval: wsConnected ? 20000 : 5000, // Poll every 20s if WS connected, 5s if not
  });

  // Mutations
  const updateFileMutation = useMutation({
    mutationFn: (content: string) =>
      backend.files.update({ projectId, fileId: selectedFile!, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', projectId, selectedFile] });
      queryClient.invalidateQueries({ queryKey: ['workspace-status', projectId] });
    },
    onError: (error) => {
      console.error('Failed to save file:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const buildProjectMutation = useMutation({
    mutationFn: () => backend.workspace.startBuild({ projectId, installDependencies: true }),
    onSuccess: () => {
      toast({
        title: 'Build Started',
        description: 'Project build has been initiated.',
      });
      refetchWorkspaceStatus();
    },
    onError: (error) => {
      toast({
        title: 'Build Failed',
        description: 'Failed to start build process.',
        variant: 'destructive',
      });
    },
  });

  const startPreviewMutation = useMutation({
    mutationFn: () => backend.workspace.startPreview({ projectId, framework: 'react' }),
    onSuccess: () => {
      toast({
        title: 'Preview Started',
        description: 'Preview server is starting up.',
      });
      refetchWorkspaceStatus();
    },
    onError: (error) => {
      toast({
        title: 'Preview Failed',
        description: 'Failed to start preview server.',
        variant: 'destructive',
      });
    },
  });

  const stopPreviewMutation = useMutation({
    mutationFn: () => backend.workspace.stopPreview({ projectId }),
    onSuccess: () => {
      toast({
        title: 'Preview Stopped',
        description: 'Preview server has been stopped.',
      });
      refetchWorkspaceStatus();
    },
  });

  // Effects
  useEffect(() => {
    if (currentFile) {
      setFileContent(currentFile.content);
    }
  }, [currentFile]);

  useEffect(() => {
    if (files?.files.length && !selectedFile) {
      setSelectedFile(files.files[0].id);
    }
  }, [files, selectedFile]);

  // Auto-save with debouncing
  useEffect(() => {
    if (!selectedFile || !currentFile) return;
    
    const timer = setTimeout(() => {
      if (fileContent !== currentFile.content) {
        updateFileMutation.mutate(fileContent);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [fileContent, selectedFile, currentFile]);

  const getLanguageFromFile = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',  
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      md: 'markdown',
      yml: 'yaml',
      yaml: 'yaml'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  // Update file content when currentFile changes
  useEffect(() => {
    if (currentFile) {
      setFileContent(currentFile.content);
    } else {
      setFileContent('');
    }
  }, [currentFile]);

  // Handle file errors (404s, etc.)
  useEffect(() => {
    if (fileError && selectedFile) {
      console.error('Error loading file:', fileError);
      if (fileError.message?.includes('not found') || fileError.status === 404) {
        console.warn('File not found, clearing selection:', selectedFile);
        setSelectedFile(null);
        toast({
          title: 'File not found',
          description: 'The selected file could not be found. It may have been deleted.',
          variant: 'destructive',
        });
      }
    }
  }, [fileError, selectedFile, toast]);

  const selectedFileData = files?.files.find(f => f.id === selectedFile);

  const getBuildStatusIcon = () => {
    if (!workspaceStatus?.buildStatus) return null;
    
    switch (workspaceStatus.buildStatus.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getPreviewStatusIcon = () => {
    if (!workspaceStatus?.previewServer) return null;
    
    switch (workspaceStatus.previewServer.status) {
      case 'starting':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Square className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate">
                {project?.name || 'Project'}
              </span>
            </div>
            <Button size="sm" variant="ghost">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Workspace Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Files:</span>
              <Badge variant="secondary" className="h-5">
                {workspaceStatus?.fileCount || 0}
              </Badge>
            </div>
            
            {workspaceStatus?.pendingChanges && workspaceStatus.pendingChanges > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending:</span>
                <Badge variant="outline" className="h-5">
                  {workspaceStatus.pendingChanges}
                </Badge>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {files?.files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 text-sm",
                selectedFile === file.id && "bg-muted"
              )}
              onClick={() => setSelectedFile(file.id)}
            >
              <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{file.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {selectedFileData && (
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedFileData.name}</span>
                {updateFileMutation.isPending && (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
              </div>
            )}
            
            {/* Build Status */}
            <div className="flex items-center gap-2">
              {getBuildStatusIcon()}
              <Button
                size="sm"
                variant="outline"
                onClick={() => buildProjectMutation.mutate()}
                disabled={buildProjectMutation.isPending || workspaceStatus?.buildStatus?.status === 'running'}
                className="gap-2"
              >
                <Play className="h-3 w-3" />
                Build
              </Button>
            </div>
            
            {/* Preview Status */}
            <div className="flex items-center gap-2">
              {getPreviewStatusIcon()}
              {workspaceStatus?.previewServer?.status === 'running' ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => previewUrl?.url && window.open(previewUrl.url, '_blank')}
                    disabled={!previewUrl?.url}
                    className="gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => stopPreviewMutation.mutate()}
                    className="gap-2"
                  >
                    <Square className="h-3 w-3" />
                    Stop
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startPreviewMutation.mutate()}
                  disabled={startPreviewMutation.isPending || workspaceStatus?.previewServer?.status === 'starting'}
                  className="gap-2"
                >
                  <Play className="h-3 w-3" />
                  Preview
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleMultiAgent}
              className={cn(showMultiAgent && "bg-muted")}
              title="Toggle Multi-Agent Dashboard"
            >
              <Bot className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onToggleChat}
              className={cn(showChat && "bg-muted")}
              title="Toggle Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabbed Content Area */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full flex flex-col">
            <TabsList className="border-b border-border rounded-none bg-transparent p-0 h-10">
              <TabsTrigger value="code" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Code
              </TabsTrigger>
              <TabsTrigger value="changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                <div className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" />
                  Changes
                  {workspaceStatus?.pendingChanges && workspaceStatus.pendingChanges > 0 && (
                    <Badge variant="secondary" className="h-4 text-xs">
                      {workspaceStatus.pendingChanges}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Preview
                  {workspaceStatus?.previewServer?.status === 'running' && (
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                </div>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="code" className="flex-1 m-0">
              {selectedFileData ? (
                <Editor
                  height="100%"
                  language={getLanguageFromFile(selectedFileData.name)}
                  value={fileContent}
                  onChange={(value) => setFileContent(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-muted/30">
                  <div className="text-center text-muted-foreground">
                    <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a file to start editing</p>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="changes" className="flex-1 m-0 p-4">
              <div className="h-full">
                <h3 className="text-lg font-medium mb-4">File Changes</h3>
                <div className="text-center text-muted-foreground">
                  <Diff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>File change tracking coming soon</p>
                  <p className="text-sm mt-1">View diffs and revert changes</p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="flex-1 m-0">
              <PreviewPanel 
                projectId={projectId}
                previewUrl={realtimePreviewUrl || previewUrl?.url || undefined}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}