import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

export interface RateLimit {
  userId: string;
  endpoint: string;
  requests: number;
  windowStart: Date;
  windowSizeMinutes: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface BudgetLimit {
  userId: string;
  category: "tokens" | "api_calls" | "storage" | "deployments";
  used: number;
  limit: number;
  resetPeriod: "daily" | "weekly" | "monthly";
  lastReset: Date;
}

const RATE_LIMITS = {
  "/ai/chat": { maxRequests: 100, windowMinutes: 60 },
  "/deployment/deploy": { maxRequests: 10, windowMinutes: 60 },
  "/multiagent/execute": { maxRequests: 50, windowMinutes: 60 },
  "/tools/execute": { maxRequests: 200, windowMinutes: 60 }
};

export const checkRateLimit = api(
  { method: "POST", path: "/security/ratelimit/check", expose: true, auth: true },
  async ({ endpoint }: { endpoint: string }): Promise<RateLimitResult> => {
    const user = getAuthData()!;
    
    const limit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS];
    if (!limit) {
      return {
        allowed: true,
        remaining: 1000,
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      };
    }
    
    // Get current usage from database
    // This would query the rate limit storage
    
    const now = new Date();
    const windowStart = new Date(now.getTime() - (limit.windowMinutes * 60 * 1000));
    
    // For now, simulate rate limiting
    const currentRequests = 0; // Would be fetched from database
    
    if (currentRequests >= limit.maxRequests) {
      const resetTime = new Date(windowStart.getTime() + (limit.windowMinutes * 60 * 1000));
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime.getTime() - now.getTime()) / 1000)
      };
    }
    
    // Record the request
    // This would increment the counter in the database
    
    return {
      allowed: true,
      remaining: limit.maxRequests - currentRequests - 1,
      resetTime: new Date(windowStart.getTime() + (limit.windowMinutes * 60 * 1000))
    };
  }
);

export const checkBudget = api(
  { method: "POST", path: "/security/budget/check", expose: true, auth: true },
  async ({ category, amount }: { category: string; amount: number }): Promise<{ allowed: boolean; remaining: number }> => {
    const user = getAuthData()!;
    
    // Get user's budget limits from database
    // This would query the budget storage
    
    // For now, simulate budget checking
    const budget: BudgetLimit = {
      userId: user.userID,
      category: category as any,
      used: 0,
      limit: 10000,
      resetPeriod: "monthly",
      lastReset: new Date()
    };
    
    if (budget.used + amount > budget.limit) {
      return {
        allowed: false,
        remaining: Math.max(0, budget.limit - budget.used)
      };
    }
    
    return {
      allowed: true,
      remaining: budget.limit - budget.used - amount
    };
  }
);

export const setBudgetLimit = api(
  { method: "POST", path: "/security/budget/set", expose: true, auth: true },
  async ({ category, limit, resetPeriod }: { 
    category: string; 
    limit: number; 
    resetPeriod: "daily" | "weekly" | "monthly" 
  }): Promise<{ success: boolean }> => {
    const user = getAuthData()!;
    
    try {
      // Store budget limit in database
      // This would use the database service
      
      return { success: true };
    } catch (error) {
      console.error("Failed to set budget limit:", error);
      return { success: false };
    }
  }
);

export interface BudgetStatusResponse {
  limits: BudgetLimit[];
}

export const getBudgetStatus = api(
  { method: "GET", path: "/security/budget/status", expose: true, auth: true },
  async (): Promise<BudgetStatusResponse> => {
    const user = getAuthData()!;
    
    // Get all budget limits for the user
    // This would query the database
    
    // For now, return default limits
    return {
      limits: [
        {
          userId: user.userID,
          category: "tokens",
          used: 1500,
          limit: 10000,
          resetPeriod: "monthly",
          lastReset: new Date()
        },
        {
          userId: user.userID,
          category: "api_calls",
          used: 45,
          limit: 1000,
          resetPeriod: "daily",
          lastReset: new Date()
        }
      ]
    };
  }
);