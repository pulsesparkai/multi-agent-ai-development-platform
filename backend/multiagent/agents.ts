import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { v4 as uuidv4 } from "uuid";
import { CreateAgentRequest, Agent } from "./types";

// Creates a new agent in a team
export const createAgent = api<CreateAgentRequest, Agent>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/agents" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${req.teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    const agentId = uuidv4();
    const systemPrompt = req.systemPrompt || getDefaultSystemPrompt(req.role);

    await db.exec`
      INSERT INTO agents (id, team_id, name, role, provider, model, system_prompt, execution_order)
      VALUES (${agentId}, ${req.teamId}, ${req.name}, ${req.role}, ${req.provider}, ${req.model}, ${systemPrompt}, ${req.executionOrder})
    `;

    const agent = await db.queryRow<Agent>`
      SELECT id, team_id as "teamId", name, role, provider, model, system_prompt as "systemPrompt",
             execution_order as "executionOrder", is_enabled as "isEnabled",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM agents
      WHERE id = ${agentId}
    `;

    if (!agent) {
      throw APIError.internal("failed to create agent");
    }

    return agent;
  }
);

// Updates an agent
export const updateAgent = api<{ agentId: string } & Partial<CreateAgentRequest>, Agent>(
  { auth: true, expose: true, method: "PATCH", path: "/multiagent/agents/:agentId" },
  async ({ agentId, ...updates }) => {
    const auth = getAuthData()!;

    // Verify agent ownership through team
    const agent = await db.queryRow`
      SELECT a.id, a.team_id
      FROM agents a
      JOIN agent_teams t ON a.team_id = t.id
      WHERE a.id = ${agentId} AND t.user_id = ${auth.userID}
    `;

    if (!agent) {
      throw APIError.notFound("agent not found");
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push("name = $" + (updateValues.length + 1));
      updateValues.push(updates.name);
    }
    if (updates.role !== undefined) {
      updateFields.push("role = $" + (updateValues.length + 1));
      updateValues.push(updates.role);
    }
    if (updates.provider !== undefined) {
      updateFields.push("provider = $" + (updateValues.length + 1));
      updateValues.push(updates.provider);
    }
    if (updates.model !== undefined) {
      updateFields.push("model = $" + (updateValues.length + 1));
      updateValues.push(updates.model);
    }
    if (updates.systemPrompt !== undefined) {
      updateFields.push("system_prompt = $" + (updateValues.length + 1));
      updateValues.push(updates.systemPrompt);
    }
    if (updates.executionOrder !== undefined) {
      updateFields.push("execution_order = $" + (updateValues.length + 1));
      updateValues.push(updates.executionOrder);
    }

    if (updateFields.length === 0) {
      throw APIError.invalidArgument("no fields to update");
    }

    updateFields.push("updated_at = NOW()");
    updateValues.push(agentId);

    const query = `
      UPDATE agents
      SET ${updateFields.join(", ")}
      WHERE id = $${updateValues.length}
    `;
    
    await db.rawExec(query, ...updateValues);

    const updatedAgent = await db.queryRow<Agent>`
      SELECT id, team_id as "teamId", name, role, provider, model, system_prompt as "systemPrompt",
             execution_order as "executionOrder", is_enabled as "isEnabled",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM agents
      WHERE id = ${agentId}
    `;

    if (!updatedAgent) {
      throw APIError.internal("failed to update agent");
    }

    return updatedAgent;
  }
);

// Toggles agent enabled/disabled
export const toggleAgent = api<{ agentId: string; enabled: boolean }, { success: boolean }>(
  { auth: true, expose: true, method: "PATCH", path: "/multiagent/agents/:agentId/toggle" },
  async ({ agentId, enabled }) => {
    const auth = getAuthData()!;

    // Verify agent ownership through team
    const agent = await db.queryRow`
      SELECT a.id
      FROM agents a
      JOIN agent_teams t ON a.team_id = t.id
      WHERE a.id = ${agentId} AND t.user_id = ${auth.userID}
    `;

    if (!agent) {
      throw APIError.notFound("agent not found");
    }

    await db.exec`
      UPDATE agents
      SET is_enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${agentId}
    `;

    return { success: true };
  }
);

// Deletes an agent
export const deleteAgent = api<{ agentId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/multiagent/agents/:agentId" },
  async ({ agentId }) => {
    const auth = getAuthData()!;

    // Verify agent ownership through team
    const agent = await db.queryRow`
      SELECT a.id
      FROM agents a
      JOIN agent_teams t ON a.team_id = t.id
      WHERE a.id = ${agentId} AND t.user_id = ${auth.userID}
    `;

    if (!agent) {
      throw APIError.notFound("agent not found");
    }

    await db.exec`
      DELETE FROM agents WHERE id = ${agentId}
    `;

    return { success: true };
  }
);

// Helper function to get default system prompts based on role
function getDefaultSystemPrompt(role: string): string {
  const prompts = {
    planner: "You are a strategic planner agent responsible for breaking down user requests into actionable tasks. Analyze the requirements, identify dependencies, and create a structured plan with clear steps.",
    coder: "You are a code generation agent specialized in writing clean, efficient, and well-documented code. Follow best practices and implement proper error handling.",
    tester: "You are a testing and debugging agent responsible for identifying issues, writing tests, and ensuring code quality. Review code for bugs and provide detailed feedback.",
    reviewer: "You are a code review agent focused on ensuring code quality, maintainability, and adherence to best practices. Provide constructive feedback and approve implementations.",
    coordinator: "You are a coordination agent responsible for managing the workflow between other agents. Make decisions about iteration continuation and synthesize outputs."
  };

  return prompts[role as keyof typeof prompts] || "You are an AI agent helping with software development tasks.";
}