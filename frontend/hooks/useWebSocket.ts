import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface WebSocketMessage {
  type: 'file_created' | 'file_updated' | 'file_deleted' | 'build_started' | 'build_completed' | 'build_failed' | 'preview_ready' | 'agent_reasoning' | 'session_update';
  projectId: string;
  sessionId?: string;
  data: any;
  timestamp: string;
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
  const { getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const connect = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setError('No authentication token available');
        return;
      }

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const params = new URLSearchParams({ token });
      
      if (options.projectId) {
        params.set('projectId', options.projectId);
      }
      if (options.sessionId) {
        params.set('sessionId', options.sessionId);
      }

      const wsUrl = `${protocol}//${host}/ws?${params}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setError(null);
        setReconnectAttempts(0);
        
        // Subscribe to project updates if projectId is provided
        if (options.projectId) {
          ws.send(JSON.stringify({
            type: 'subscribe_project',
            projectId: options.projectId
          }));
        }
        
        // Subscribe to session updates if sessionId is provided
        if (options.sessionId) {
          ws.send(JSON.stringify({
            type: 'subscribe_session',
            sessionId: options.sessionId
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          // Call the general message handler
          options.onMessage?.(message);
          
          // Call specific handlers based on message type
          switch (message.type) {
            case 'file_created':
            case 'file_updated':
            case 'file_deleted':
              options.onFileUpdate?.(
                message.data.filePath,
                message.data.operation,
                message.data.content
              );
              break;
              
            case 'build_started':
            case 'build_completed':
            case 'build_failed':
              options.onBuildUpdate?.(
                message.data.status,
                message.data.buildId,
                message.data.output,
                message.data.error
              );
              break;
              
            case 'preview_ready':
              options.onPreviewReady?.(message.data.url);
              break;
              
            case 'agent_reasoning':
              options.onAgentReasoning?.(
                message.data.agentName,
                message.data.reasoning,
                message.data.action
              );
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect logic
        if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
      };

      wsRef.current = ws;

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setError('Failed to connect to real-time updates');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
    setReconnectAttempts(0);
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  };

  // Connect when options change
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [options.projectId, options.sessionId]);

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
    sendMessage
  };
}