import { api, StreamInOut } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";

interface WebSocketMessage {
  type: 'file_created' | 'file_updated' | 'file_deleted' | 'build_started' | 'build_completed' | 'build_failed' | 'preview_ready' | 'agent_reasoning' | 'session_update' | 'pong' | 'ping' | 'subscribe_project' | 'subscribe_session';
  projectId?: string;
  sessionId?: string;
  data?: any;
  timestamp?: string;
}

interface WSHandshake {
  projectId?: string;
  sessionId?: string;
}

interface ConnectedClient {
  stream: StreamInOut<WebSocketMessage, WebSocketMessage>;
  userId: string;
  projectId?: string;
  sessionId?: string;
}

class WebSocketManager {
  private clients: Map<string, ConnectedClient> = new Map();

  addClient(clientId: string, client: ConnectedClient) {
    this.clients.set(clientId, client);
    log.info(`WebSocket client connected: ${clientId}, user: ${client.userId}`);
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
    log.info(`WebSocket client disconnected: ${clientId}`);
  }

  updateClientProject(clientId: string, projectId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.projectId = projectId;
    }
  }

  updateClientSession(clientId: string, sessionId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.sessionId = sessionId;
    }
  }

  private async sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        await client.stream.send(message);
      } catch (error) {
        log.error(`Failed to send message to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for broadcasting updates
  async broadcastFileUpdate(projectId: string, operation: 'created' | 'updated' | 'deleted', filePath: string, content?: string) {
    const message: WebSocketMessage = {
      type: `file_${operation}` as any,
      projectId,
      data: { filePath, content, operation },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToProject(projectId, message);
  }

  async broadcastBuildUpdate(projectId: string, status: 'started' | 'completed' | 'failed', buildId: string, output?: string, error?: string) {
    const message: WebSocketMessage = {
      type: `build_${status}` as any,
      projectId,
      data: { buildId, output, error, status },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToProject(projectId, message);
  }

  async broadcastPreviewReady(projectId: string, url: string) {
    const message: WebSocketMessage = {
      type: 'preview_ready',
      projectId,
      data: { url },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToProject(projectId, message);
  }

  async broadcastAgentReasoning(projectId: string, sessionId: string, agentName: string, reasoning: string, action: string) {
    const message: WebSocketMessage = {
      type: 'agent_reasoning',
      projectId,
      sessionId,
      data: { agentName, reasoning, action },
      timestamp: new Date().toISOString()
    };

    await this.broadcastToSession(sessionId, message);
  }

  private async broadcastToProject(projectId: string, message: WebSocketMessage) {
    const promises = [];
    for (const [clientId, client] of this.clients) {
      if (client.projectId === projectId) {
        promises.push(this.sendToClient(clientId, message));
      }
    }
    await Promise.allSettled(promises);
  }

  private async broadcastToSession(sessionId: string, message: WebSocketMessage) {
    const promises = [];
    for (const [clientId, client] of this.clients) {
      if (client.sessionId === sessionId) {
        promises.push(this.sendToClient(clientId, message));
      }
    }
    await Promise.allSettled(promises);
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}

// WebSocket streaming endpoint using Encore.ts
export const ws = api.streamInOut<WSHandshake, WebSocketMessage, WebSocketMessage>(
  { expose: true, path: "/ws", auth: true },
  async (handshake, stream) => {
    const clientId = wsManager.generateClientId();
    
    // Get user from auth context
    const auth = getAuthData();
    const userId = auth?.userID || 'anonymous';
    
    const client: ConnectedClient = {
      stream,
      userId,
      projectId: handshake?.projectId,
      sessionId: handshake?.sessionId
    };
    
    wsManager.addClient(clientId, client);
    
    // Send welcome message
    await stream.send({
      type: 'session_update',
      projectId: client.projectId,
      data: { status: 'connected', clientId },
      timestamp: new Date().toISOString()
    });
    
    try {
      for await (const message of stream) {
        switch (message.type) {
          case 'subscribe_project':
            if (message.projectId) {
              wsManager.updateClientProject(clientId, message.projectId);
            }
            break;
          case 'subscribe_session':
            if (message.sessionId) {
              wsManager.updateClientSession(clientId, message.sessionId);
            }
            break;
          case 'ping':
            await stream.send({ 
              type: 'pong', 
              timestamp: new Date().toISOString() 
            });
            break;
        }
      }
    } catch (error) {
      log.error(`WebSocket stream error for client ${clientId}:`, error);
    } finally {
      wsManager.removeClient(clientId);
    }
  }
);

export const wsManager = new WebSocketManager();
export type { WebSocketMessage, ConnectedClient, WSHandshake };