import React, { useState, useEffect } from 'react';
import { Brain, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThinkingStep {
  id: string;
  title: string;
  status: 'thinking' | 'generating' | 'parsing' | 'applying' | 'building' | 'previewing' | 'completed' | 'error';
  description?: string;
  timestamp: Date;
  output?: string;
  progress?: number;
}

interface AIThinkingDisplayProps {
  steps: ThinkingStep[];
  isActive: boolean;
  className?: string;
}

const getStepIcon = (status: ThinkingStep['status']) => {
  switch (status) {
    case 'thinking':
      return <Brain className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'generating':
      return <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />;
    case 'parsing':
    case 'applying':
    case 'building':
    case 'previewing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />;
  }
};

const getStepColor = (status: ThinkingStep['status']) => {
  switch (status) {
    case 'thinking':
    case 'generating':
      return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950';
    case 'parsing':
    case 'applying':
      return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950';
    case 'building':
    case 'previewing':
      return 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950';
    case 'completed':
      return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
    case 'error':
      return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
    default:
      return 'border-border bg-card';
  }
};

export default function AIThinkingDisplay({ steps, isActive, className }: AIThinkingDisplayProps) {
  const [visibleSteps, setVisibleSteps] = useState<ThinkingStep[]>([]);

  useEffect(() => {
    if (steps.length === 0) {
      setVisibleSteps([]);
      return;
    }

    // Gradually reveal steps with animation
    let timeouts: NodeJS.Timeout[] = [];
    
    steps.forEach((step, index) => {
      const timeout = setTimeout(() => {
        setVisibleSteps(prev => {
          const existing = prev.find(s => s.id === step.id);
          if (existing) {
            // Update existing step
            return prev.map(s => s.id === step.id ? step : s);
          } else {
            // Add new step
            return [...prev, step];
          }
        });
      }, index * 200);
      
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [steps]);

  if (!isActive && visibleSteps.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {isActive && (
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Brain className="h-4 w-4 animate-pulse" />
          <span>AI is thinking...</span>
        </div>
      )}
      
      <div className="space-y-1">
        {visibleSteps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 transform",
              getStepColor(step.status),
              "animate-in slide-in-from-left-5 fade-in duration-500"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStepIcon(step.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{step.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {step.timestamp.toLocaleTimeString()}
                </span>
              </div>
              
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
              
              {step.progress !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{Math.round(step.progress)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${step.progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {step.output && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground">
                  {step.output.length > 100 
                    ? `${step.output.substring(0, 100)}...` 
                    : step.output
                  }
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for managing thinking steps
export function useAIThinking() {
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [isActive, setIsActive] = useState(false);

  const addStep = (step: Omit<ThinkingStep, 'id' | 'timestamp'>) => {
    const newStep: ThinkingStep = {
      ...step,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    
    setSteps(prev => [...prev, newStep]);
    setIsActive(true);
  };

  const updateStep = (id: string, updates: Partial<ThinkingStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  const clearSteps = () => {
    setSteps([]);
    setIsActive(false);
  };

  const completeThinking = () => {
    setIsActive(false);
    // Keep steps visible for a while after completion
    setTimeout(() => {
      setSteps([]);
    }, 5000);
  };

  return {
    steps,
    isActive,
    addStep,
    updateStep,
    clearSteps,
    completeThinking,
  };
}