import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
// import { v4 as uuidv4 } from "uuid";
import { CreatePersonaRequest, CustomPersona } from "./types";

// Creates a new custom persona
export const createPersona = api<CreatePersonaRequest, CustomPersona>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/personas" },
  async (req) => {
    const auth = getAuthData()!;

    const personaId = uuidv4();

    await db.exec`
      INSERT INTO custom_personas (id, user_id, name, description, system_prompt, suggested_role, tags, is_public)
      VALUES (${personaId}, ${auth.userID}, ${req.name}, ${req.description || null}, ${req.systemPrompt}, 
              ${req.suggestedRole || null}, ${req.tags || []}, ${req.isPublic || false})
    `;

    const persona = await db.queryRow<CustomPersona>`
      SELECT id, user_id as "userId", name, description, system_prompt as "systemPrompt",
             suggested_role as "suggestedRole", tags, is_public as "isPublic",
             usage_count as "usageCount", created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_personas
      WHERE id = ${personaId}
    `;

    if (!persona) {
      throw APIError.internal("failed to create persona");
    }

    return persona;
  }
);

// Lists personas (user's own + public ones)
export const listPersonas = api<{ includePublic?: boolean; tags?: string[] }, { personas: CustomPersona[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/personas" },
  async (req) => {
    const auth = getAuthData()!;

    let query = `
      SELECT id, user_id as "userId", name, description, system_prompt as "systemPrompt",
             suggested_role as "suggestedRole", tags, is_public as "isPublic",
             usage_count as "usageCount", created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_personas
      WHERE user_id = $1
    `;
    
    const params: any[] = [auth.userID];

    if (req.includePublic) {
      query += ` OR is_public = true`;
    }

    if (req.tags && req.tags.length > 0) {
      query += ` AND tags && $${params.length + 1}`;
      params.push(req.tags);
    }

    query += ` ORDER BY usage_count DESC, created_at DESC`;

    const personas = await db.rawQueryAll<CustomPersona>(query, ...params);

    return { personas };
  }
);

// Gets a specific persona
export const getPersona = api<{ personaId: string }, CustomPersona>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/personas/:personaId" },
  async ({ personaId }) => {
    const auth = getAuthData()!;

    const persona = await db.queryRow<CustomPersona>`
      SELECT id, user_id as "userId", name, description, system_prompt as "systemPrompt",
             suggested_role as "suggestedRole", tags, is_public as "isPublic",
             usage_count as "usageCount", created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_personas
      WHERE id = ${personaId} AND (user_id = ${auth.userID} OR is_public = true)
    `;

    if (!persona) {
      throw APIError.notFound("persona not found");
    }

    return persona;
  }
);

// Updates a persona (only owner can update)
export const updatePersona = api<{ personaId: string } & Partial<CreatePersonaRequest>, CustomPersona>(
  { auth: true, expose: true, method: "PATCH", path: "/multiagent/personas/:personaId" },
  async ({ personaId, ...updates }) => {
    const auth = getAuthData()!;

    // Verify ownership
    const persona = await db.queryRow`
      SELECT id FROM custom_personas
      WHERE id = ${personaId} AND user_id = ${auth.userID}
    `;

    if (!persona) {
      throw APIError.notFound("persona not found or not authorized");
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.name !== undefined) {
      updateFields.push("name = $" + (updateValues.length + 1));
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push("description = $" + (updateValues.length + 1));
      updateValues.push(updates.description);
    }
    if (updates.systemPrompt !== undefined) {
      updateFields.push("system_prompt = $" + (updateValues.length + 1));
      updateValues.push(updates.systemPrompt);
    }
    if (updates.suggestedRole !== undefined) {
      updateFields.push("suggested_role = $" + (updateValues.length + 1));
      updateValues.push(updates.suggestedRole);
    }
    if (updates.tags !== undefined) {
      updateFields.push("tags = $" + (updateValues.length + 1));
      updateValues.push(updates.tags);
    }
    if (updates.isPublic !== undefined) {
      updateFields.push("is_public = $" + (updateValues.length + 1));
      updateValues.push(updates.isPublic);
    }

    if (updateFields.length === 0) {
      throw APIError.invalidArgument("no fields to update");
    }

    updateFields.push("updated_at = NOW()");
    updateValues.push(personaId);

    const query = `
      UPDATE custom_personas
      SET ${updateFields.join(", ")}
      WHERE id = $${updateValues.length}
    `;

    await db.rawExec(query, ...updateValues);

    const updatedPersona = await db.queryRow<CustomPersona>`
      SELECT id, user_id as "userId", name, description, system_prompt as "systemPrompt",
             suggested_role as "suggestedRole", tags, is_public as "isPublic",
             usage_count as "usageCount", created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_personas
      WHERE id = ${personaId}
    `;

    if (!updatedPersona) {
      throw APIError.internal("failed to update persona");
    }

    return updatedPersona;
  }
);

