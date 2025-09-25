import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Editor } from '@monaco-editor/react';
import { MessageSquare, Folder, File, Plus, Bot, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';
import type { File as ProjectFile } from '~backend/files/get';

interface CodeEditorProps {
  projectId: string;
  onToggleChat: () => void;
  onToggleMultiAgent: () => void;
  showChat: boolean;
  showMultiAgent: boolean;
}

export default function CodeEditor({ projectId, onToggleChat, onToggleMultiAgent, showChat, showMultiAgent }: CodeEditorProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => backend.projects.get({ id: projectId }),
  });

  const { data: files } = useQuery({
    queryKey: ['files', projectId],
    queryFn: () => backend.files.list({ projectId }),
  });

  const { data: currentFile } = useQuery({
    queryKey: ['file', projectId, selectedFile],
    queryFn: () => backend.files.get({ projectId, fileId: selectedFile! }),
    enabled: !!selectedFile,
  });

  const updateFileMutation = useMutation({
    mutationFn: (content: string) =>
      backend.files.update({ projectId, fileId: selectedFile!, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file', projectId, selectedFile] });
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

  // Update local content when file changes
  useEffect(() => {
    if (currentFile) {
      setFileContent(currentFile.content);
    }
  }, [currentFile]);

  // Select first file by default
  useEffect(() => {
    if (files?.files.length && !selectedFile) {
      setSelectedFile(files.files[0].id);
    }
  }, [files, selectedFile]);

  // Auto-save file content with debouncing
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
    switch (ext) {
      case 'js':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'jsx':
        return 'javascript';
      case 'tsx':
        return 'typescript';
      case 'py':
        return 'python';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  const selectedFileData = files?.files.find(f => f.id === selectedFile);

  // Generate preview content for HTML files
  const getPreviewContent = () => {
    if (!selectedFileData || !selectedFileData.name.endsWith('.html')) {
      return '<p>Preview only available for HTML files</p>';
    }
    
    // For now, just use the current file content
    // TODO: Enhance this to fetch and inject CSS/JS from other files
    return fileContent || '<p>No content</p>';
  };

  return (
    <div className="flex h-full">
      {/* File Explorer */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
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

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {selectedFileData && (
              <>
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedFileData.name}</span>
                {updateFileMutation.isPending && (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowPreview(!showPreview)}
              className={cn(showPreview && "bg-muted")}
              title="Toggle Preview"
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
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

        {/* Editor Content */}
        <div className="flex-1 flex">
          {/* Code Editor */}
          <div className={cn("flex-1", showPreview && "w-1/2")}>
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
          </div>

          {/* Live Preview */}
          {showPreview && (
            <div className="w-1/2 border-l border-border bg-background">
              <div className="h-full">
                {selectedFileData && selectedFileData.name.endsWith('.html') ? (
                  <iframe
                    srcDoc={getPreviewContent()}
                    className="w-full h-full border-0"
                    title="Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Preview only available for HTML files</p>
                      <p className="text-sm mt-1">Select an HTML file to see live preview</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
