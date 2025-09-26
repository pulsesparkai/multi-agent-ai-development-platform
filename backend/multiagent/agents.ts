import { api } from "encore.dev/api";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  capabilities: string[];
  model: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListAgentsResponse {
  agents: Agent[];
}

export const listAgents = api<void, ListAgentsResponse>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/agents" },
  async (): Promise<ListAgentsResponse> => {
    return { agents: [] }; // Temporarily return empty list
  }
);

export const createAgent = api<CreateAgentRequest, Agent>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/agents" },
  async (req): Promise<Agent> => {
    const agentId = generateId();
    return {
      id: agentId,
      name: req.name,
      description: req.description,
      capabilities: req.capabilities,
      model: req.model,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
);

export const updateAgent = api<{ agentId: string } & Partial<CreateAgentRequest>, Agent>(
  { auth: true, expose: true, method: "PUT", path: "/multiagent/agents/:agentId" },
  async ({ agentId, ...updates }): Promise<Agent> => {
    return {
      id: agentId,
      name: updates.name || 'Agent',
      description: updates.description,
      capabilities: updates.capabilities || [],
      model: updates.model || 'gpt-4',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
);

export const deleteAgent = api<{ agentId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/multiagent/agents/:agentId" },
  async ({ agentId }): Promise<{ success: boolean }> => {
    return { success: true };
  }
);