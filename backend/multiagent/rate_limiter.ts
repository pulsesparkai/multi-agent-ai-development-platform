import db from "../db";

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxCostPerHour: number;
}

interface RateLimitStatus {
  isAllowed: boolean;
  reason?: string;
  resetTime?: Date;
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxRequestsPerMinute: 30,
  maxRequestsPerHour: 200,
  maxCostPerHour: 5.00,
};

// Check if user is within rate limits
export async function checkRateLimit(userId: string, estimatedCost: number = 0): Promise<RateLimitStatus> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    // Check requests per minute
    const requestsLastMinute = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM agent_messages
      WHERE agent_id IN (
        SELECT a.id FROM agents a
        JOIN agent_teams t ON a.team_id = t.id
        WHERE t.user_id = ${userId}
      )
      AND created_at >= ${oneMinuteAgo}
    `;

    if (requestsLastMinute && requestsLastMinute.count >= DEFAULT_RATE_LIMITS.maxRequestsPerMinute) {
      return {
        isAllowed: false,
        reason: 'Rate limit exceeded: too many requests per minute',
        resetTime: new Date(now.getTime() + 60 * 1000),
      };
    }

    // Check requests per hour
    const requestsLastHour = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM agent_messages
      WHERE agent_id IN (
        SELECT a.id FROM agents a
        JOIN agent_teams t ON a.team_id = t.id
        WHERE t.user_id = ${userId}
      )
      AND created_at >= ${oneHourAgo}
    `;

    if (requestsLastHour && requestsLastHour.count >= DEFAULT_RATE_LIMITS.maxRequestsPerHour) {
      return {
        isAllowed: false,
        reason: 'Rate limit exceeded: too many requests per hour',
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      };
    }

    // Check cost per hour
    const costLastHour = await db.queryRow<{ total_cost: number }>`
      SELECT COALESCE(SUM(cost), 0) as total_cost
      FROM agent_messages
      WHERE agent_id IN (
        SELECT a.id FROM agents a
        JOIN agent_teams t ON a.team_id = t.id
        WHERE t.user_id = ${userId}
      )
      AND created_at >= ${oneHourAgo}
    `;

    const currentHourlyCost = costLastHour?.total_cost || 0;
    if (currentHourlyCost + estimatedCost > DEFAULT_RATE_LIMITS.maxCostPerHour) {
      return {
        isAllowed: false,
        reason: `Rate limit exceeded: hourly cost limit ($${DEFAULT_RATE_LIMITS.maxCostPerHour})`,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      };
    }

    return { isAllowed: true };

  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Default to allowing the request if check fails
    return { isAllowed: true };
  }
}

// Check if team is within budget limits
export async function checkBudgetLimit(teamId: string, estimatedCost: number = 0): Promise<RateLimitStatus> {
  try {
    const team = await db.queryRow<{ budget_limit: number; budget_used: number }>`
      SELECT budget_limit, budget_used
      FROM agent_teams
      WHERE id = ${teamId}
    `;

    if (!team) {
      return {
        isAllowed: false,
        reason: 'Team not found',
      };
    }

    if (team.budget_used + estimatedCost > team.budget_limit) {
      return {
        isAllowed: false,
        reason: `Budget limit exceeded: $${team.budget_used.toFixed(2)} + $${estimatedCost.toFixed(2)} > $${team.budget_limit.toFixed(2)}`,
      };
    }

    return { isAllowed: true };

  } catch (error) {
    console.error('Budget limit check failed:', error);
    return {
      isAllowed: false,
      reason: 'Budget check failed',
    };
  }
}

// Log API usage for monitoring
export async function logAPIUsage(userId: string, provider: string, tokens: number, cost: number) {
  try {
    await db.exec`
      INSERT INTO api_usage_logs (user_id, provider, tokens, cost, created_at)
      VALUES (${userId}, ${provider}, ${tokens}, ${cost}, NOW())
      ON CONFLICT DO NOTHING
    `;
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}

// Get rate limit status for a user
export async function getRateLimitStatus(userId: string): Promise<{
  requestsPerMinute: number;
  requestsPerHour: number;
  costPerHour: number;
  limits: RateLimitConfig;
}> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    const [requestsLastMinute, requestsLastHour, costLastHour] = await Promise.all([
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM agent_messages
        WHERE agent_id IN (
          SELECT a.id FROM agents a
          JOIN agent_teams t ON a.team_id = t.id
          WHERE t.user_id = ${userId}
        )
        AND created_at >= ${oneMinuteAgo}
      `,
      db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM agent_messages
        WHERE agent_id IN (
          SELECT a.id FROM agents a
          JOIN agent_teams t ON a.team_id = t.id
          WHERE t.user_id = ${userId}
        )
        AND created_at >= ${oneHourAgo}
      `,
      db.queryRow<{ total_cost: number }>`
        SELECT COALESCE(SUM(cost), 0) as total_cost
        FROM agent_messages
        WHERE agent_id IN (
          SELECT a.id FROM agents a
          JOIN agent_teams t ON a.team_id = t.id
          WHERE t.user_id = ${userId}
        )
        AND created_at >= ${oneHourAgo}
      `,
    ]);

    return {
      requestsPerMinute: requestsLastMinute?.count || 0,
      requestsPerHour: requestsLastHour?.count || 0,
      costPerHour: costLastHour?.total_cost || 0,
      limits: DEFAULT_RATE_LIMITS,
    };

  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      requestsPerMinute: 0,
      requestsPerHour: 0,
      costPerHour: 0,
      limits: DEFAULT_RATE_LIMITS,
    };
  }
}