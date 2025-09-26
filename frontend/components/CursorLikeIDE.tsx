import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Sidebar, Layout, Settings, Brain, MessageSquare, 
  Files, Eye, Hammer, Zap, Users, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';
import { useWebSocket } from '../hooks/useWebSocket';

// Import our new components
import AIThinkingDisplay, { useAIThinking } from './AIThinkingDisplay';
import AutoApplyManager, { useAutoApply } from './AutoApplyManager';
import PreviewPanel from './PreviewPanel';
import MultiFileEditor from './MultiFileEditor';
import BuildWorkflow from './BuildWorkflow';
import FeedbackSystem, { useFeedback, feedback } from './FeedbackSystem';

// Import existing components
import EnhancedChatSidebar from './EnhancedChatSidebar';
import MultiAgentDashboard from './MultiAgentDashboard';

interface CursorLikeIDEProps {
  projectId: string;
}

export default function CursorLikeIDE({ projectId }: CursorLikeIDEProps) {
  const [layout, setLayout] = useState<'editor' | 'split' | 'preview'>('editor');
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'multiagent' | 'feedback'>('chat');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [aiThinkingActive, setAiThinkingActive] = useState(false);
  
  const backend = useBackend();
  const feedbackSystem = useFeedback();
  const aiThinking = useAIThinking();
  const autoApply = useAutoApply(projectId);

  // Project data
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => backend.projects.get({ id: projectId }),
  });

  // WebSocket for real-time coordination
  const { connected: wsConnected } = useWebSocket({
    projectId,
    onFileUpdate: (filePath, operation) => {
      feedback.info(
        'File Updated',
        `${filePath} was ${operation}d`,
        'file'
      );
      
      // Add to auto-apply if it's an AI-generated change
      autoApply.addPendingChange({
        operation: operation as any,
        filePath,
        source: 'ai_chat'
      });
    },
    onBuildUpdate: (status, data) => {
      switch (status) {
        case 'started':
          feedback.loading('Build Started', 'Building your project...', 'build');
          break;
        case 'completed':
          feedback.success('Build Complete', 'Your project built successfully!', 'build');
          break;
        case 'failed':
          feedback.error('Build Failed', typeof data === 'string' ? data : 'Build process failed', 'build');
          break;
      }
    },
    onPreviewReady: (url) => {
      feedback.success(
        'Preview Ready',
        'Your application is now running!',
        'preview'
      );
      setLayout('split'); // Auto-switch to split view
    },
    onAgentReasoning: (agentName: string, reasoning: string, status: string) => {
      if (status === 'thinking' || status === 'generating') {
        setAiThinkingActive(true);
        aiThinking.addStep({
          title: `${agentName} ${status}`,
          status: status,
          description: reasoning
        });
      } else if (status === 'completed' || status === 'error') {
        aiThinking.completeThinking();
        setAiThinkingActive(false);
      }
    }
  });

  // Handle AI chat interactions
  const handleAIChatMessage = async (message: string, options: any) => {
    setAiThinkingActive(true);
    
    aiThinking.addStep({
      title: 'Processing Request',
      status: 'thinking',
      description: 'Understanding your request and planning implementation...'
    });

    try {
      // This would integrate with the enhanced chat API
      const response = await backend.ai.enhancedChat({
        projectId,
        message,
        autoApply: options.autoApply,
        autoBuild: options.autoBuild,
        autoPreview: options.autoPreview,
        provider: options.provider || 'anthropic'
      });

      if (response.filesChanged && response.filesChanged.length > 0) {
        feedback.success(
          'Files Updated',
          `${response.filesChanged.length} files were modified`,
          'ai'
        );
      }

      if (response.buildStarted) {
        feedback.info('Build Started', 'Automatic build initiated', 'build');
      }

      if (response.previewUrl) {
        feedback.success('Preview Ready', 'Application is now running', 'preview');
        setLayout('split');
      }

      if (response.errors && response.errors.length > 0) {
        response.errors.forEach(error => {
          feedback.error('AI Error', error, 'ai');
        });
      }

    } catch (error) {
      feedback.error(
        'AI Request Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        'ai'
      );
    } finally {
      aiThinking.completeThinking();
      setAiThinkingActive(false);
    }
  };

  // Handle auto-apply changes
  const handleApplyChanges = async (changeIds: string[]) => {
    const changes = autoApply.pendingChanges.filter(c => changeIds.includes(c.id));
    
    feedback.loading(
      'Applying Changes',
      `Applying ${changes.length} file changes...`,
      'file'
    );

    try {
      await autoApply.applyChanges(changeIds);
      feedback.success(
        'Changes Applied',
        `Successfully applied ${changes.length} changes`,
        'file'
      );
    } catch (error) {
      feedback.error(
        'Apply Failed',
        'Failed to apply some changes',
        'file'
      );
      throw error;
    }
  };

  // Handle build workflow completion
  const handleBuildComplete = (success: boolean) => {
    if (success) {
      feedback.success('Build Complete', 'Project built successfully!', 'build');
      if (layout !== 'preview') {
        setLayout('split'); // Auto-switch to show preview
      }
    } else {
      feedback.error('Build Failed', 'Build process encountered errors', 'build');
    }
  };

  // Handle preview ready
  const handlePreviewReady = (url: string) => {
    feedback.success(
      'Preview Ready', 
      'Your application is now running!', 
      'preview'
    );
    if (layout === 'editor') {
      setLayout('split'); // Auto-switch to split view
    }
  };

  // Effect to manage connection status feedback
  useEffect(() => {
    if (wsConnected) {
      feedback.success('Connected', 'Real-time sync is active', 'system');
    } else {
      feedback.warning('Disconnected', 'Real-time sync is offline', 'system');
    }
  }, [wsConnected]);

  const renderMainContent = () => {
    switch (layout) {
      case 'editor':
        return (
          <div className="flex flex-col h-full">
            <MultiFileEditor
              projectId={projectId}
              initialFileId={selectedFileId || undefined}
              onFileSelect={setSelectedFileId}
              className="flex-1"
            />
          </div>
        );
      
      case 'split':
        return (
          <div className="h-full flex">
            <div className="flex-1 w-1/2">
              <MultiFileEditor
                projectId={projectId}
                initialFileId={selectedFileId || undefined}
                onFileSelect={setSelectedFileId}
                className="h-full"
              />
            </div>
            <div className="flex-1 w-1/2 border-l">
              <PreviewPanel
                projectId={projectId}
                enableHotReload={true}
                autoRefresh={true}
              />
            </div>
          </div>
        );
      
      case 'preview':
        return (
          <PreviewPanel
            projectId={projectId}
            enableHotReload={true}
            autoRefresh={true}
          />
        );
      
      default:
        return null;
    }
  };

  const renderSidebar = () => {
    if (!showSidebar) return null;

    return (
      <Card className="h-full rounded-none border-r border-t-0 border-b-0 border-l-0">
        <CardContent className="p-0 h-full">
          <Tabs value={sidebarTab} onValueChange={(value: any) => setSidebarTab(value)} className="h-full flex flex-col">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="chat" className="flex-1 gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="multiagent" className="flex-1 gap-2">
                <Users className="h-4 w-4" />
                Agents
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex-1 gap-2">
                <Bell className="h-4 w-4" />
                Feedback
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 m-0">
              <div className="h-full flex flex-col">
                {/* AI Thinking Display */}
                {aiThinkingActive && (
                  <div className="p-3 border-b bg-muted/30">
                    <AIThinkingDisplay
                      steps={aiThinking.steps}
                      isActive={aiThinking.isActive}
                    />
                  </div>
                )}
                
                {/* Auto-Apply Manager */}
                {autoApply.pendingChanges.length > 0 && (
                  <div className="p-3 border-b">
                    <AutoApplyManager
                      projectId={projectId}
                      pendingChanges={autoApply.pendingChanges}
                      onApplyChanges={handleApplyChanges}
                      onRejectChanges={autoApply.rejectChanges}
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <EnhancedChatSidebar
                    projectId={projectId}
                    onClose={() => setSidebarTab('feedback')}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="multiagent" className="flex-1 m-0">
              <MultiAgentDashboard projectId={projectId} onClose={() => setSidebarTab('chat')} />
            </TabsContent>
            
            <TabsContent value="feedback" className="flex-1 m-0 p-3">
              <FeedbackSystem
                maxItems={20}
                showHistory={true}
                autoHide={false}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Sidebar className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">
              {project?.name || 'Cursor-like IDE'}
            </h1>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              wsConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-xs text-muted-foreground">
              {wsConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
        
        {/* Layout Controls */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={layout === 'editor' ? 'default' : 'outline'}
            onClick={() => setLayout('editor')}
          >
            <Files className="h-3 w-3 mr-1" />
            Editor
          </Button>
          <Button
            size="sm"
            variant={layout === 'split' ? 'default' : 'outline'}
            onClick={() => setLayout('split')}
          >
            <Layout className="h-3 w-3 mr-1" />
            Split
          </Button>
          <Button
            size="sm"
            variant={layout === 'preview' ? 'default' : 'outline'}
            onClick={() => setLayout('preview')}
          >
            <Eye className="h-3 w-3 mr-1" />
            Preview
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="h-full flex">
          {showSidebar && (
            <div className="w-80 border-r">
              {renderSidebar()}
            </div>
          )}
          
          <div className={cn("flex-1 flex flex-col", !showSidebar && "w-full")}>
            {/* Build Workflow - only show when building */}
            <div className="border-b">
              <BuildWorkflow
                projectId={projectId}
                onPreviewReady={handlePreviewReady}
                onBuildComplete={handleBuildComplete}
              />
            </div>
            
            {/* Main Editor/Preview Area */}
            <div className="flex-1">
              {renderMainContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}