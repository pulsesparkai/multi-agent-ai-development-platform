import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, AlertTriangle, CheckCircle, X, Eye, 
  GitMerge, Clock, Zap, Diff, FileCheck 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';

export interface PendingChange {
  id: string;
  operation: 'create' | 'update' | 'delete';
  filePath: string;
  newContent?: string;
  oldContent?: string;
  timestamp: Date;
  source: 'ai_chat' | 'user_edit' | 'multi_agent';
  conflict?: {
    type: 'file_exists' | 'content_differs' | 'permission_denied';
    message: string;
  };
  autoApplied?: boolean;
}

interface AutoApplySettings {
  enabled: boolean;
  autoResolveConflicts: boolean;
  confirmBeforeApply: boolean;
  delayMs: number;
}

interface AutoApplyManagerProps {
  projectId: string;
  pendingChanges: PendingChange[];
  onApplyChanges: (changeIds: string[]) => Promise<void>;
  onRejectChanges: (changeIds: string[]) => Promise<void>;
  className?: string;
}

export default function AutoApplyManager({
  projectId,
  pendingChanges,
  onApplyChanges,
  onRejectChanges,
  className
}: AutoApplyManagerProps) {
  const [settings, setSettings] = useState<AutoApplySettings>({
    enabled: true,
    autoResolveConflicts: false,
    confirmBeforeApply: false,
    delayMs: 1000
  });
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [viewingDiff, setViewingDiff] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-apply logic
  useEffect(() => {
    if (!settings.enabled || pendingChanges.length === 0) return;

    const autoApplicableChanges = pendingChanges.filter(change => 
      !change.conflict || (change.conflict && settings.autoResolveConflicts)
    );

    if (autoApplicableChanges.length === 0) return;

    const timer = setTimeout(async () => {
      if (settings.confirmBeforeApply) {
        toast({
          title: 'Auto-Apply Ready',
          description: `${autoApplicableChanges.length} changes ready to apply`,
          action: (
            <Button 
              size="sm" 
              onClick={() => handleApplyChanges(autoApplicableChanges.map(c => c.id))}
            >
              Apply Now
            </Button>
          ),
        });
      } else {
        await handleApplyChanges(autoApplicableChanges.map(c => c.id));
      }
    }, settings.delayMs);

    return () => clearTimeout(timer);
  }, [pendingChanges, settings]);

  const handleApplyChanges = async (changeIds: string[]) => {
    try {
      await onApplyChanges(changeIds);
      toast({
        title: 'Changes Applied',
        description: `Successfully applied ${changeIds.length} changes`,
      });
    } catch (error) {
      toast({
        title: 'Apply Failed',
        description: 'Failed to apply some changes',
        variant: 'destructive',
      });
    }
  };

  const handleRejectChanges = async (changeIds: string[]) => {
    try {
      await onRejectChanges(changeIds);
      toast({
        title: 'Changes Rejected',
        description: `Rejected ${changeIds.length} changes`,
      });
    } catch (error) {
      toast({
        title: 'Reject Failed',
        description: 'Failed to reject changes',
        variant: 'destructive',
      });
    }
  };

  const toggleChangeSelection = (changeId: string) => {
    setSelectedChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(changeId)) {
        newSet.delete(changeId);
      } else {
        newSet.add(changeId);
      }
      return newSet;
    });
  };

  const selectAllChanges = () => {
    setSelectedChanges(new Set(pendingChanges.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedChanges(new Set());
  };

  const getChangeIcon = (change: PendingChange) => {
    if (change.conflict) {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    
    switch (change.operation) {
      case 'create':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'update':
        return <FileCheck className="h-4 w-4 text-blue-500" />;
      case 'delete':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getOperationBadge = (operation: string) => {
    const variants = {
      create: 'default',
      update: 'secondary',
      delete: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[operation as keyof typeof variants] || 'outline'}>
        {operation.toUpperCase()}
      </Badge>
    );
  };

  if (pendingChanges.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
          <p className="text-muted-foreground">No pending changes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Auto-Apply Manager
            <Badge variant="secondary">{pendingChanges.length}</Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4"
            />
            <Label className="text-sm">Auto-apply</Label>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Settings */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Auto-resolve conflicts</Label>
            <input
              type="checkbox"
              checked={settings.autoResolveConflicts}
              onChange={(e) => setSettings(prev => ({ ...prev, autoResolveConflicts: e.target.checked }))}
              className="h-3 w-3"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label className="text-xs">Confirm before apply</Label>
            <input
              type="checkbox"
              checked={settings.confirmBeforeApply}
              onChange={(e) => setSettings(prev => ({ ...prev, confirmBeforeApply: e.target.checked }))}
              className="h-3 w-3"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={selectAllChanges}
              disabled={selectedChanges.size === pendingChanges.length}
            >
              Select All
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={clearSelection}
              disabled={selectedChanges.size === 0}
            >
              Clear
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm"
              onClick={() => handleApplyChanges(Array.from(selectedChanges))}
              disabled={selectedChanges.size === 0}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Apply ({selectedChanges.size})
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleRejectChanges(Array.from(selectedChanges))}
              disabled={selectedChanges.size === 0}
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        </div>

        {/* Changes List */}
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {pendingChanges.map((change) => (
              <div
                key={change.id}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                  selectedChanges.has(change.id) && "bg-muted border-primary",
                  change.conflict && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50"
                )}
                onClick={() => toggleChangeSelection(change.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedChanges.has(change.id)}
                  onChange={() => toggleChangeSelection(change.id)}
                  className="h-4 w-4"
                />
                
                <div className="flex-shrink-0">
                  {getChangeIcon(change)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {change.filePath}
                    </span>
                    {getOperationBadge(change.operation)}
                    <Badge variant="outline" className="text-xs">
                      {change.source}
                    </Badge>
                  </div>
                  
                  {change.conflict && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {change.conflict.message}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {change.timestamp.toLocaleTimeString()}
                    {change.autoApplied && (
                      <Badge variant="secondary" className="h-4">
                        <Zap className="h-2 w-2 mr-1" />
                        Auto-applied
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingDiff(change.id);
                    }}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyChanges([change.id]);
                    }}
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRejectChanges([change.id]);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Auto-apply Status */}
        {settings.enabled && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm text-blue-700 dark:text-blue-300">
            <Zap className="h-4 w-4" />
            <span>
              Auto-apply is enabled. Changes will be applied in {settings.delayMs / 1000}s
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for managing auto-apply state
export function useAutoApply(projectId: string) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const backend = useBackend();

  const addPendingChange = (change: Omit<PendingChange, 'id' | 'timestamp'>) => {
    const newChange: PendingChange = {
      ...change,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    
    setPendingChanges(prev => [...prev, newChange]);
  };

  const removePendingChanges = (changeIds: string[]) => {
    setPendingChanges(prev => prev.filter(change => !changeIds.includes(change.id)));
  };

  const applyChanges = async (changeIds: string[]) => {
    const changes = pendingChanges.filter(change => changeIds.includes(change.id));
    
    // Apply changes via backend
    for (const change of changes) {
      try {
        switch (change.operation) {
          case 'create':
          case 'update':
            await backend.files.update({
              projectId,
              fileId: change.filePath,
              content: change.newContent || ''
            });
            break;
          case 'delete':
            // Implement delete operation
            break;
        }
      } catch (error) {
        console.error('Failed to apply change:', error);
        throw error;
      }
    }
    
    // Mark as applied and remove
    removePendingChanges(changeIds);
  };

  const rejectChanges = async (changeIds: string[]) => {
    removePendingChanges(changeIds);
  };

  return {
    pendingChanges,
    addPendingChange,
    removePendingChanges,
    applyChanges,
    rejectChanges,
  };
}