import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Send, X, Bot, User, Settings, Code, FileText, Copy, 
  Play, Hammer, Eye, CheckCircle, AlertCircle, Clock,
  Zap, Wrench
} from 'lucide-react';
import MessageRenderer from './MessageRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { useWebSocket } from '../hooks/useWebSocket';
import { config } from '../config';

interface EnhancedChatSidebarProps {
  projectId: string;
  onClose: () => void;
  onSwitchToMultiAgent?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface EnhancedChatResponse {
  message: ChatMessage;
  sessionId: string;
  filesChanged?: string[];
  buildStarted?: boolean;
  previewUrl?: string;
  errors?: string[];
}

export default function EnhancedChatSidebar({ projectId, onClose, onSwitchToMultiAgent }: EnhancedChatSidebarProps) {
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google' | 'xai'>('anthropic');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [autoApply, setAutoApply] = useState(config.defaultAutoApply);
  const [autoBuild, setAutoBuild] = useState(config.defaultAutoBuild);
  const [autoPreview, setAutoPreview] = useState(config.defaultAutoPreview);
  const [sessionId, setSessionId] = useState<string>('');
  const [lastResponse, setLastResponse] = useState<EnhancedChatResponse | null>(null);
  const [reasoning, setReasoning] = useState<Array<{
    agentName: string;
    reasoning: string;
    action: string;
    timestamp: Date;
  }>>([]);
  const [fileUpdates, setFileUpdates] = useState<Array<{
    filePath: string;
    operation: string;
    timestamp: Date;
  }>>([]);
  const [buildStatus, setBuildStatus] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebSocket for real-time updates (disabled in offline mode)
  const { connected: wsConnected, error: wsError } = useWebSocket({
    projectId: config.offlineMode ? undefined : projectId,
    sessionId: config.offlineMode ? undefined : (sessionId || undefined),
    onAgentReasoning: (agentName, reasoningText, action) => {
      setReasoning(prev => [...prev, {
        agentName,
        reasoning: reasoningText,
        action,
        timestamp: new Date()
      }]);
    },
    onFileUpdate: (filePath, operation) => {
      setFileUpdates(prev => [...prev, {
        filePath,
        operation,
        timestamp: new Date()
      }]);
      
      // Show notification
      toast({
        title: `File ${operation}`,
        description: filePath,
        duration: 2000
      });
    },
    onBuildUpdate: (status, buildId, output, error) => {
      setBuildStatus(status);
      if (status === 'completed') {
        toast({
          title: 'Build completed',
          description: 'Your project has been built successfully',
        });
      } else if (status === 'failed') {
        toast({
          title: 'Build failed',
          description: error || 'Build failed with unknown error',
          variant: 'destructive'
        });
      }
    },
    onPreviewReady: (url) => {
      setPreviewUrl(url);
      toast({
        title: 'Preview ready',
        description: 'Your website is now available for preview',
      });
    }
  });

  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys', provider],
    queryFn: async () => {
      try {
        // Mock API key check for now - replace with actual implementation
        return "dummy-key";
      } catch (error) {
        return null;
      }
    },
  });

  const enhancedChatMutation = useMutation({
    mutationFn: (data: { 
      message: string; 
      provider: 'openai' | 'anthropic' | 'google' | 'xai';
      autoApply?: boolean;
      autoBuild?: boolean;
      autoPreview?: boolean;
    }) => {
      console.log('Sending enhanced chat request:', { 
        projectId, 
        provider: data.provider, 
        messageLength: data.message.length,
        autoApply: data.autoApply,
        autoBuild: data.autoBuild,
        autoPreview: data.autoPreview
      });
      
      return backend.ai.enhancedChat({
        projectId,
        message: data.message,
        provider: data.provider,
        autoApply: data.autoApply,
        autoBuild: data.autoBuild,
        autoPreview: data.autoPreview
      });
    },
    onSuccess: (response: EnhancedChatResponse) => {
      console.log('Enhanced chat response received:', response);
      
      // Add user message if not already added
      if (!messages.find(m => m.content === message && m.role === 'user')) {
        setMessages(prev => [...prev, {
          role: 'user',
          content: message,
          timestamp: new Date()
        }]);
      }
      
      // Add assistant message
      setMessages(prev => [...prev, response.message]);
      setSessionId(response.sessionId);
      setLastResponse(response);
      setMessage('');
      
      // Show notifications for actions taken
      if (response.filesChanged && response.filesChanged.length > 0) {
        toast({
          title: 'Files Updated',
          description: `${response.filesChanged.length} files were created/modified`,
        });
        
        // Refresh file list
        queryClient.invalidateQueries({ queryKey: ['files', projectId] });
        queryClient.invalidateQueries({ queryKey: ['workspace-status', projectId] });
      }
      
      if (response.buildStarted) {
        toast({
          title: 'Build Started',
          description: 'Project build has been initiated automatically',
        });
      }
      
      if (response.previewUrl) {
        toast({
          title: 'Preview Ready',
          description: 'Preview server is available',
        });
      }
      
      if (response.errors && response.errors.length > 0) {
        response.errors.forEach(error => {
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
        });
      }
    },
    onError: (error: any) => {
      console.error('Enhanced chat error:', error);
      toast({
        title: 'Chat Error',
        description: error?.message || 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || enhancedChatMutation.isPending) return;

    // Clear previous reasoning and updates when starting new request
    setReasoning([]);
    setFileUpdates([]);
    setBuildStatus('');
    setPreviewUrl('');

    enhancedChatMutation.mutate({
      message: message.trim(),
      provider,
      autoApply,
      autoBuild,
      autoPreview
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Message copied to clipboard',
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const hasApiKey = !!apiKeys;

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="font-medium truncate">Enhanced AI Chat</h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onSwitchToMultiAgent && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onSwitchToMultiAgent}
                title="Switch to Multi-Agent"
              >
                <Wrench className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Settings */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="provider" className="text-xs">AI Provider</Label>
            <Select value={provider} onValueChange={(value: any) => setProvider(value)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                <SelectItem value="openai">GPT-4 (OpenAI)</SelectItem>
                <SelectItem value="google">Gemini (Google)</SelectItem>
                <SelectItem value="xai">Grok (xAI)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Auto-actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-apply" className="text-xs flex items-center gap-1">
                <Code className="h-3 w-3" />
                Auto-apply files
              </Label>
              <Switch
                id="auto-apply"
                checked={autoApply}
                onCheckedChange={setAutoApply}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-build" className="text-xs flex items-center gap-1">
                <Hammer className="h-3 w-3" />
                Auto-build
              </Label>
              <Switch
                id="auto-build"
                checked={autoBuild}
                onCheckedChange={setAutoBuild}
                disabled={!autoApply}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-preview" className="text-xs flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Auto-preview
              </Label>
              <Switch
                id="auto-preview"
                checked={autoPreview}
                onCheckedChange={setAutoPreview}
                disabled={!autoApply || !autoBuild}
              />
            </div>
          </div>
        </div>
        
        {/* Real-time Status */}
        <div className="mt-3 space-y-2">
          {/* WebSocket Connection Status */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-muted-foreground">
              {config.offlineMode ? 'Offline mode' : (wsConnected ? 'Real-time updates active' : 'Connecting...')}
            </span>
          </div>

          {/* Latest Reasoning */}
          {reasoning.length > 0 && (
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-800 mb-1">AI Status:</div>
              <div className="text-xs text-blue-700 flex items-start gap-1">
                <Zap className="h-3 w-3 animate-pulse flex-shrink-0 mt-0.5" />
                <span className="break-words overflow-wrap-anywhere">{reasoning[reasoning.length - 1].reasoning}</span>
              </div>
            </div>
          )}

          {/* Build Status */}
          {buildStatus && (
            <div className={`p-2 rounded-lg border ${
              buildStatus === 'completed' ? 'bg-green-50 border-green-200' :
              buildStatus === 'failed' ? 'bg-red-50 border-red-200' :
              'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="text-xs font-medium mb-1">Build Status:</div>
              <div className="text-xs flex items-center gap-1">
                <Hammer className={`h-3 w-3 ${buildStatus === 'started' ? 'animate-spin' : ''}`} />
                {buildStatus === 'started' && 'Building...'}
                {buildStatus === 'completed' && 'Build completed'}
                {buildStatus === 'failed' && 'Build failed'}
              </div>
            </div>
          )}

          {/* Preview URL */}
          {previewUrl && (
            <div className="p-2 bg-green-50 rounded-lg border border-green-200">
              <div className="text-xs font-medium text-green-800 mb-1">Preview Ready:</div>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-6 text-xs"
                onClick={() => window.open(previewUrl, '_blank')}
              >
                <Eye className="h-3 w-3 mr-1" />
                Open Preview
              </Button>
            </div>
          )}

          {/* Recent File Updates */}
          {fileUpdates.length > 0 && (
            <div className="p-2 bg-gray-50 rounded-lg border">
              <div className="text-xs font-medium mb-1">Recent Files:</div>
              <div className="space-y-1">
                {fileUpdates.slice(-3).map((update, index) => (
                  <div key={index} className="text-xs flex items-center gap-1 text-gray-600 min-w-0">
                    <FileText className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span className="font-mono truncate flex-1">{update.filePath}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 overflow-x-hidden" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium mb-1">AI Development Assistant</p>
              <p className="text-sm">Ask me to build websites, create components, or help with your code!</p>
              
              <div className="mt-4 space-y-2 text-left">
                <p className="text-xs font-medium">Try saying:</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>"Create a React todo app with TypeScript"</div>
                  <div>"Build a landing page with Tailwind CSS"</div>
                  <div>"Add a contact form to my website"</div>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div key={index} className="space-y-2">
              <div className={cn(
                "flex gap-3",
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
                <div className={cn(
                  "flex gap-2 max-w-[85%] min-w-0",
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {msg.role === 'user' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                  </div>
                  <div className={cn(
                    "rounded-lg px-3 py-2 prose prose-sm max-w-none overflow-hidden",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-2'
                      : 'bg-muted text-foreground mr-2'
                  )}>
                    <MessageRenderer content={msg.content} role={msg.role} />
                    
                    {msg.role === 'assistant' && (
                      <div className="flex justify-end mt-2 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(msg.content)}
                          className="h-6 px-2"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Real-time reasoning updates */}
          {reasoning.length > 0 && enhancedChatMutation.isPending && (
            <div className="space-y-2">
              {reasoning.slice(-5).map((item, index) => (
                <div key={index} className="flex gap-3 justify-start opacity-75">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
                      <Zap className="h-3 w-3" />
                    </div>
                    <div className="bg-blue-50 text-blue-800 rounded-lg px-3 py-2 mr-2 border border-blue-200 min-w-0 flex-1">
                      <div className="text-xs font-medium mb-1 truncate">{item.agentName}</div>
                      <div className="text-xs break-words overflow-wrap-anywhere">{item.reasoning}</div>
                      <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        {item.action === 'thinking' && <Clock className="h-3 w-3 animate-pulse flex-shrink-0" />}
                        {item.action === 'generating' && <Code className="h-3 w-3 animate-pulse flex-shrink-0" />}
                        {item.action === 'applying' && <Hammer className="h-3 w-3 animate-spin flex-shrink-0" />}
                        {item.action === 'building' && <Hammer className="h-3 w-3 animate-spin flex-shrink-0" />}
                        {item.action === 'completed' && <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />}
                        {item.action === 'error' && <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                        <span className="truncate">{item.action}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {enhancedChatMutation.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="bg-muted text-foreground rounded-lg px-3 py-2 mr-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border flex-shrink-0">
        {!hasApiKey ? (
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No API key configured for {provider}
            </p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.open('/settings', '_blank')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure API Keys
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask me to build something..."
                disabled={enhancedChatMutation.isPending}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!message.trim() || enhancedChatMutation.isPending}
                className="gap-2"
              >
                {enhancedChatMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {autoApply && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Auto-actions enabled: Files will be created and applied automatically
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}