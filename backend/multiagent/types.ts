export type AgentRole = 'planner' | 'coder' | 'tester' | 'reviewer' | 'coordinator' | 'custom';
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
  canAdaptRole: boolean;
  availableRoles: AgentRole[];
  currentRole: AgentRole;
  personaId?: string;
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
  canAdaptRole?: boolean;
  availableRoles?: AgentRole[];
  personaId?: string;
}

export interface CreatePersonaRequest {
  name: string;
  description?: string;
  systemPrompt: string;
  suggestedRole?: AgentRole;
  tags?: string[];
  isPublic?: boolean;
}

export interface CreateRoleRuleRequest {
  teamId: string;
  projectType?: string;
  trigger: RoleTrigger;
  fromRole: AgentRole;
  toRole: AgentRole;
  condition: string;
  priority?: number;
}

export interface RoleAssignmentRequest {
  projectRequirements: ProjectRequirement;
  currentWorkload: { [agentId: string]: number };
  sessionContext: string;
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

export interface CustomPersona {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  suggestedRole?: AgentRole;
  tags: string[];
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleAssignmentRule {
  id: string;
  teamId: string;
  projectType?: string;
  trigger: RoleTrigger;
  fromRole: AgentRole;
  toRole: AgentRole;
  condition: string;
  priority: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RoleTrigger = 'task_completion' | 'error_threshold' | 'complexity_increase' | 'manual' | 'time_based';

export interface ProjectRequirement {
  complexity: 'low' | 'medium' | 'high';
  domains: string[];
  techStack: string[];
  timeframe: 'short' | 'medium' | 'long';
  teamSize: 'small' | 'medium' | 'large';
}