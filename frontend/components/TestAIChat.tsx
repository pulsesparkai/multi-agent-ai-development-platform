import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from '../hooks/useBackend';

interface TestAIChatProps {
  projectId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
}

export default function TestAIChat({ projectId, provider }: TestAIChatProps) {
  const [testMessage, setTestMessage] = useState("Create a simple React component that says 'Hello World'");
  const backend = useBackend();
  const { toast } = useToast();

  const testChatMutation = useMutation({
    mutationFn: async () => {
      return backend.ai.enhancedChat({
        projectId,
        message: testMessage,
        provider,
        autoApply: false, // Don't auto-apply for test
        autoBuild: false,
        autoPreview: false
      });
    },
    onSuccess: (response) => {
      toast({
        title: 'AI Test Successful!',
        description: `${provider} responded correctly. Your API key is working.`,
      });
    },
    onError: (error: any) => {
      console.error('AI test failed:', error);
      toast({
        title: 'AI Test Failed',
        description: error?.message || `Failed to connect to ${provider}. Check your API key.`,
        variant: 'destructive',
      });
    },
  });

  const handleTest = () => {
    if (!testMessage.trim()) return;
    testChatMutation.mutate();
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-2 block">Test Message</label>
        <Input
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Enter a test message..."
          disabled={testChatMutation.isPending}
        />
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={handleTest}
          disabled={!testMessage.trim() || testChatMutation.isPending}
          size="sm"
          className="flex-1"
        >
          {testChatMutation.isPending ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Test {provider}
            </>
          )}
        </Button>
      </div>
      
      {testChatMutation.isSuccess && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">
          <CheckCircle className="h-4 w-4" />
          AI connection successful!
        </div>
      )}
      
      {testChatMutation.isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <AlertCircle className="h-4 w-4" />
          {testChatMutation.error?.message || 'Test failed'}
        </div>
      )}
    </div>
  );
}