// Deletes a persona (only owner can delete)
export const deletePersona = api<{ personaId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/multiagent/personas/:personaId" },
  async ({ personaId }) => {
    const auth = getAuthData()!;

    // Verify ownership
    const persona = await db.queryRow`
      SELECT id FROM custom_personas
      WHERE id = ${personaId} AND user_id = ${auth.userID}
    `;

    if (!persona) {
      throw APIError.notFound("persona not found or not authorized");
    }

    // Check if persona is being used by any agents
    const usedByAgents = await db.queryRow`
      SELECT COUNT(*) as count FROM agents WHERE persona_id = ${personaId}
    `;

    if (usedByAgents && usedByAgents.count > 0) {
      throw APIError.invalidArgument("cannot delete persona that is being used by agents");
    }

    await db.exec`
      DELETE FROM custom_personas WHERE id = ${personaId}
    `;

    return { success: true };
  }
);

// Applies a persona to an agent
export const applyPersonaToAgent = api<{ agentId: string; personaId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/agents/:agentId/apply-persona" },
  async ({ agentId, personaId }) => {
    const auth = getAuthData()!;

    // Verify agent ownership
    const agent = await db.queryRow`
      SELECT a.id, a.team_id
      FROM agents a
      JOIN agent_teams t ON a.team_id = t.id
      WHERE a.id = ${agentId} AND t.user_id = ${auth.userID}
    `;

    if (!agent) {
      throw APIError.notFound("agent not found");
    }

    // Verify persona access (own or public)
    const persona = await db.queryRow<CustomPersona>`
      SELECT id, system_prompt as "systemPrompt", suggested_role as "suggestedRole"
      FROM custom_personas
      WHERE id = ${personaId} AND (user_id = ${auth.userID} OR is_public = true)
    `;

    if (!persona) {
      throw APIError.notFound("persona not found");
    }

    // Update agent with persona
    await db.exec`
      UPDATE agents
      SET persona_id = ${personaId}, 
          system_prompt = ${persona.systemPrompt},
          updated_at = NOW()
      WHERE id = ${agentId}
    `;

    // Increment persona usage count
    await db.exec`
      UPDATE custom_personas
      SET usage_count = usage_count + 1, updated_at = NOW()
      WHERE id = ${personaId}
    `;

    return { success: true };
  }
);

// Removes persona from an agent (reverts to default)
export const removePersonaFromAgent = api<{ agentId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "DELETE", path: "/multiagent/agents/:agentId/persona" },
  async ({ agentId }) => {
    const auth = getAuthData()!;

    // Verify agent ownership
    const agent = await db.queryRow`
      SELECT a.id, a.role
      FROM agents a
      JOIN agent_teams t ON a.team_id = t.id
      WHERE a.id = ${agentId} AND t.user_id = ${auth.userID}
    `;

    if (!agent) {
      throw APIError.notFound("agent not found");
    }

    // Get default system prompt for the agent's role
    const defaultPrompt = getDefaultSystemPrompt(agent.role);

    // Update agent to remove persona and revert to default prompt
    await db.exec`
      UPDATE agents
      SET persona_id = NULL, 
          system_prompt = ${defaultPrompt},
          updated_at = NOW()
      WHERE id = ${agentId}
    `;

    return { success: true };
  }
);

// Gets popular public personas
export const getPopularPersonas = api<{ limit?: number }, { personas: CustomPersona[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/personas/popular" },
  async (req) => {
    const limit = req.limit || 10;

    const personas = await db.queryAll<CustomPersona>`
      SELECT id, user_id as "userId", name, description, system_prompt as "systemPrompt",
             suggested_role as "suggestedRole", tags, is_public as "isPublic",
             usage_count as "usageCount", created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_personas
      WHERE is_public = true
      ORDER BY usage_count DESC, created_at DESC
      LIMIT ${limit}
    `;

    return { personas };
  }
);

// Searches personas by tags or keywords
export const searchPersonas = api<{ query: string; tags?: string[] }, { personas: CustomPersona[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/personas/search" },
  async (req) => {
    const auth = getAuthData()!;

    let query = `
      SELECT id, user_id as "userId", name, description, system_prompt as "systemPrompt",
             suggested_role as "suggestedRole", tags, is_public as "isPublic",
             usage_count as "usageCount", created_at as "createdAt", updated_at as "updatedAt"
      FROM custom_personas
      WHERE (user_id = $1 OR is_public = true)
        AND (name ILIKE $2 OR description ILIKE $2)
    `;

    const params: any[] = [auth.userID, `%${req.query}%`];

    if (req.tags && req.tags.length > 0) {
      query += ` AND tags && $${params.length + 1}`;
      params.push(req.tags);
    }

    query += ` ORDER BY usage_count DESC, created_at DESC`;

    const personas = await db.rawQueryAll<CustomPersona>(query, ...params);

    return { personas };
  }
);

// Helper function to get default system prompts (copied from agents.ts)
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