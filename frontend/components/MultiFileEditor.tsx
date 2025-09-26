import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Editor } from '@monaco-editor/react';
import { 
  Files, File, Plus, X, Save, Undo2, Redo2, 
  Search, Replace, Split, Maximize2, Minimize2,
  GitCompare, Clock, AlertCircle, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';
import { useWebSocket } from '../hooks/useWebSocket';

interface OpenFile {
  id: string;
  name: string;
  path: string;
  content: string;
  originalContent: string;
  language: string;
  modified: boolean;
  lastSaved: Date | null;
  cursorPosition?: { lineNumber: number; column: number };
}

interface FileContext {
  openFiles: Map<string, OpenFile>;
  activeFileId: string | null;
  splitView: boolean;
  splitFileIds: [string | null, string | null];
}

interface MultiFileEditorProps {
  projectId: string;
  initialFileId?: string;
  onFileSelect?: (fileId: string) => void;
  className?: string;
}

export default function MultiFileEditor({
  projectId,
  initialFileId,
  onFileSelect,
  className
}: MultiFileEditorProps) {
  const [context, setContext] = useState<FileContext>({
    openFiles: new Map(),
    activeFileId: null,
    splitView: false,
    splitFileIds: [null, null]
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [syncedChanges, setSyncedChanges] = useState<Map<string, Date>>(new Map());
  
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editorsRef = useRef<Map<string, any>>(new Map());
  const autoSaveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // WebSocket for real-time synchronization
  const { connected } = useWebSocket({
    projectId,
    onFileUpdate: (filePath, operation) => {
      if (operation === 'update') {
        // Another user updated a file, refresh if we have it open
        const openFile = Array.from(context.openFiles.values())
          .find(f => f.path === filePath);
        
        if (openFile) {
          queryClient.invalidateQueries({ 
            queryKey: ['file', projectId, openFile.id] 
          });
          setSyncedChanges(prev => new Map(prev.set(openFile.id, new Date())));
        }
      }
    }
  });

  // Query for project files list
  const { data: files } = useQuery({
    queryKey: ['files', projectId],
    queryFn: () => backend.files.list({ projectId }),
  });

  // Mutations
  const saveFileMutation = useMutation({
    mutationFn: ({ fileId, content }: { fileId: string; content: string }) =>
      backend.files.update({ projectId, fileId, content }),
    onSuccess: (_, { fileId }) => {
      updateOpenFile(fileId, { 
        modified: false, 
        lastSaved: new Date(),
        originalContent: context.openFiles.get(fileId)?.content || ''
      });
      queryClient.invalidateQueries({ queryKey: ['file', projectId, fileId] });
    },
    onError: (error, { fileId }) => {
      console.error('Failed to save file:', error);
      toast({
        title: 'Save Failed',
        description: `Failed to save ${context.openFiles.get(fileId)?.name}`,
        variant: 'destructive',
      });
    },
  });

  const openFile = useCallback(async (fileId: string) => {
    if (context.openFiles.has(fileId)) {
      setContext(prev => ({ ...prev, activeFileId: fileId }));
      return;
    }

    try {
      const fileData = await backend.files.get({ projectId, fileId });
      const fileInfo = files?.files.find(f => f.id === fileId);
      
      if (!fileInfo) return;

      const newFile: OpenFile = {
        id: fileId,
        name: fileInfo.name,
        path: fileInfo.name, // Assuming name contains path
        content: fileData.content,
        originalContent: fileData.content,
        language: getLanguageFromFile(fileInfo.name),
        modified: false,
        lastSaved: new Date(),
      };

      setContext(prev => ({
        ...prev,
        openFiles: new Map(prev.openFiles.set(fileId, newFile)),
        activeFileId: fileId
      }));

      onFileSelect?.(fileId);
    } catch (error) {
      toast({
        title: 'Failed to open file',
        description: 'Could not load the file content.',
        variant: 'destructive',
      });
    }
  }, [backend, projectId, files, context.openFiles, onFileSelect, toast]);

  const closeFile = useCallback((fileId: string) => {
    const file = context.openFiles.get(fileId);
    if (file?.modified) {
      // Ask user to save changes
      if (confirm(`${file.name} has unsaved changes. Save before closing?`)) {
        saveFileMutation.mutate({ fileId, content: file.content });
      }
    }

    setContext(prev => {
      const newOpenFiles = new Map(prev.openFiles);
      newOpenFiles.delete(fileId);
      
      let newActiveFileId = prev.activeFileId;
      if (prev.activeFileId === fileId) {
        // Switch to another open file
        const remainingFiles = Array.from(newOpenFiles.keys());
        newActiveFileId = remainingFiles.length > 0 ? remainingFiles[0] : null;
      }

      return {
        ...prev,
        openFiles: newOpenFiles,
        activeFileId: newActiveFileId,
        splitFileIds: prev.splitFileIds.map(id => id === fileId ? null : id) as [string | null, string | null]
      };
    });

    // Clear auto-save timer
    const timer = autoSaveTimers.current.get(fileId);
    if (timer) {
      clearTimeout(timer);
      autoSaveTimers.current.delete(fileId);
    }
  }, [context.openFiles, saveFileMutation]);

  const updateOpenFile = useCallback((fileId: string, updates: Partial<OpenFile>) => {
    setContext(prev => {
      const file = prev.openFiles.get(fileId);
      if (!file) return prev;

      const updatedFile = { ...file, ...updates };
      return {
        ...prev,
        openFiles: new Map(prev.openFiles.set(fileId, updatedFile))
      };
    });
  }, []);

  const handleContentChange = useCallback((fileId: string, content: string) => {
    const file = context.openFiles.get(fileId);
    if (!file) return;

    const modified = content !== file.originalContent;
    updateOpenFile(fileId, { content, modified });

    // Auto-save logic
    if (autoSave && modified) {
      const existingTimer = autoSaveTimers.current.get(fileId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        if (context.openFiles.get(fileId)?.modified) {
          saveFileMutation.mutate({ fileId, content });
        }
      }, 2000);

      autoSaveTimers.current.set(fileId, timer);
    }
  }, [context.openFiles, autoSave, saveFileMutation, updateOpenFile]);

  const saveFile = useCallback((fileId: string) => {
    const file = context.openFiles.get(fileId);
    if (!file || !file.modified) return;

    saveFileMutation.mutate({ fileId, content: file.content });
  }, [context.openFiles, saveFileMutation]);

  const saveAllFiles = useCallback(() => {
    const modifiedFiles = Array.from(context.openFiles.values())
      .filter(file => file.modified);

    modifiedFiles.forEach(file => {
      saveFileMutation.mutate({ fileId: file.id, content: file.content });
    });
  }, [context.openFiles, saveFileMutation]);

  const toggleSplitView = useCallback(() => {
    setContext(prev => {
      if (!prev.splitView && prev.activeFileId) {
        return {
          ...prev,
          splitView: true,
          splitFileIds: [prev.activeFileId, null]
        };
      } else {
        return {
          ...prev,
          splitView: false,
          splitFileIds: [null, null]
        };
      }
    });
  }, []);

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

  // Initialize with initial file
  useEffect(() => {
    if (initialFileId && !context.openFiles.has(initialFileId)) {
      openFile(initialFileId);
    }
  }, [initialFileId, openFile, context.openFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            if (e.shiftKey) {
              saveAllFiles();
            } else if (context.activeFileId) {
              saveFile(context.activeFileId);
            }
            break;
          case 'w':
            e.preventDefault();
            if (context.activeFileId) {
              closeFile(context.activeFileId);
            }
            break;
          case 'f':
            e.preventDefault();
            setShowSearch(!showSearch);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [context.activeFileId, saveFile, saveAllFiles, closeFile, showSearch]);

  const openFilesList = Array.from(context.openFiles.values());
  const activeFile = context.activeFileId ? context.openFiles.get(context.activeFileId) : null;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Files className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Multi-File Editor</span>
          
          {openFilesList.length > 0 && (
            <Badge variant="secondary">{openFilesList.length} open</Badge>
          )}
          
          {connected && (
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
              Synced
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSearch(!showSearch)}
            title="Search & Replace (Ctrl+F)"
          >
            <Search className="h-3 w-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleSplitView}
            title="Toggle Split View"
          >
            {context.splitView ? <Minimize2 className="h-3 w-3" /> : <Split className="h-3 w-3" />}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={saveAllFiles}
            disabled={!openFilesList.some(f => f.modified)}
            title="Save All (Ctrl+Shift+S)"
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7"
          />
          <Input
            placeholder="Replace..."
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            className="h-7"
          />
          <Button size="sm" variant="outline">
            <Replace className="h-3 w-3 mr-1" />
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSearch(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* File Tabs */}
      {openFilesList.length > 0 && (
        <div className="flex items-center gap-1 p-1 border-b border-border bg-muted/30 overflow-x-auto">
          {openFilesList.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer whitespace-nowrap",
                context.activeFileId === file.id 
                  ? "bg-background border border-border" 
                  : "hover:bg-muted"
              )}
              onClick={() => setContext(prev => ({ ...prev, activeFileId: file.id }))}
            >
              <File className="h-3 w-3 text-muted-foreground" />
              <span className={cn(file.modified && "text-blue-600 font-medium")}>
                {file.name}
                {file.modified && "*"}
              </span>
              
              {syncedChanges.has(file.id) && (
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
              
              <Button
                size="sm"
                variant="ghost"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.id);
                }}
              >
                <X className="h-2 w-2" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 flex">
        {context.splitView ? (
          <>
            {/* Split View */}
            <div className="flex-1 border-r border-border">
              {context.splitFileIds[0] && renderEditor(context.splitFileIds[0], 0)}
            </div>
            <div className="flex-1">
              {context.splitFileIds[1] && renderEditor(context.splitFileIds[1], 1)}
            </div>
          </>
        ) : (
          /* Single View */
          <div className="flex-1">
            {activeFile && renderEditor(activeFile.id, 0)}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-t border-border bg-card text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {activeFile && (
            <>
              <span>{activeFile.language}</span>
              <span>
                {activeFile.modified ? 'Modified' : 'Saved'}
                {activeFile.lastSaved && ` • ${activeFile.lastSaved.toLocaleTimeString()}`}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => setAutoSave(!autoSave)}
          >
            Auto-save: {autoSave ? 'On' : 'Off'}
          </Button>
        </div>
      </div>
    </div>
  );

  function renderEditor(fileId: string, editorIndex: number) {
    const file = context.openFiles.get(fileId);
    if (!file) {
      return (
        <div className="h-full flex items-center justify-center bg-muted/30">
          <div className="text-center text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a file to edit</p>
          </div>
        </div>
      );
    }

    return (
      <Editor
        height="100%"
        language={file.language}
        value={file.content}
        onChange={(content) => handleContentChange(fileId, content || '')}
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
          wordWrap: 'on',
          find: {
            seedSearchStringFromSelection: 'selection',
            autoFindInSelection: 'never'
          }
        }}
        onMount={(editor) => {
          editorsRef.current.set(`${fileId}-${editorIndex}`, editor);
          
          // Restore cursor position if available
          if (file.cursorPosition) {
            editor.setPosition({
              lineNumber: file.cursorPosition.lineNumber,
              column: file.cursorPosition.column
            });
          }
        }}
      />
    );
  }
}