import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Settings, 
  Zap, 
  Plus,
  ArrowRight,
  Play,
  AlertTriangle,
  Clock,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface RoleManagementProps {
  teamId: string;
  projectId: string;
}

export default function RoleManagement({ teamId, projectId }: RoleManagementProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateRule, setShowCreateRule] = useState(false);

  // Query for team details
  const { data: team } = useQuery({
    queryKey: ['team-details', teamId],
    queryFn: () => backend.multiagent.getTeam({ teamId }),
  });

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6" />
            Dynamic Role Management
          </h2>
          <p className="text-muted-foreground">Configure and manage agent role adaptations</p>
        </div>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="rules">Assignment Rules</TabsTrigger>
          <TabsTrigger value="history">Role History</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4">
            {team?.agents?.map((agent: any) => (
              <Card key={agent.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      {agent.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleColor(agent.currentRole || agent.role)}>
                        Current: {agent.currentRole || agent.role}
                      </Badge>
                      {agent.role !== agent.currentRole && (
                        <Badge variant="outline">
                          Original: {agent.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={agent.canAdaptRole || false}
                        onChange={() => {}}
                        disabled
                      />
                      <Label>Allow role adaptation</Label>
                    </div>
                    <Badge variant={agent.isEnabled ? "default" : "secondary"}>
                      {agent.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>

                  {agent.canAdaptRole && agent.availableRoles && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Available roles:</Label>
                      <div className="flex flex-wrap gap-1">
                        {agent.availableRoles.map((role: string) => (
                          <Badge 
                            key={role} 
                            variant={role === (agent.currentRole || agent.role) ? "default" : "outline"}
                            className={role === (agent.currentRole || agent.role) ? getRoleColor(role) : ''}
                          >
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="text-center text-muted-foreground py-8">
            <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Role assignment rules will be displayed here</p>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="text-center text-muted-foreground py-8">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Role change history will be displayed here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}