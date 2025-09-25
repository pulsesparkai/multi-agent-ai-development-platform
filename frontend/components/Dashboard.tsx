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
import ChatSidebar from './ChatSidebar';
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

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => backend.auth.me(),
  });

  const { data: projects, refetch: refetchProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => backend.projects.list(),
  });

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
            <CodeEditor
              projectId={selectedProject}
              onToggleChat={() => setShowChat(!showChat)}
              onToggleMultiAgent={() => setShowMultiAgent(!showMultiAgent)}
              showChat={showChat}
              showMultiAgent={showMultiAgent}
            />
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
          <ChatSidebar
            projectId={selectedProject}
            onClose={() => setShowChat(false)}
            onSwitchToMultiAgent={() => {
              setShowChat(false);
              setShowMultiAgent(true);
            }}
          />
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
    </div>
  );
}
