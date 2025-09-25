import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Zap, 
  FileText, 
  Monitor, 
  ExternalLink, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Code,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface SimpleGeneratorProps {
  onClose: () => void;
}

interface GenerationSession {
  sessionId: string;
  status: 'generating' | 'building' | 'completed' | 'failed';
  files?: { path: string; content: string }[];
  previewUrl?: string;
  error?: string;
  logs?: string[];
}

export default function SimpleGenerator({ onClose }: SimpleGeneratorProps) {
  const backend = useBackend();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('deepseek-chat');
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  // Query for session status
  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ['simple-generation', currentSession],
    queryFn: () => currentSession ? backend.tools.getGenerationStatus({ sessionId: currentSession }) : null,
    enabled: !!currentSession,
    refetchInterval: 2000, // Poll every 2 seconds while generating
  });

  // Generate website mutation
  const generateMutation = useMutation({
    mutationFn: (data: { prompt: string; provider: string; model: string }) =>
      backend.tools.generateWebsite(data),
    onSuccess: (response) => {
      setCurrentSession(response.sessionId);
      toast({ title: "Started generating website..." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to start generation", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({ title: "Please enter a description", variant: "destructive" });
      return;
    }
    generateMutation.mutate({ prompt, provider, model });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'generating':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'building':
        return <Loader2 className="h-4 w-4 animate-spin text-orange-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Code className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'generating':
        return 'bg-blue-100 text-blue-800';
      case 'building':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get the actual session data
  const session = sessionData;

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI Website Builder</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {/* Input Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Describe Your Website</CardTitle>
            <CardDescription>
              Tell AI what kind of website you want to build
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Create a modern portfolio website with dark theme, hero section, about page, and contact form..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px]"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Provider</label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Claude</SelectItem>
                    <SelectItem value="xai">xAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Model</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provider === 'deepseek' && (
                      <>
                        <SelectItem value="deepseek-chat">deepseek-chat</SelectItem>
                        <SelectItem value="deepseek-coder">deepseek-coder</SelectItem>
                      </>
                    )}
                    {provider === 'openai' && (
                      <>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      </>
                    )}
                    {provider === 'anthropic' && (
                      <>
                        <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                        <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                      </>
                    )}
                    {provider === 'xai' && (
                      <SelectItem value="grok-beta">Grok Beta</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? 'Starting...' : 'Generate Website'}
            </Button>
          </CardContent>
        </Card>

        {/* Generation Status */}
        {session && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {getStatusIcon(session.status)}
                Generation Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge className={getStatusColor(session.status)}>
                {session.status}
              </Badge>

              {session.logs && session.logs.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Progress</label>
                  <div className="text-xs space-y-1">
                    {session.logs.map((log: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {session.error}
                </div>
              )}

              {session.previewUrl && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                  <Monitor className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Live Preview:</span>
                  <a 
                    href={session.previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                  >
                    View Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Generated Files */}
        {session?.files && session.files.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Generated Files ({session.files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {session.files.map((file: { path: string; content: string }, index: number) => (
                    <details key={index} className="text-sm border rounded">
                      <summary className="cursor-pointer p-2 hover:bg-gray-50 flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        <span className="font-mono">{file.path}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {file.content.split('\\n').length} lines
                        </Badge>
                      </summary>
                      <div className="p-2 border-t bg-gray-50">
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                          {file.content}
                        </pre>
                      </div>
                    </details>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!currentSession && (
          <div className="text-center text-muted-foreground py-12">
            <Code className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">AI Website Builder</h3>
            <p className="text-sm mb-4">
              Describe your website and AI will build it for you
            </p>
            <div className="text-xs space-y-1">
              <p>✨ Works with just one API key</p>
              <p>🚀 Generates complete, working websites</p>
              <p>👀 Live preview included</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}