import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface BudgetInfo {
  teamId: string;
  teamName: string;
  budgetLimit: number;
  budgetUsed: number;
  budgetRemaining: number;
  utilizationPercent: number;
}

export interface UpdateBudgetRequest {
  teamId: string;
  budgetLimit: number;
}

export interface BudgetUsageEntry {
  sessionId: string;
  date: Date;
  cost: number;
  iterations: number;
  status: string;
}

// Gets budget information for a team
export const getBudget = api<{ teamId: string }, BudgetInfo>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/budget/:teamId" },
  async ({ teamId }) => {
    const auth = getAuthData()!;

    const team = await db.queryRow<{
      id: string;
      name: string;
      budget_limit: number;
      budget_used: number;
    }>`
      SELECT id, name, budget_limit, budget_used
      FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    const budgetRemaining = team.budget_limit - team.budget_used;
    const utilizationPercent = team.budget_limit > 0 ? (team.budget_used / team.budget_limit) * 100 : 0;

    return {
      teamId,
      teamName: team.name,
      budgetLimit: team.budget_limit,
      budgetUsed: team.budget_used,
      budgetRemaining,
      utilizationPercent
    };
  }
);

// Updates budget limit for a team
export const updateBudget = api<UpdateBudgetRequest, { success: boolean }>(
  { auth: true, expose: true, method: "PATCH", path: "/multiagent/budget" },
  async (req) => {
    const auth = getAuthData()!;

    if (req.budgetLimit < 0) {
      throw APIError.invalidArgument("budget limit must be non-negative");
    }

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${req.teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    await db.exec`
      UPDATE agent_teams
      SET budget_limit = ${req.budgetLimit}, updated_at = NOW()
      WHERE id = ${req.teamId}
    `;

    return { success: true };
  }
);

// Gets budget usage history for a team
export const getBudgetUsage = api<{ teamId: string; limit?: number }, { usage: BudgetUsageEntry[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/budget/:teamId/usage" },
  async ({ teamId, limit = 50 }) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    const usage = await db.queryAll<BudgetUsageEntry>`
      SELECT 
        id as "sessionId",
        created_at as "date",
        total_cost as "cost",
        current_iteration as "iterations",
        status
      FROM agent_sessions
      WHERE team_id = ${teamId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return { usage };
  }
);

// Resets budget usage for a team (admin function)
export const resetBudgetUsage = api<{ teamId: string }, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/budget/:teamId/reset" },
  async ({ teamId }) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    await db.exec`
      UPDATE agent_teams
      SET budget_used = 0.00, updated_at = NOW()
      WHERE id = ${teamId}
    `;

    return { success: true };
  }
);

// Gets budget overview for all teams of a user
export const getBudgetOverview = api<void, { teams: BudgetInfo[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/budget" },
  async () => {
    const auth = getAuthData()!;

    const teams = await db.queryAll<{
      id: string;
      name: string;
      budget_limit: number;
      budget_used: number;
    }>`
      SELECT id, name, budget_limit, budget_used
      FROM agent_teams
      WHERE user_id = ${auth.userID}
      ORDER BY name
    `;

    const budgetInfo: BudgetInfo[] = teams.map(team => {
      const budgetRemaining = team.budget_limit - team.budget_used;
      const utilizationPercent = team.budget_limit > 0 ? (team.budget_used / team.budget_limit) * 100 : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        budgetLimit: team.budget_limit,
        budgetUsed: team.budget_used,
        budgetRemaining,
        utilizationPercent
      };
    });

    return { teams: budgetInfo };
  }
);