import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserButton } from '@clerk/clerk-react';
import { 
  Plus, 
  Settings, 
  Code, 
  MessageSquare, 
  Rocket,
  GitBranch,
  Wrench,
  WifiOff,
  History,
  HelpCircle,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackend } from '../hooks/useBackend';
import ProjectList from './ProjectList';
import CodeEditor from './CodeEditor';
import EnhancedCodeEditor from './EnhancedCodeEditor';
import ChatSidebar from './ChatSidebar';
import EnhancedChatSidebar from './EnhancedChatSidebar';
import MultiAgentDashboard from './MultiAgentDashboard';
import SimpleGenerator from './SimpleGenerator';
import SettingsDialog from './SettingsDialog';
import CreateProjectDialog from './CreateProjectDialog';
import DeploymentDialog from './DeploymentDialog';
import VersionControlPanel from './VersionControlPanel';
import ToolsPanel from './ToolsPanel';
import OfflineModeDialog from './OfflineModeDialog';
import HistoryPanel from './HistoryPanel';
import HelpDialog from './HelpDialog';
import WelcomeScreen from './WelcomeScreen';
import DebugInfo from './DebugInfo';
import LeapLikeDemoPanel from './LeapLikeDemoPanel';

export default function Dashboard() {
  const backend = useBackend();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showMultiAgent, setShowMultiAgent] = useState(false);
  const [showSimpleGenerator, setShowSimpleGenerator] = useState(false);
  const [showVersionControl, setShowVersionControl] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [useEnhancedMode, setUseEnhancedMode] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showLeapDemo, setShowLeapDemo] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => backend.auth.me(),
  });

  const { data: projects, refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => backend.projects.list(),
  });

  const { data: apiKeys } = useQuery({
    queryKey: ['hasApiKeys'],
    queryFn: async () => {
      try {
        const result = await backend.ai.listKeys();
        return result.apiKeys.length > 0;
      } catch {
        return false;
      }
    },
  });

  // Show welcome screen for new users with no API keys and no projects
  const shouldShowWelcome = showWelcome || (
    apiKeys === false && 
    (!projects?.projects || projects.projects.length === 0)
  );

  if (shouldShowWelcome) {
    return <WelcomeScreen onComplete={() => setShowWelcome(false)} />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Code className="h-6 w-6 text-primary" />
              <h1 className="font-semibold text-lg">AI Dev Platform</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8"
                  }
                }}
              />
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="space-y-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowSimpleGenerator(true)}
              className="w-full gap-2"
            >
              <Zap className="h-4 w-4" />
              AI Website Builder
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              {selectedProject && (
                <>
                  <DeploymentDialog 
                    projectId={selectedProject} 
                    projectName={projects?.projects.find(p => p.id === selectedProject)?.name || "Project"}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVersionControl(true)}
                    className="gap-2"
                  >
                    <GitBranch className="h-4 w-4" />
                    Git
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTools(true)}
                    className="gap-2"
                  >
                    <Wrench className="h-4 w-4" />
                    Tools
                  </Button>
                  <OfflineModeDialog 
                    projectId={selectedProject}
                    projectName={projects?.projects.find(p => p.id === selectedProject)?.name || "Project"}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(true)}
                    className="gap-2"
                  >
                    <History className="h-4 w-4" />
                    History
                  </Button>
                  <HelpDialog />
                </>
              )}
              {!selectedProject && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTools(true)}
                    className="gap-2"
                  >
                    <Wrench className="h-4 w-4" />
                    Tools
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLeapDemo(true)}
                    className="gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    See How Leap Works
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDebug(true)}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Debug
                  </Button>
                  <HelpDialog />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Projects</h2>
              <Button
                size="sm"
                onClick={() => setShowCreateProject(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </div>
          <ProjectList
            projects={projects?.projects || []}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Code Editor */}
        <div className="flex-1 relative">
          {selectedProject ? (
            useEnhancedMode ? (
              <EnhancedCodeEditor
                projectId={selectedProject}
                onToggleChat={() => setShowChat(!showChat)}
                onToggleMultiAgent={() => setShowMultiAgent(!showMultiAgent)}
                showChat={showChat}
                showMultiAgent={showMultiAgent}
              />
            ) : (
              <CodeEditor
                projectId={selectedProject}
                onToggleChat={() => setShowChat(!showChat)}
                onToggleMultiAgent={() => setShowMultiAgent(!showMultiAgent)}
                showChat={showChat}
                showMultiAgent={showMultiAgent}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/30">
              <div className="text-center">
                <Code className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No project selected
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a new project or select an existing one to start coding
                </p>
                <Button onClick={() => setShowCreateProject(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Simple Generator */}
        {showSimpleGenerator && (
          <SimpleGenerator
            onClose={() => setShowSimpleGenerator(false)}
          />
        )}

        {/* Multi-Agent Dashboard */}
        {selectedProject && showMultiAgent && !showSimpleGenerator && (
          <MultiAgentDashboard
            projectId={selectedProject}
            onClose={() => setShowMultiAgent(false)}
          />
        )}

        {/* Chat Sidebar */}
        {selectedProject && showChat && !showMultiAgent && !showSimpleGenerator && (
          useEnhancedMode ? (
            <EnhancedChatSidebar
              projectId={selectedProject}
              onClose={() => setShowChat(false)}
              onSwitchToMultiAgent={() => {
                setShowChat(false);
                setShowMultiAgent(true);
              }}
            />
          ) : (
            <ChatSidebar
              projectId={selectedProject}
              onClose={() => setShowChat(false)}
              onSwitchToMultiAgent={() => {
                setShowChat(false);
                setShowMultiAgent(true);
              }}
            />
          )
        )}
      </div>

      {/* Dialogs */}
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
      />
      
      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onProjectCreated={(project) => {
          setSelectedProject(project.id);
          refetchProjects();
        }}
      />
      
      {selectedProject && (
        <>
          <VersionControlPanel
            projectId={selectedProject}
            open={showVersionControl}
            onOpenChange={setShowVersionControl}
          />
          
          <HistoryPanel
            projectId={selectedProject}
            open={showHistory}
            onOpenChange={setShowHistory}
          />
        </>
      )}
      
      <ToolsPanel
        open={showTools}
        onOpenChange={setShowTools}
      />
      
      {/* Leap Demo Dialog */}
      {showLeapDemo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">How Leap Works - Live Demo</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowLeapDemo(false)}>
                ×
              </Button>
            </div>
            <div className="overflow-auto max-h-[80vh] p-6">
              <LeapLikeDemoPanel />
            </div>
          </div>
        </div>
      )}

      {/* Debug Dialog */}
      {showDebug && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">Debug Information</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowDebug(false)}>
                ×
              </Button>
            </div>
            <div className="overflow-auto">
              <DebugInfo projectId={selectedProject || undefined} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
