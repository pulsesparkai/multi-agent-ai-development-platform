import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, X, Bot, User, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useBackend } from '../hooks/useBackend';
import type { ChatMessage } from '~backend/ai/chat';

interface ChatSidebarProps {
  projectId: string;
  onClose: () => void;
  onSwitchToMultiAgent?: () => void;
}

export default function ChatSidebar({ projectId, onClose, onSwitchToMultiAgent }: ChatSidebarProps) {
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google' | 'xai'>('openai');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [useMultiAgent, setUseMultiAgent] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const backend = useBackend();
  const { toast } = useToast();

  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => backend.ai.listKeys(),
  });

  const { data: teams } = useQuery({
    queryKey: ['multiagent-teams', projectId],
    queryFn: () => backend.multiagent.listTeams({ projectId }),
  });

  const chatMutation = useMutation({
    mutationFn: (data: { message: string; provider: 'openai' | 'anthropic' | 'google' | 'xai' }) => {
      console.log('Sending chat request:', { projectId, provider: data.provider, messageLength: data.message.length });
      return backend.ai.chat({ projectId, message: data.message, provider: data.provider });
    },
    onSuccess: (response) => {
      setMessages(prev => [...prev, response.message]);
      setMessage('');
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please check your API key configuration.',
        variant: 'destructive',
      });
    },
  });

  const multiAgentMutation = useMutation({
    mutationFn: (data: { teamId: string; prompt: string }) =>
      backend.multiagent.startSession({ ...data, projectId }),
    onSuccess: (session) => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: `Multi-agent session started! Session ID: ${session.sessionId}\n\nThe team is now working on your request. You can view progress in the Multi-Agent Dashboard.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setMessage('');
      toast({ 
        title: "Multi-agent session started", 
        description: "Switch to the Multi-Agent Dashboard to see progress" 
      });
    },
    onError: (error) => {
      console.error('Multi-agent error:', error);
      
      // Fallback to single-agent mode
      const fallbackMessage: ChatMessage = {
        role: 'assistant',
        content: `Multi-agent session failed to start: ${error.message}\n\nFalling back to single-agent mode...`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
      
      // Automatically switch to single-agent and retry
      setUseMultiAgent(false);
      
      // Retry with single-agent mode after a short delay
      setTimeout(() => {
        if (message.trim()) {
          chatMutation.mutate({ message: message.trim(), provider });
        }
      }, 1000);
      
      toast({
        title: 'Multi-agent failed, using single-agent',
        description: 'Automatically switched to single-agent mode and retrying your request.',
        variant: 'default',
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    if (useMultiAgent && selectedTeam) {
      multiAgentMutation.mutate({ teamId: selectedTeam, prompt: message.trim() });
    } else {
      chatMutation.mutate({ message: message.trim(), provider });
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const availableProviders = apiKeys?.apiKeys.filter(key => key.hasKey).map(key => key.provider) || [];
  const activeTeams = teams?.teams.filter(team => team.isActive) || [];

  // Set default provider to first available
  useEffect(() => {
    if (availableProviders.length > 0 && !availableProviders.includes(provider)) {
      setProvider(availableProviders[0] as any);
    }
  }, [availableProviders, provider]);

  // Set default team to first active team
  useEffect(() => {
    if (activeTeams.length > 0 && !selectedTeam) {
      setSelectedTeam(activeTeams[0].id);
    }
  }, [activeTeams, selectedTeam]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">AI Assistant</h3>
          <div className="flex items-center gap-1">
            {onSwitchToMultiAgent && (
              <Button size="sm" variant="ghost" onClick={onSwitchToMultiAgent} title="Switch to Multi-Agent Dashboard">
                <Users className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Multi-Agent Toggle */}
        <div className="flex items-center justify-between mb-3">
          <Label htmlFor="multi-agent-mode" className="text-sm">Multi-Agent Mode</Label>
          <Switch
            id="multi-agent-mode"
            checked={useMultiAgent}
            onCheckedChange={setUseMultiAgent}
            disabled={activeTeams.length === 0}
          />
        </div>

        {/* Provider/Team Selection */}
        {useMultiAgent ? (
          activeTeams.length > 0 ? (
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {activeTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      {team.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">
              No active teams found. Create a team in Multi-Agent Dashboard.
            </div>
          )
        ) : (
          availableProviders.length > 0 ? (
            <Select value={provider} onValueChange={(value: any) => setProvider(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">
              No API keys configured. Go to Settings to add API keys.
            </div>
          )
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start a conversation with AI</p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
              )}
              
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3 text-sm",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div
                  className={cn(
                    "text-xs mt-1 opacity-70",
                    msg.role === 'user' ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatTime(msg.timestamp)}
                </div>
              </div>
              
              {msg.role === 'user' && (
                <div className="flex-shrink-0">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          
          {(chatMutation.isPending || multiAgentMutation.isPending) && (
            <div className="flex gap-3 justify-start">
              {useMultiAgent ? (
                <Users className="h-6 w-6 text-primary flex-shrink-0" />
              ) : (
                <Bot className="h-6 w-6 text-primary flex-shrink-0" />
              )}
              <div className="bg-muted rounded-lg p-3 text-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={useMultiAgent ? "Describe what you want the team to build..." : "Ask AI anything..."}
            disabled={
              chatMutation.isPending || 
              multiAgentMutation.isPending || 
              (useMultiAgent ? activeTeams.length === 0 : availableProviders.length === 0)
            }
          />
          <Button
            type="submit"
            size="sm"
            disabled={
              !message.trim() || 
              chatMutation.isPending || 
              multiAgentMutation.isPending || 
              (useMultiAgent ? activeTeams.length === 0 : availableProviders.length === 0)
            }
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
