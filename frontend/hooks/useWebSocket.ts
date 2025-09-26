import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import backend from '~backend/client';

interface WebSocketMessage {
  type: 'file_created' | 'file_updated' | 'file_deleted' | 'build_started' | 'build_completed' | 'build_failed' | 'preview_ready' | 'agent_reasoning' | 'session_update' | 'pong' | 'ping' | 'subscribe_project' | 'subscribe_session';
  projectId?: string;
  sessionId?: string;
  data?: any;
  timestamp?: string;
}

interface UseWebSocketOptions {
  projectId?: string;
  sessionId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onFileUpdate?: (filePath: string, operation: string, content?: string) => void;
  onBuildUpdate?: (status: string, buildId: string, output?: string, error?: string) => void;
  onPreviewReady?: (url: string) => void;
  onAgentReasoning?: (agentName: string, reasoning: string, action: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { isSignedIn, getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 10;
  const shouldReconnectRef = useRef(true);

  const connect = async () => {
    try {
      if (!isSignedIn) {
        setError('Not signed in');
        return;
      }

      // Close existing connection
      if (streamRef.current) {
        shouldReconnectRef.current = false;
        try {
          await streamRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
        streamRef.current = null;
      }

      shouldReconnectRef.current = true;
      console.log('Connecting to WebSocket stream...');
      
      // Get authentication token
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Create auth-enabled client
      const authClient = backend.with({
        auth: { authorization: `Bearer ${token}` }
      });

      // Connect to the streaming endpoint with authentication
      const stream = await authClient.realtime.ws({
        projectId: options.projectId,
        sessionId: options.sessionId
      });

      streamRef.current = stream;
      setConnected(true);
      setError(null);
      setReconnectAttempts(0);

      console.log('WebSocket stream connected');

      // Subscribe to project updates if projectId is provided
      if (options.projectId) {
        await stream.send({
          type: 'subscribe_project',
          projectId: options.projectId
        });
      }
      
      // Subscribe to session updates if sessionId is provided
      if (options.sessionId) {
        await stream.send({
          type: 'subscribe_session',
          sessionId: options.sessionId
        });
      }

      // Listen for messages
      try {
        for await (const message of stream) {
          console.log('WebSocket message received:', message);
          
          // Call the general message handler
          options.onMessage?.(message);
          
          // Call specific handlers based on message type
          switch (message.type) {
            case 'file_created':
            case 'file_updated':
            case 'file_deleted':
              options.onFileUpdate?.(
                message.data?.filePath,
                message.data?.operation,
                message.data?.content
              );
              break;
              
            case 'build_started':
            case 'build_completed':
            case 'build_failed':
              options.onBuildUpdate?.(
                message.data?.status,
                message.data?.buildId,
                message.data?.output,
                message.data?.error
              );
              break;
              
            case 'preview_ready':
              options.onPreviewReady?.(message.data?.url);
              break;
              
            case 'agent_reasoning':
              options.onAgentReasoning?.(
                message.data?.agentName,
                message.data?.reasoning,
                message.data?.action
              );
              break;
          }
        }
      } catch (streamError) {
        console.error('WebSocket stream error:', streamError);
        setConnected(false);
        
        if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts && isSignedIn) {
          const baseDelay = 1000;
          const maxDelay = 30000;
          const jitter = Math.random() * 1000;
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts) + jitter, maxDelay);
          
          console.log(`WebSocket disconnected. Reconnecting in ${Math.round(delay)}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          setError(`Reconnecting... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else {
          setError('Connection lost - please refresh to retry');
          console.error('WebSocket connection failed permanently after', maxReconnectAttempts, 'attempts');
        }
      } finally {
        setConnected(false);
        streamRef.current = null;
      }

    } catch (error) {
      console.error('Failed to connect WebSocket stream:', error);
      setConnected(false);
      
      // More specific error messages based on the error type
      let errorMessage = 'Failed to connect to real-time updates';
      if (error instanceof Error) {
        if (error.message.includes('authentication') || error.message.includes('401')) {
          errorMessage = 'Authentication failed - please sign in again';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = 'Network error - check your connection';
        } else if (error.message.includes('token')) {
          errorMessage = 'Authentication token expired - please refresh';
        }
      }
      setError(errorMessage);
      
      // Auto-reconnect on connection failure
      if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts && isSignedIn) {
        const baseDelay = 2000;
        const maxDelay = 30000;
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts) + jitter, maxDelay);
        
        console.log(`Reconnecting after error in ${Math.round(delay)}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      } else {
        console.error('WebSocket connection failed permanently:', error);
      }
    }
  };

  const disconnect = async () => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (streamRef.current) {
      try {
        await streamRef.current.close();
      } catch (e) {
        // Ignore close errors
      }
      streamRef.current = null;
    }
    
    setConnected(false);
    setReconnectAttempts(0);
  };

  const sendMessage = async (message: WebSocketMessage) => {
    if (streamRef.current && connected) {
      try {
        await streamRef.current.send(message);
      } catch (error) {
        console.warn('Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  };

  // Connect when options change or when signed in
  useEffect(() => {
    if (isSignedIn) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [options.projectId, options.sessionId, isSignedIn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    connected,
    error,
    connect,
    disconnect,
    sendMessage,
    reconnectAttempts
  };
}