import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { getAuthData } from "~encore/auth";
import db from "../db";

interface WebSocketMessage {
  type: 'file_created' | 'file_updated' | 'file_deleted' | 'build_started' | 'build_completed' | 'build_failed' | 'preview_ready' | 'agent_reasoning' | 'session_update' | 'pong';
  projectId: string;
  sessionId?: string;
  data: any;
  timestamp: Date;
}

interface ConnectedClient {
  ws: any;
  userId: string;
  projectId?: string;
  sessionId?: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();

  initialize(server: any) {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });
  }

  private async handleConnection(ws: any, request: IncomingMessage) {
    try {
      // Extract auth from query parameters or headers
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Validate token and get user info
      // Note: This is a simplified version - in production, properly validate the JWT
      const userId = await this.validateToken(token);
      if (!userId) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const clientId = this.generateClientId();
      const client: ConnectedClient = {
        ws,
        userId,
        projectId: url.searchParams.get('projectId') || undefined,
        sessionId: url.searchParams.get('sessionId') || undefined
      };

      this.clients.set(clientId, client);
      
      console.log(`WebSocket client connected: ${clientId}, user: ${userId}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'session_update',
        projectId: client.projectId || '',
        data: { status: 'connected', clientId },
        timestamp: new Date()
      });

      ws.on('message', (data: string) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async validateToken(token: string): Promise<string | null> {
    try {
      // Simple token validation - in production, use proper JWT validation
      // For now, we'll just check if it's a valid user ID format
      if (token.startsWith('user_')) {
        return token;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(clientId: string, data: string) {
    try {
      const message = JSON.parse(data);
      const client = this.clients.get(clientId);
      
      if (!client) return;

      switch (message.type) {
        case 'subscribe_project':
          client.projectId = message.projectId;
          break;
        case 'subscribe_session':
          client.sessionId = message.sessionId;
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', projectId: '', data: {}, timestamp: new Date() });
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(JSON.stringify(message));
    }
  }

  // Public methods for broadcasting updates
  broadcastFileUpdate(projectId: string, operation: 'created' | 'updated' | 'deleted', filePath: string, content?: string) {
    const message: WebSocketMessage = {
      type: `file_${operation}` as any,
      projectId,
      data: { filePath, content, operation },
      timestamp: new Date()
    };

    this.broadcastToProject(projectId, message);
  }

  broadcastBuildUpdate(projectId: string, status: 'started' | 'completed' | 'failed', buildId: string, output?: string, error?: string) {
    const message: WebSocketMessage = {
      type: `build_${status}` as any,
      projectId,
      data: { buildId, output, error, status },
      timestamp: new Date()
    };

    this.broadcastToProject(projectId, message);
  }

  broadcastPreviewReady(projectId: string, url: string) {
    const message: WebSocketMessage = {
      type: 'preview_ready',
      projectId,
      data: { url },
      timestamp: new Date()
    };

    this.broadcastToProject(projectId, message);
  }

  broadcastAgentReasoning(projectId: string, sessionId: string, agentName: string, reasoning: string, action: string) {
    const message: WebSocketMessage = {
      type: 'agent_reasoning',
      projectId,
      sessionId,
      data: { agentName, reasoning, action },
      timestamp: new Date()
    };

    this.broadcastToSession(sessionId, message);
  }

  private broadcastToProject(projectId: string, message: WebSocketMessage) {
    for (const [clientId, client] of this.clients) {
      if (client.projectId === projectId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private broadcastToSession(sessionId: string, message: WebSocketMessage) {
    for (const [clientId, client] of this.clients) {
      if (client.sessionId === sessionId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
export type { WebSocketMessage, ConnectedClient };