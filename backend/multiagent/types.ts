export type AgentRole = 'planner' | 'coder' | 'tester' | 'reviewer' | 'coordinator';
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'xai';
export type SessionStatus = 'running' | 'completed' | 'failed' | 'paused';
export type MessageType = 'input' | 'output' | 'error' | 'tool_call';

export interface Agent {
  id: string;
  teamId: string;
  name: string;
  role: AgentRole;
  provider: LLMProvider;
  model: string;
  systemPrompt: string;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTeam {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  description?: string;
  isActive: boolean;
  budgetLimit: number;
  budgetUsed: number;
  agents?: Agent[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSession {
  id: string;
  teamId: string;
  projectId: string;
  userId: string;
  initialPrompt: string;
  status: SessionStatus;
  currentIteration: number;
  maxIterations: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  agentId: string;
  iteration: number;
  messageType: MessageType;
  content: any;
  metadata: any;
  cost: number;
  createdAt: Date;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  projectId?: string;
  budgetLimit?: number;
}

export interface CreateAgentRequest {
  teamId: string;
  name: string;
  role: AgentRole;
  provider: LLMProvider;
  model: string;
  systemPrompt?: string;
  executionOrder: number;
}

export interface StartSessionRequest {
  teamId: string;
  projectId: string;
  prompt: string;
  maxIterations?: number;
}

export interface SessionMessage {
  agentName: string;
  agentRole: AgentRole;
  content: string;
  iteration: number;
  messageType: MessageType;
  timestamp: Date;
  cost?: number;
}

export interface SessionResponse {
  sessionId: string;
  status: SessionStatus;
  messages: SessionMessage[];
  currentIteration: number;
  totalCost: number;
}