import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, CheckCircle, AlertCircle, Info, X, Eye, EyeOff,
  Loader2, Clock, Zap, FileText, Hammer, Bot, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export type FeedbackType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'loading' 
  | 'progress';

export type FeedbackCategory = 
  | 'ai' 
  | 'build' 
  | 'preview' 
  | 'file' 
  | 'multi_agent' 
  | 'system';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  category: FeedbackCategory;
  title: string;
  message: string;
  timestamp: Date;
  duration?: number; // Auto-dismiss after ms
  progress?: number; // 0-100 for progress type
  actions?: FeedbackAction[];
  persistent?: boolean;
  details?: string;
  context?: Record<string, any>;
}

export interface FeedbackAction {
  label: string;
  action: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

interface FeedbackSystemProps {
  className?: string;
  maxItems?: number;
  showHistory?: boolean;
  autoHide?: boolean;
}

interface FeedbackContextType {
  items: FeedbackItem[];
  addFeedback: (item: Omit<FeedbackItem, 'id' | 'timestamp'>) => string;
  updateFeedback: (id: string, updates: Partial<FeedbackItem>) => void;
  removeFeedback: (id: string) => void;
  clearAll: () => void;
  clearByCategory: (category: FeedbackCategory) => void;
}

// Global feedback context
let globalFeedbackContext: FeedbackContextType | null = null;

export function useFeedback(): FeedbackContextType {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  
  const addFeedback = useCallback((item: Omit<FeedbackItem, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const feedbackItem: FeedbackItem = {
      ...item,
      id,
      timestamp: new Date(),
    };
    
    setItems(prev => {
      const newItems = [feedbackItem, ...prev];
      // Limit total items to prevent memory issues
      return newItems.slice(0, 100);
    });
    
    // Auto-dismiss if duration is set
    if (item.duration && !item.persistent) {
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== id));
      }, item.duration);
    }
    
    return id;
  }, []);
  
  const updateFeedback = useCallback((id: string, updates: Partial<FeedbackItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);
  
  const removeFeedback = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);
  
  const clearAll = useCallback(() => {
    setItems([]);
  }, []);
  
  const clearByCategory = useCallback((category: FeedbackCategory) => {
    setItems(prev => prev.filter(item => item.category !== category));
  }, []);
  
  const context = {
    items,
    addFeedback,
    updateFeedback,
    removeFeedback,
    clearAll,
    clearByCategory,
  };
  
  // Set global context for use by other components
  globalFeedbackContext = context;
  
  return context;
}

// Global feedback helpers
export const feedback = {
  success: (title: string, message: string, category: FeedbackCategory = 'system') => {
    return globalFeedbackContext?.addFeedback({
      type: 'success',
      category,
      title,
      message,
      duration: 5000,
    });
  },
  
  error: (title: string, message: string, category: FeedbackCategory = 'system') => {
    return globalFeedbackContext?.addFeedback({
      type: 'error',
      category,
      title,
      message,
      persistent: true,
    });
  },
  
  warning: (title: string, message: string, category: FeedbackCategory = 'system') => {
    return globalFeedbackContext?.addFeedback({
      type: 'warning',
      category,
      title,
      message,
      duration: 7000,
    });
  },
  
  info: (title: string, message: string, category: FeedbackCategory = 'system') => {
    return globalFeedbackContext?.addFeedback({
      type: 'info',
      category,
      title,
      message,
      duration: 4000,
    });
  },
  
  loading: (title: string, message: string, category: FeedbackCategory = 'system') => {
    return globalFeedbackContext?.addFeedback({
      type: 'loading',
      category,
      title,
      message,
      persistent: true,
    });
  },
  
  progress: (title: string, message: string, progress: number, category: FeedbackCategory = 'system') => {
    return globalFeedbackContext?.addFeedback({
      type: 'progress',
      category,
      title,
      message,
      progress,
      persistent: true,
    });
  },
  
  update: (id: string, updates: Partial<FeedbackItem>) => {
    globalFeedbackContext?.updateFeedback(id, updates);
  },
  
  remove: (id: string) => {
    globalFeedbackContext?.removeFeedback(id);
  }
};

