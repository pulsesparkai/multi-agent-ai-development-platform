import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Bot, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Users, 
  DollarSign, 
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface MultiAgentDashboardProps {
  projectId: string;
  onClose: () => void;
}

interface SessionMessage {
  agentName: string;
  agentRole: string;
  content: string;
  iteration: number;
  messageType: string;
  timestamp: Date;
  cost?: number;
}

interface SessionResponse {
  sessionId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  messages: SessionMessage[];
  currentIteration: number;
  totalCost: number;
}

export default function MultiAgentDashboard({ projectId, onClose }: MultiAgentDashboardProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');

  // Query for teams
  const { data: teams } = useQuery({
    queryKey: ['multiagent-teams', projectId],
    queryFn: () => backend.multiagent.listTeams({ projectId }),
  });

  // Query for active team details
  const { data: teamDetails } = useQuery({
    queryKey: ['multiagent-team', selectedTeam],
    queryFn: () => selectedTeam ? backend.multiagent.getTeam({ teamId: selectedTeam }) : null,
    enabled: !!selectedTeam,
  });

  // Query for sessions
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['multiagent-sessions', selectedTeam],
    queryFn: () => selectedTeam ? backend.multiagent.listSessions({ teamId: selectedTeam }) : null,
    enabled: !!selectedTeam,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
  });

  // Query for active session details
  const { data: sessionDetails } = useQuery({
    queryKey: ['multiagent-session', activeSession],
    queryFn: () => activeSession ? backend.multiagent.getSession({ sessionId: activeSession }) : null,
    enabled: !!activeSession,
    refetchInterval: 1000, // Refresh every second for real-time logs
  });

  // Query for budget info
  const { data: budgetInfo } = useQuery({
    queryKey: ['multiagent-budget', selectedTeam],
    queryFn: () => selectedTeam ? backend.multiagent.getBudget({ teamId: selectedTeam }) : null,
    enabled: !!selectedTeam,
  });

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; budgetLimit?: number }) =>
      backend.multiagent.createTeam({ ...data, projectId }),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['multiagent-teams'] });
      setSelectedTeam(team.id);
      setShowCreateTeam(false);
      toast({ title: "Team created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create team", description: error.message, variant: "destructive" });
    },
  });

  const toggleTeamMutation = useMutation({
    mutationFn: (data: { teamId: string; active: boolean }) =>
      backend.multiagent.toggleTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multiagent-teams'] });
      toast({ title: "Team status updated" });
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: (data: { teamId: string; prompt: string }) =>
      backend.multiagent.startSession({ ...data, projectId }),
    onSuccess: (session) => {
      setActiveSession(session.sessionId);
      refetchSessions();
      setNewPrompt('');
      toast({ title: "Multi-agent session started" });
    },
    onError: (error) => {
      toast({ title: "Failed to start session", description: error.message, variant: "destructive" });
    },
  });

  const controlSessionMutation = useMutation({
    mutationFn: (data: { sessionId: string; action: 'pause' | 'resume' | 'stop' }) =>
      backend.multiagent.controlSession(data),
    onSuccess: () => {
      refetchSessions();
      toast({ title: "Session updated" });
    },
  });

  // Auto-select first team if available
  useEffect(() => {
    if (teams?.teams.length && !selectedTeam) {
      setSelectedTeam(teams.teams[0].id);
    }
  }, [teams, selectedTeam]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    const colors = {
      planner: 'bg-purple-100 text-purple-800',
      coder: 'bg-blue-100 text-blue-800',
      tester: 'bg-green-100 text-green-800',
      reviewer: 'bg-orange-100 text-orange-800',
      coordinator: 'bg-indigo-100 text-indigo-800',
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Multi-Agent</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="dashboard" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="flex-1 overflow-hidden px-4 pb-4">
            <div className="space-y-4 h-full">
              {/* Team Selection */}
              <div className="space-y-2">
                <Label>Active Team</Label>
                <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <span>{team.name}</span>
                          {team.isActive && (
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Budget Info */}
              {budgetInfo && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Budget
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used:</span>
                      <span>${budgetInfo.budgetUsed.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Limit:</span>
                      <span>${budgetInfo.budgetLimit.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(budgetInfo.utilizationPercent, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      {budgetInfo.utilizationPercent.toFixed(1)}% utilized
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Start */}
              <div className="space-y-3">
                <Label>Start New Session</Label>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Describe what you want the agents to build..."
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    onClick={() => selectedTeam && startSessionMutation.mutate({ teamId: selectedTeam, prompt: newPrompt })}
                    disabled={!selectedTeam || !newPrompt.trim() || startSessionMutation.isPending}
                    className="w-full"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {startSessionMutation.isPending ? 'Starting...' : 'Start Session'}
                  </Button>
                </div>
              </div>

              {/* Active Session */}
              {sessionDetails && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Active Session
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(sessionDetails.status)}>
                        {getStatusIcon(sessionDetails.status)}
                        <span className="ml-1">{sessionDetails.status}</span>
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Iteration {sessionDetails.currentIteration}
                      </span>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => controlSessionMutation.mutate({ sessionId: sessionDetails.sessionId, action: 'pause' })}
                        disabled={sessionDetails.status !== 'running'}
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => controlSessionMutation.mutate({ sessionId: sessionDetails.sessionId, action: 'resume' })}
                        disabled={sessionDetails.status !== 'paused'}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => controlSessionMutation.mutate({ sessionId: sessionDetails.sessionId, action: 'stop' })}
                        disabled={sessionDetails.status === 'completed' || sessionDetails.status === 'failed'}
                      >
                        <Square className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="text-sm">
                      <strong>Cost:</strong> ${sessionDetails.totalCost.toFixed(4)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="flex-1 overflow-hidden px-4 pb-4">
            <div className="space-y-4 h-full">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Session Logs</h3>
                <Button size="sm" variant="outline" onClick={() => refetchSessions()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>

              {sessionDetails && (
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    {sessionDetails.messages.map((message, index) => (
                      <Card key={index} className="text-sm">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getRoleColor(message.agentRole)}>
                              {message.agentName}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Iteration {message.iteration}
                            </Badge>
                            {message.cost && (
                              <Badge variant="outline" className="text-xs">
                                ${message.cost.toFixed(4)}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {!sessionDetails && sessions?.sessions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No sessions yet</p>
                  <p className="text-sm">Start a new session to see logs here</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="teams" className="flex-1 overflow-hidden px-4 pb-4">
            <div className="space-y-4 h-full">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Teams</h3>
                <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-3 w-3 mr-1" />
                      New Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Team</DialogTitle>
                      <DialogDescription>
                        Create a new multi-agent team for this project
                      </DialogDescription>
                    </DialogHeader>
                    <CreateTeamForm onSubmit={createTeamMutation.mutate} />
                  </DialogContent>
                </Dialog>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {teams?.teams.map((team) => (
                    <Card key={team.id} className={`cursor-pointer transition-colors ${selectedTeam === team.id ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-3" onClick={() => setSelectedTeam(team.id)}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{team.name}</h4>
                          <div className="flex items-center gap-2">
                            {team.isActive && (
                              <Badge className="text-xs">Active</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTeamMutation.mutate({ teamId: team.id, active: !team.isActive });
                              }}
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {team.description && (
                          <p className="text-xs text-muted-foreground mb-2">{team.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>${team.budgetUsed.toFixed(2)} / ${team.budgetLimit.toFixed(2)}</span>
                          <span>{team.agents?.length || 0} agents</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CreateTeamForm({ onSubmit }: { onSubmit: (data: { name: string; description?: string; budgetLimit?: number }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('10.00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      budgetLimit: parseFloat(budgetLimit),
    });
    setName('');
    setDescription('');
    setBudgetLimit('10.00');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="team-name">Team Name</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Frontend Development Team"
          required
        />
      </div>
      <div>
        <Label htmlFor="team-description">Description (optional)</Label>
        <Textarea
          id="team-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this team does..."
        />
      </div>
      <div>
        <Label htmlFor="budget-limit">Budget Limit ($)</Label>
        <Input
          id="budget-limit"
          type="number"
          step="0.01"
          min="0"
          value={budgetLimit}
          onChange={(e) => setBudgetLimit(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={!name.trim()}>
        Create Team
      </Button>
    </form>
  );
}