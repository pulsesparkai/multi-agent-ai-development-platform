import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBackend } from '../hooks/useBackend';

export default function AIDebugTest() {
  const [message, setMessage] = useState('Hello, can you respond with a simple greeting?');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const backend = useBackend();

  const testAI = async () => {
    setLoading(true);
    setResponse(null);
    
    try {
      console.log('Testing AI with message:', message);
      
      const result = await backend.ai.testChat({
        projectId: 'test-project-123',
        message: message,
        provider: 'anthropic'
      });
      
      console.log('AI test result:', result);
      setResponse(result);
      
    } catch (error) {
      console.error('AI test error:', error);
      setResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">AI Debug Test</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Test Message:</label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter a test message..."
          />
        </div>
        
        <Button 
          onClick={testAI} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing AI...' : 'Test AI Call'}
        </Button>
        
        {response && (
          <div className="mt-4 p-4 border rounded">
            <h3 className="font-medium mb-2">Response:</h3>
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-2 rounded">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}