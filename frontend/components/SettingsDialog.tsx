import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Key, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const backend = useBackend();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => backend.ai.listKeys(),
    enabled: open,
  });

  const setKeyMutation = useMutation({
    mutationFn: (data: { provider: string; apiKey: string }) =>
      backend.ai.setKey(data as any),
    onSuccess: (_, variables) => {
      toast({
        title: 'API Key saved',
        description: `${variables.provider} API key has been saved securely.`,
      });
      setApiKeys(prev => ({ ...prev, [variables.provider]: '' }));
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error) => {
      console.error('Failed to save API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to save API key. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveKey = (provider: string) => {
    const key = apiKeys[provider];
    if (!key?.trim()) return;

    setKeyMutation.mutate({ provider, apiKey: key.trim() });
  };

  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT-4, GPT-3.5-turbo models',
      placeholder: 'sk-...',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude 3 models',
      placeholder: 'sk-ant-...',
    },
    {
      id: 'google',
      name: 'Google AI',
      description: 'Gemini models',
      placeholder: 'AIza...',
    },
    {
      id: 'xai',
      name: 'xAI',
      description: 'Grok models',
      placeholder: 'xai-...',
    },
  ];

  const hasKey = (providerId: string) => {
    return existingKeys?.apiKeys.some(key => key.provider === providerId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your AI providers and API keys.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="api-keys" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          </TabsList>
          
          <TabsContent value="api-keys" className="space-y-4 mt-4">
            <div className="space-y-4">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{provider.name}</h4>
                        {hasKey(provider.id) && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`${provider.id}-key`}>API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id={`${provider.id}-key`}
                        type="password"
                        placeholder={provider.placeholder}
                        value={apiKeys[provider.id] || ''}
                        onChange={(e) =>
                          setApiKeys(prev => ({
                            ...prev,
                            [provider.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey(provider.id)}
                        disabled={
                          !apiKeys[provider.id]?.trim() ||
                          setKeyMutation.isPending
                        }
                      >
                        <Key className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-sm text-muted-foreground border-t border-border pt-4">
              <p>
                Your API keys are encrypted and stored securely. They are only used to make
                requests to the respective AI providers on your behalf.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