export default function FeedbackSystem({ 
  className,
  maxItems = 10,
  showHistory = true,
  autoHide = true
}: FeedbackSystemProps) {
  const feedbackContext = useFeedback();
  const [isVisible, setIsVisible] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | 'all'>('all');
  
  const { items, removeFeedback, clearAll, clearByCategory } = feedbackContext;
  
  // Filter items based on selected category
  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category === selectedCategory);
  
  // Get recent items (for main display)
  const recentItems = filteredItems.slice(0, maxItems);
  
  // Get category counts
  const categoryCounts = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<FeedbackCategory, number>);
  
  const getIcon = (type: FeedbackType, isAnimated = false) => {
    const className = cn("h-4 w-4", isAnimated && "animate-spin");
    
    switch (type) {
      case 'success':
        return <CheckCircle className={cn(className, "text-green-500")} />;
      case 'error':
        return <AlertCircle className={cn(className, "text-red-500")} />;
      case 'warning':
        return <AlertCircle className={cn(className, "text-amber-500")} />;
      case 'info':
        return <Info className={cn(className, "text-blue-500")} />;
      case 'loading':
        return <Loader2 className={cn(className, "text-blue-500 animate-spin")} />;
      case 'progress':
        return <Clock className={cn(className, "text-blue-500")} />;
      default:
        return <Info className={className} />;
    }
  };
  
  const getCategoryIcon = (category: FeedbackCategory) => {
    switch (category) {
      case 'ai':
        return <Bot className="h-3 w-3" />;
      case 'build':
        return <Hammer className="h-3 w-3" />;
      case 'preview':
        return <Eye className="h-3 w-3" />;
      case 'file':
        return <FileText className="h-3 w-3" />;
      case 'multi_agent':
        return <Users className="h-3 w-3" />;
      case 'system':
        return <Zap className="h-3 w-3" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };
  
  const getItemBackgroundColor = (type: FeedbackType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
      case 'info':
      case 'loading':
      case 'progress':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
      default:
        return 'bg-background border-border';
    }
  };
  
  if (!isVisible && autoHide) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsVisible(true)}
        className={cn("fixed bottom-4 right-4 z-50", className)}
      >
        <Bell className="h-4 w-4" />
        {items.length > 0 && (
          <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs">
            {items.length}
          </Badge>
        )}
      </Button>
    );
  }
  
  return (
    <Card className={cn("w-80", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            System Feedback
            {items.length > 0 && (
              <Badge variant="secondary" className="h-5">
                {items.length}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-1">
            {autoHide && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsVisible(false)}
              >
                <EyeOff className="h-3 w-3" />
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAll}
              disabled={items.length === 0}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Category Filters */}
        <div className="flex flex-wrap gap-1 mt-2">
          <Button
            size="sm"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('all')}
            className="h-6 text-xs"
          >
            All {items.length > 0 && `(${items.length})`}
          </Button>
          
          {Object.entries(categoryCounts).map(([category, count]) => (
            <Button
              key={category}
              size="sm"
              variant={selectedCategory === category ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category as FeedbackCategory)}
              className="h-6 text-xs gap-1"
            >
              {getCategoryIcon(category as FeedbackCategory)}
              {category} ({count})
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {recentItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No feedback items</p>
              </div>
            ) : (
              recentItems.map((item) => (
                <Card
                  key={item.id}
                  className={cn(
                    "transition-all duration-200 hover:shadow-sm",
                    getItemBackgroundColor(item.type)
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(item.type, item.type === 'loading')}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium truncate">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="h-4 text-xs gap-1">
                              {getCategoryIcon(item.category)}
                              {item.category}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFeedback(item.id)}
                              className="h-4 w-4 p-0"
                            >
                              <X className="h-2 w-2" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-2">
                          {item.message}
                        </p>
                        
                        {item.type === 'progress' && item.progress !== undefined && (
                          <div className="mb-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{Math.round(item.progress)}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {item.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Show details
                            </summary>
                            <div className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono">
                              {item.details}
                            </div>
                          </details>
                        )}
                        
                        {item.actions && item.actions.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {item.actions.map((action, index) => (
                              <Button
                                key={index}
                                size="sm"
                                variant={action.variant || 'outline'}
                                onClick={action.action}
                                className="h-6 text-xs"
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{item.timestamp.toLocaleTimeString()}</span>
                          {item.persistent && (
                            <Badge variant="outline" className="h-4 text-xs">
                              Persistent
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Quick Actions */}
        {items.length > 0 && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              onClick={() => clearByCategory('ai')}
              disabled={!categoryCounts.ai}
              className="flex-1 text-xs"
            >
              Clear AI
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => clearByCategory('build')}
              disabled={!categoryCounts.build}
              className="flex-1 text-xs"
            >
              Clear Build
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}