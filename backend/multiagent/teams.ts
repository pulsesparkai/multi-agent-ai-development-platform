import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
// import { v4 as uuidv4 } from "uuid";
import { CreateTeamRequest, AgentTeam, Agent } from "./types";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Creates a new agent team
export const createTeam = api<CreateTeamRequest, AgentTeam>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/teams" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify project exists if projectId is provided
    if (req.projectId) {
      const project = await db.queryRow`
        SELECT id FROM projects
        WHERE id = ${req.projectId} AND user_id = ${auth.userID}
      `;
      if (!project) {
        throw APIError.notFound("project not found");
      }
    }

    const teamId = generateId();
    
    await db.exec`
      INSERT INTO agent_teams (id, user_id, project_id, name, description, budget_limit)
      VALUES (${teamId}, ${auth.userID}, ${req.projectId || null}, ${req.name}, ${req.description || null}, ${req.budgetLimit || 10.00})
    `;

    // Create default agent set
    await createDefaultAgents(teamId);

    const team = await db.queryRow<AgentTeam>`
      SELECT id, user_id as "userId", project_id as "projectId", name, description, 
             is_active as "isActive", budget_limit as "budgetLimit", budget_used as "budgetUsed",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM agent_teams
      WHERE id = ${teamId}
    `;

    if (!team) {
      throw APIError.internal("failed to create team");
    }

    return team;
  }
);

// Gets all teams for a user
export const listTeams = api<{ projectId?: string }, { teams: AgentTeam[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/teams" },
  async (req) => {
    const auth = getAuthData()!;

    const whereClause = req.projectId ? 
      `WHERE user_id = ${auth.userID} AND project_id = ${req.projectId}` :
      `WHERE user_id = ${auth.userID}`;

    let query: string;
    let params: any[];
    
    if (req.projectId) {
      query = `
        SELECT id, user_id as "userId", project_id as "projectId", name, description,
               is_active as "isActive", budget_limit as "budgetLimit", budget_used as "budgetUsed",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM agent_teams
        WHERE user_id = $1 AND project_id = $2
        ORDER BY created_at DESC
      `;
      params = [auth.userID, req.projectId];
    } else {
      query = `
        SELECT id, user_id as "userId", project_id as "projectId", name, description,
               is_active as "isActive", budget_limit as "budgetLimit", budget_used as "budgetUsed",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM agent_teams
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      params = [auth.userID];
    }

    const teams = await db.rawQueryAll<AgentTeam>(query, ...params);

    return { teams };
  }
);

// Gets a specific team with its agents
export const getTeam = api<{ teamId: string }, AgentTeam>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/teams/:teamId" },
  async ({ teamId }) => {
    const auth = getAuthData()!;

    const team = await db.queryRow<AgentTeam>`
      SELECT id, user_id as "userId", project_id as "projectId", name, description,
             is_active as "isActive", budget_limit as "budgetLimit", budget_used as "budgetUsed",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    // Get agents for this team
    const agents = await db.queryAll<Agent>`
      SELECT id, team_id as "teamId", name, role, provider, model, system_prompt as "systemPrompt",
             execution_order as "executionOrder", is_enabled as "isEnabled",
             can_adapt_role as "canAdaptRole", available_roles as "availableRoles",
             current_role as "currentRole", persona_id as "personaId",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM agents
      WHERE team_id = ${teamId}
      ORDER BY execution_order
    `;

    team.agents = agents;
    return team;
  }
);

// Activates/deactivates a team
export const toggleTeam = api<{ teamId: string; active: boolean }, { success: boolean }>(
  { auth: true, expose: true, method: "PATCH", path: "/multiagent/teams/:teamId/toggle" },
  async ({ teamId, active }) => {
    const auth = getAuthData()!;

    // Verify ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    // If activating, deactivate other teams for this user
    if (active) {
      await db.exec`
        UPDATE agent_teams
        SET is_active = false
        WHERE user_id = ${auth.userID} AND id != ${teamId}
      `;
    }

    await db.exec`
      UPDATE agent_teams
      SET is_active = ${active}, updated_at = NOW()
      WHERE id = ${teamId}
    `;

    return { success: true };
  }
);

// Creates default agents for a new team
async function createDefaultAgents(teamId: string) {
  const defaultAgents = [
    {
      name: "Strategic Planner",
      role: "planner" as const,
      provider: "google" as const,
      model: "gemini-pro",
      systemPrompt: "You are a strategic planner agent responsible for breaking down user requests into actionable tasks. Analyze the requirements, identify dependencies, and create a structured plan with clear steps. Focus on understanding the big picture and creating comprehensive project roadmaps.",
      executionOrder: 1,
      canAdaptRole: true,
      availableRoles: ["planner", "coordinator"]
    },
    {
      name: "Code Generator",
      role: "coder" as const,
      provider: "anthropic" as const,
      model: "claude-3-5-sonnet-20241022",
      systemPrompt: "You are a code generation agent specialized in writing clean, efficient, and well-documented code. Follow best practices, implement proper error handling, and ensure code quality. Generate complete, functional implementations based on the provided specifications.",
      executionOrder: 2,
      canAdaptRole: true,
      availableRoles: ["coder", "reviewer", "tester"]
    },
    {
      name: "Quality Tester",
      role: "tester" as const,
      provider: "openai" as const,
      model: "gpt-4",
      systemPrompt: "You are a testing and debugging agent responsible for identifying issues, writing tests, and ensuring code quality. Review code for bugs, security vulnerabilities, and performance issues. Provide detailed feedback and suggest improvements.",
      executionOrder: 3,
      canAdaptRole: true,
      availableRoles: ["tester", "reviewer", "coder"]
    },
    {
      name: "Code Reviewer",
      role: "reviewer" as const,
      provider: "openai" as const,
      model: "gpt-4",
      systemPrompt: "You are a code review agent focused on ensuring code quality, maintainability, and adherence to best practices. Review implementations for design patterns, readability, and optimization opportunities. Provide constructive feedback and approve final implementations.",
      executionOrder: 4,
      canAdaptRole: true,
      availableRoles: ["reviewer", "coordinator", "tester"]
    },
    {
      name: "Team Coordinator",
      role: "coordinator" as const,
      provider: "xai" as const,
      model: "grok-beta",
      systemPrompt: "You are a coordination agent responsible for managing the workflow between other agents. Make decisions about iteration continuation, handle conflicts between agents, and ensure the team stays focused on the original goals. Synthesize outputs and make final decisions.",
      executionOrder: 5,
      canAdaptRole: true,
      availableRoles: ["coordinator", "planner", "reviewer"]
    }
  ];

  for (const agent of defaultAgents) {
    await db.exec`
      INSERT INTO agents (id, team_id, name, role, provider, model, system_prompt, execution_order, can_adapt_role, available_roles, current_role)
      VALUES (${generateId()}, ${teamId}, ${agent.name}, ${agent.role}, ${agent.provider}, ${agent.model}, ${agent.systemPrompt}, ${agent.executionOrder}, 
              ${agent.canAdaptRole}, ${agent.availableRoles}, ${agent.role})
    `;
  }
}