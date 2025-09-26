import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Play, Square, CheckCircle, AlertCircle, Loader2, 
  Eye, ExternalLink, Terminal, FileText, Zap,
  ChevronDown, ChevronRight, Hammer, Bug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';
import { useWebSocket } from '../hooks/useWebSocket';

interface BuildStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
  progress?: number;
}

interface BuildWorkflowState {
  isBuilding: boolean;
  isPreviewStarting: boolean;
  currentStep: string | null;
  steps: BuildStep[];
  buildId: string | null;
  previewUrl: string | null;
  errors: string[];
  warnings: string[];
  autoPreview: boolean;
  buildOnSave: boolean;
}

interface BuildWorkflowProps {
  projectId: string;
  onPreviewReady?: (url: string) => void;
  onBuildComplete?: (success: boolean) => void;
  className?: string;
}

export default function BuildWorkflow({
  projectId,
  onPreviewReady,
  onBuildComplete,
  className
}: BuildWorkflowProps) {
  const [workflow, setWorkflow] = useState<BuildWorkflowState>({
    isBuilding: false,
    isPreviewStarting: false,
    currentStep: null,
    steps: [],
    buildId: null,
    previewUrl: null,
    errors: [],
    warnings: [],
    autoPreview: true,
    buildOnSave: false
  });
  const [showLogs, setShowLogs] = useState(false);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default build steps
  const defaultSteps: Omit<BuildStep, 'id'>[] = [
    { name: 'Installing Dependencies', status: 'pending' },
    { name: 'Type Checking', status: 'pending' },
    { name: 'Linting', status: 'pending' },
    { name: 'Building Application', status: 'pending' },
    { name: 'Optimizing Assets', status: 'pending' },
    { name: 'Starting Development Server', status: 'pending' }
  ];

  // WebSocket for real-time build updates
  const { connected } = useWebSocket({
    projectId,
    onBuildUpdate: (status, data) => {
      handleBuildUpdate(status, data);
    },
    onPreviewReady: (url) => {
      setWorkflow(prev => ({ 
        ...prev, 
        previewUrl: url,
        isPreviewStarting: false 
      }));
      onPreviewReady?.(url);
      
      toast({
        title: 'Preview Ready',
        description: 'Your application is now running!',
        action: (
          <Button size="sm" onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Open
          </Button>
        ),
      });
    }
  });

  const handleBuildUpdate = useCallback((status: string, data: any) => {
    setWorkflow(prev => {
      switch (status) {
        case 'started':
          return {
            ...prev,
            isBuilding: true,
            buildId: data.buildId,
            steps: defaultSteps.map((step, index) => ({
              ...step,
              id: `step-${index}`,
              status: index === 0 ? 'running' : 'pending'
            })),
            currentStep: 'step-0',
            errors: [],
            warnings: []
          };
        
        case 'step-completed':
          return {
            ...prev,
            steps: prev.steps.map(step => 
              step.id === data.stepId 
                ? { ...step, status: 'completed', endTime: new Date(), output: data.output }
                : step
            ),
            currentStep: data.nextStepId || null
          };
        
        case 'step-failed':
          return {
            ...prev,
            steps: prev.steps.map(step => 
              step.id === data.stepId 
                ? { ...step, status: 'failed', endTime: new Date(), error: data.error }
                : step
            ),
            errors: [...prev.errors, data.error],
            isBuilding: false
          };
        
        case 'completed':
          return {
            ...prev,
            isBuilding: false,
            steps: prev.steps.map(step => ({
              ...step,
              status: step.status === 'running' ? 'completed' : step.status,
              endTime: step.status === 'running' ? new Date() : step.endTime
            }))
          };
        
        case 'failed':
          return {
            ...prev,
            isBuilding: false,
            errors: [...prev.errors, ...(data.errors || [])]
          };
        
        default:
          return prev;
      }
    });
  }, [defaultSteps]);

  // Mutations
  const buildMutation = useMutation({
    mutationFn: () => backend.workspace.startBuild({ 
      projectId, 
      installDependencies: true
    }),
    onSuccess: () => {
      setWorkflow(prev => ({
        ...prev,
        isBuilding: true,
        steps: defaultSteps.map((step, index) => ({
          ...step,
          id: `step-${index}`,
          status: 'pending'
        }))
      }));
    },
    onError: (error) => {
      toast({
        title: 'Build Failed to Start',
        description: 'Could not initiate the build process.',
        variant: 'destructive',
      });
      setWorkflow(prev => ({ ...prev, isBuilding: false }));
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => backend.workspace.startPreview({ 
      projectId, 
      framework: 'react',
      port: 3000 
    }),
    onSuccess: () => {
      setWorkflow(prev => ({ ...prev, isPreviewStarting: true }));
    },
    onError: (error) => {
      toast({
        title: 'Preview Failed to Start',
        description: 'Could not start the preview server.',
        variant: 'destructive',
      });
      setWorkflow(prev => ({ ...prev, isPreviewStarting: false }));
    },
  });

  const stopPreviewMutation = useMutation({
    mutationFn: () => backend.workspace.stopPreview({ projectId }),
    onSuccess: () => {
      setWorkflow(prev => ({ 
        ...prev, 
        previewUrl: null,
        isPreviewStarting: false 
      }));
      toast({
        title: 'Preview Stopped',
        description: 'Development server has been stopped.',
      });
    },
  });

  // Auto-preview after successful build
  useEffect(() => {
    const allStepsCompleted = workflow.steps.length > 0 && 
      workflow.steps.every(step => step.status === 'completed');
    
    if (allStepsCompleted && workflow.autoPreview && !workflow.previewUrl && !workflow.isPreviewStarting) {
      previewMutation.mutate();
    }
  }, [workflow.steps, workflow.autoPreview, workflow.previewUrl, workflow.isPreviewStarting, previewMutation]);

  // Calculate build progress
  const buildProgress = workflow.steps.length > 0 
    ? (workflow.steps.filter(s => s.status === 'completed').length / workflow.steps.length) * 100
    : 0;

  const hasErrors = workflow.errors.length > 0;
  const hasWarnings = workflow.warnings.length > 0;
  const isRunning = workflow.isBuilding || workflow.isPreviewStarting;

  const getStepIcon = (step: BuildStep) => {
    switch (step.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-200" />;
    }
  };

  const handleBuildAndPreview = async () => {
    try {
      await buildMutation.mutateAsync();
      onBuildComplete?.(true);
    } catch (error) {
      onBuildComplete?.(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Build & Preview
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWorkflow(prev => ({ ...prev, autoPreview: !prev.autoPreview }))}
              className={cn(workflow.autoPreview && "bg-muted")}
            >
              <Zap className="h-3 w-3 mr-1" />
              Auto Preview
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowLogs(!showLogs)}
              className={cn(showLogs && "bg-muted")}
            >
              <Terminal className="h-3 w-3 mr-1" />
              Logs
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Build Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleBuildAndPreview}
              disabled={isRunning}
              className="gap-2"
            >
              {workflow.isBuilding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {workflow.isBuilding ? 'Building...' : 'Build & Preview'}
            </Button>
            
            {workflow.previewUrl ? (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(workflow.previewUrl!, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => stopPreviewMutation.mutate()}
                >
                  <Square className="h-3 w-3 mr-1" />
                  Stop
                </Button>
              </div>
            ) : workflow.isPreviewStarting ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Starting Preview...
              </Badge>
            ) : null}
          </div>
          
          <div className="flex items-center gap-2">
            {hasErrors && (
              <Badge variant="destructive" className="gap-1">
                <Bug className="h-3 w-3" />
                {workflow.errors.length} errors
              </Badge>
            )}
            {hasWarnings && (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {workflow.warnings.length} warnings
              </Badge>
            )}
          </div>
        </div>

        {/* Build Progress */}
        {workflow.isBuilding && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Build Progress</span>
              <span>{Math.round(buildProgress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${buildProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Build Steps */}
        {workflow.steps.length > 0 && (
          <div className="space-y-1">
            {workflow.steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  step.status === 'running' && "bg-blue-50 dark:bg-blue-950/30",
                  step.status === 'completed' && "bg-green-50 dark:bg-green-950/30",
                  step.status === 'failed' && "bg-red-50 dark:bg-red-950/30"
                )}
              >
                {getStepIcon(step)}
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{step.name}</span>
                    {step.endTime && step.startTime && (
                      <span className="text-xs text-muted-foreground">
                        {step.endTime.getTime() - step.startTime.getTime()}ms
                      </span>
                    )}
                  </div>
                  
                  {step.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {step.error}
                    </p>
                  )}
                </div>
                
                {(step.output || step.error) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
                  >
                    {selectedStep === step.id ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step Details */}
        {selectedStep && (
          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <ScrollArea className="h-32">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {workflow.steps.find(s => s.id === selectedStep)?.output ||
                   workflow.steps.find(s => s.id === selectedStep)?.error ||
                   'No output available'}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Error Summary */}
        {hasErrors && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Build Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-20">
                <div className="space-y-1">
                  {workflow.errors.map((error, index) => (
                    <p key={index} className="text-xs text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWorkflow(prev => ({ ...prev, buildOnSave: !prev.buildOnSave }))}
            className={cn(workflow.buildOnSave && "bg-muted")}
          >
            Build on Save
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['workspace-status', projectId] })}
          >
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}