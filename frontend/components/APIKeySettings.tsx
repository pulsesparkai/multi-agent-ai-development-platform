import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Key, Save, Trash2, Eye, EyeOff, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';
import TestAIChat from './TestAIChat';

interface APIKeySettingsProps {
  onClose?: () => void;
  projectId?: string; // Optional project ID for testing
}

const providerNames = {
  anthropic: 'Claude (Anthropic)',
  openai: 'GPT-4 (OpenAI)', 
  google: 'Gemini (Google)',
  xai: 'Grok (xAI)'
} as const;

export default function APIKeySettings({ onClose, projectId }: APIKeySettingsProps) {
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      const result = await backend.ai.listKeys();
      return result.apiKeys;
    },
  });

  const setKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      return backend.ai.setKey({ provider: provider as any, apiKey });
    },
    onSuccess: (_, { provider }) => {
      toast({
        title: 'API Key Saved',
        description: `${providerNames[provider as keyof typeof providerNames]} API key has been saved`,
      });
      setNewKeys(prev => ({ ...prev, [provider]: '' }));
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Save API Key',
        description: error?.message || 'An error occurred while saving the API key',
        variant: 'destructive',
      });
    },
  });

  const handleSetKey = (provider: string) => {
    const apiKey = newKeys[provider]?.trim();
    if (!apiKey) {
      toast({
        title: 'Invalid API Key',
        description: 'Please enter a valid API key',
        variant: 'destructive',
      });
      return;
    }

    setKeyMutation.mutate({ provider, apiKey });
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground mt-2">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure your AI provider API keys to enable chat functionality.
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(providerNames).map(([provider, name]) => {
          const existingKey = apiKeys.find(k => k.provider === provider);
          const isUpdating = setKeyMutation.isPending;

          return (
            <div key={provider} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">{name}</Label>
                  {existingKey && (
                    <Badge variant="secondary" className="text-xs">
                      Configured
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[provider] ? 'text' : 'password'}
                      value={newKeys[provider] || ''}
                      onChange={(e) => setNewKeys(prev => ({ ...prev, [provider]: e.target.value }))}
                      placeholder={existingKey ? '••••••••••••••••' : 'Enter your API key'}
                      disabled={isUpdating}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => toggleShowKey(provider)}
                    >
                      {showKeys[provider] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleSetKey(provider)}
                    disabled={!newKeys[provider]?.trim() || isUpdating}
                    size="sm"
                  >
                    {isUpdating ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {provider === 'anthropic' && (
                      <>Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.anthropic.com</a></>
                    )}
                    {provider === 'openai' && (
                      <>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.openai.com</a></>
                    )}
                    {provider === 'google' && (
                      <>Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a></>
                    )}
                    {provider === 'xai' && (
                      <>Get your API key from <a href="https://console.x.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">console.x.ai</a></>
                    )}
                  </div>
                  
                  {/* Show validation error if any */}
                  {existingKey?.lastError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      {existingKey.lastError}
                    </div>
                  )}
                  
                  {/* Show validation success info */}
                  {existingKey?.isActive && existingKey?.validatedAt && (
                    <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200">
                      <Check className="h-3 w-3 inline mr-1" />
                      Validated on {new Date(existingKey.validatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                {/* Test API functionality if key exists and projectId is provided */}
                {existingKey && projectId && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border-t border-gray-200">
                    <div className="text-sm font-medium mb-2">Test API Connection</div>
                    <TestAIChat projectId={projectId} provider={provider as any} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• API keys are encrypted and stored securely</p>
          <p>• Keys are only used to make requests to the respective AI providers</p>
          <p>• You can update or remove your keys at any time</p>
        </div>
      </div>
    </div>
  );
}