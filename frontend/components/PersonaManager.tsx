import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Tag, 
  Star,
  Globe,
  Lock,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Switch } from '@/components/ui/switch';"
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

type AgentRole = 'planner' | 'coder' | 'tester' | 'reviewer' | 'coordinator' | 'custom';

interface CustomPersona {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  suggestedRole?: AgentRole;
  tags: string[];
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PersonaManagerProps {
  onApplyPersona?: (personaId: string, agentId: string) => void;
  selectedAgentId?: string;
}

export default function PersonaManager({ onApplyPersona, selectedAgentId }: PersonaManagerProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPersona, setEditingPersona] = useState<CustomPersona | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Query for user's personas
  const { data: personas } = useQuery({
    queryKey: ['personas', { includePublic: true, tags: selectedTags }],
    queryFn: () => backend.multiagent.listPersonas({ includePublic: true, tags: selectedTags.length > 0 ? selectedTags : undefined }),
  });

  // Query for popular personas
  const { data: popularPersonas } = useQuery({
    queryKey: ['popular-personas'],
    queryFn: () => backend.multiagent.getPopularPersonas({ limit: 10 }),
  });

  // Create persona mutation
  const createPersonaMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      systemPrompt: string;
      suggestedRole?: AgentRole;
      tags?: string[];
      isPublic?: boolean;
    }) => backend.multiagent.createPersona(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setShowCreateDialog(false);
      toast({ title: "Persona created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create persona", description: error.message, variant: "destructive" });
    },
  });

  // Update persona mutation
  const updatePersonaMutation = useMutation({
    mutationFn: (data: { personaId: string } & Partial<{
      name: string;
      description?: string;
      systemPrompt: string;
      suggestedRole?: AgentRole;
      tags?: string[];
      isPublic?: boolean;
    }>) => backend.multiagent.updatePersona(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      setEditingPersona(null);
      toast({ title: "Persona updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update persona", description: error.message, variant: "destructive" });
    },
  });

  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: (personaId: string) => backend.multiagent.deletePersona({ personaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      toast({ title: "Persona deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete persona", description: error.message, variant: "destructive" });
    },
  });

  // Apply persona to agent mutation
  const applyPersonaMutation = useMutation({
    mutationFn: (data: { agentId: string; personaId: string }) =>
      backend.multiagent.applyPersonaToAgent(data),
    onSuccess: () => {
      toast({ title: "Persona applied to agent successfully" });
      if (onApplyPersona && selectedAgentId) {
        onApplyPersona(selectedAgentId, '');
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to apply persona", description: error.message, variant: "destructive" });
    },
  });

  const filteredPersonas = personas?.personas.filter(persona =>
    persona.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    persona.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    persona.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const allTags = Array.from(new Set(personas?.personas.flatMap(p => p.tags) || []));

  const getRoleColor = (role?: string) => {
    const colors = {
      planner: 'bg-purple-100 text-purple-800',
      coder: 'bg-blue-100 text-blue-800',
      tester: 'bg-green-100 text-green-800',
      reviewer: 'bg-orange-100 text-orange-800',
      coordinator: 'bg-indigo-100 text-indigo-800',
    };
    return role ? (colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            Persona Manager
          </h2>
          <p className="text-muted-foreground">Create and manage custom agent personas</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Persona
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Persona</DialogTitle>
              <DialogDescription>
                Design a custom persona with unique characteristics and system prompts
              </DialogDescription>
            </DialogHeader>
            <PersonaForm onSubmit={createPersonaMutation.mutate} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search personas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedTags(prev => 
                  prev.includes(tag) 
                    ? prev.filter(t => t !== tag)
                    : [...prev, tag]
                );
              }}
            >
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="my-personas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-personas">My Personas</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="browse">Browse Public</TabsTrigger>
        </TabsList>

        <TabsContent value="my-personas" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPersonas
              .filter(p => p.userId === 'current-user') // This would be replaced with actual user ID
              .map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onEdit={() => setEditingPersona(persona)}
                  onDelete={() => deletePersonaMutation.mutate(persona.id)}
                  onApply={selectedAgentId ? () => applyPersonaMutation.mutate({ agentId: selectedAgentId, personaId: persona.id }) : undefined}
                  isOwner={true}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {popularPersonas?.personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onApply={selectedAgentId ? () => applyPersonaMutation.mutate({ agentId: selectedAgentId, personaId: persona.id }) : undefined}
                isOwner={false}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="browse" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPersonas
              .filter(p => p.isPublic && p.userId !== 'current-user')
              .map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onApply={selectedAgentId ? () => applyPersonaMutation.mutate({ agentId: selectedAgentId, personaId: persona.id }) : undefined}
                  isOwner={false}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {editingPersona && (
        <Dialog open={!!editingPersona} onOpenChange={() => setEditingPersona(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Persona</DialogTitle>
              <DialogDescription>
                Update your custom persona
              </DialogDescription>
            </DialogHeader>
            <PersonaForm
              initialData={editingPersona}
              onSubmit={(data) => updatePersonaMutation.mutate({ personaId: editingPersona.id, ...data })}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface PersonaCardProps {
  persona: CustomPersona;
  onEdit?: () => void;
  onDelete?: () => void;
  onApply?: () => void;
  isOwner: boolean;
}

function PersonaCard({ persona, onEdit, onDelete, onApply, isOwner }: PersonaCardProps) {
  const getRoleColor = (role?: string) => {
    const colors = {
      planner: 'bg-purple-100 text-purple-800',
      coder: 'bg-blue-100 text-blue-800',
      tester: 'bg-green-100 text-green-800',
      reviewer: 'bg-orange-100 text-orange-800',
      coordinator: 'bg-indigo-100 text-indigo-800',
    };
    return role ? (colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {persona.name}
              {persona.isPublic ? (
                <Globe className="h-4 w-4 text-green-500" />
              ) : (
                <Lock className="h-4 w-4 text-gray-500" />
              )}
            </CardTitle>
            {persona.description && (
              <CardDescription>{persona.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isOwner && onEdit && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit3 className="h-3 w-3" />
              </Button>
            )}
            {isOwner && onDelete && (
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {persona.suggestedRole && (
            <Badge className={getRoleColor(persona.suggestedRole)}>
              {persona.suggestedRole}
            </Badge>
          )}
          {persona.tags.map(tag => (
            <Badge key={tag} variant="outline">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          <div className="bg-muted p-2 rounded text-xs font-mono max-h-20 overflow-hidden">
            {persona.systemPrompt.substring(0, 100)}...
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {persona.usageCount} uses
          </div>
          {persona.isPublic && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              Public
            </div>
          )}
        </div>

        {onApply && (
          <Button size="sm" className="w-full" onClick={onApply}>
            Apply to Agent
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface PersonaFormProps {
  initialData?: Partial<CustomPersona>;
  onSubmit: (data: {
    name: string;
    description?: string;
    systemPrompt: string;
    suggestedRole?: AgentRole;
    tags?: string[];
    isPublic?: boolean;
  }) => void;
}

function PersonaForm({ initialData, onSubmit }: PersonaFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt || '');
  const [suggestedRole, setSuggestedRole] = useState(initialData?.suggestedRole || '');
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
  const [isPublic, setIsPublic] = useState(initialData?.isPublic || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description: description || undefined,
      systemPrompt,
      suggestedRole: (suggestedRole as AgentRole) || undefined,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : undefined,
      isPublic,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="persona-name">Name</Label>
        <Input
          id="persona-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Senior Frontend Developer"
          required
        />
      </div>

      <div>
        <Label htmlFor="persona-description">Description (optional)</Label>
        <Input
          id="persona-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this persona..."
        />
      </div>

      <div>
        <Label htmlFor="suggested-role">Suggested Role (optional)</Label>
        <Select value={suggestedRole} onValueChange={setSuggestedRole}>
          <SelectTrigger>
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            <SelectItem value="planner">Planner</SelectItem>
            <SelectItem value="coder">Coder</SelectItem>
            <SelectItem value="tester">Tester</SelectItem>
            <SelectItem value="reviewer">Reviewer</SelectItem>
            <SelectItem value="coordinator">Coordinator</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="persona-tags">Tags (comma-separated)</Label>
        <Input
          id="persona-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="frontend, react, typescript, senior"
        />
      </div>

      <div>
        <Label htmlFor="system-prompt">System Prompt</Label>
        <Textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Define the persona's behavior, expertise, and communication style..."
          className="min-h-[120px]"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is-public"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <Label htmlFor="is-public">Make this persona public</Label>
      </div>

      <Button type="submit" className="w-full" disabled={!name.trim() || !systemPrompt.trim()}>
        {initialData ? 'Update Persona' : 'Create Persona'}
      </Button>
    </form>
  );
}