import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { getUserApiKey, decryptApiKey } from "./keys";

export interface DebugResponse {
  user: {
    id: string;
    authenticated: boolean;
    existsInDB: boolean;
  };
  projects: {
    count: number;
    list: Array<{ id: string; name: string; language: string }>;
  };
  apiKeys: {
    provider: string;
    hasKey: boolean;
    keyPreview?: string;
    lastUpdated?: Date;
    isActive?: boolean;
    validatedAt?: Date;
    lastError?: string;
    error?: string;
  }[];
  database: {
    connected: boolean;
    tablesExist: boolean;
  };
  errors: string[];
}

export const debug = api<void, DebugResponse>(
  { auth: true, expose: true, method: "GET", path: "/ai/debug" },
  async () => {
    const errors: string[] = [];
    const auth = getAuthData();
    
    if (!auth) {
      errors.push("No authentication data available");
      return {
        user: { id: 'unknown', authenticated: false, existsInDB: false },
        projects: { count: 0, list: [] },
        apiKeys: [],
        database: { connected: false, tablesExist: false },
        errors
      };
    }

    // Check if user exists in database
    let userExistsInDB = false;
    try {
      const userRecord = await db.queryRow`
        SELECT id FROM users WHERE id = ${auth.userID}
      `;
      userExistsInDB = !!userRecord;
    } catch (error) {
      errors.push(`User lookup error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Check database connection
    let dbConnected = false;
    let tablesExist = false;
    
    try {
      await db.queryRow`SELECT 1`;
      dbConnected = true;
      
      // Check if api_keys table exists
      const tableCheck = await db.queryRow`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'api_keys'
        ) as exists
      `;
      tablesExist = tableCheck?.exists || false;
    } catch (error) {
      errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Get user's projects
    let projects = { count: 0, list: [] as Array<{ id: string; name: string; language: string }> };
    try {
      const userProjects = await db.queryAll<{ id: string; name: string; language: string }>`
        SELECT id, name, language FROM projects
        WHERE user_id = ${auth.userID}
        ORDER BY updated_at DESC
      `;
      projects = {
        count: userProjects.length,
        list: userProjects
      };
    } catch (error) {
      errors.push(`Projects lookup error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Check API keys
    const apiKeys: { provider: string; hasKey: boolean; keyPreview?: string; lastUpdated?: Date; isActive?: boolean; validatedAt?: Date; lastError?: string; error?: string }[] = [];
    const providers = ['anthropic', 'openai', 'google', 'xai'];
    
    for (const provider of providers) {
      try {
        const keyInfo = await db.queryRow<{ 
          encrypted_key: string; 
          is_active: boolean;
          validated_at: Date;
          last_error: string;
        }>`
          SELECT encrypted_key, is_active, validated_at, last_error
          FROM api_keys
          WHERE user_id = ${auth.userID} AND provider = ${provider}
        `;
        
        if (keyInfo) {
          const key = decryptApiKey(keyInfo.encrypted_key);
          apiKeys.push({
            provider,
            hasKey: true,
            keyPreview: `${key.substring(0, 8)}...${key.substring(key.length - 4)}`,
            isActive: keyInfo.is_active,
            validatedAt: keyInfo.validated_at,
            lastError: keyInfo.last_error
          });
        } else {
          apiKeys.push({
            provider,
            hasKey: false
          });
        }
      } catch (error) {
        apiKeys.push({
          provider,
          hasKey: false,
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    }

    return {
      user: {
        id: auth.userID,
        authenticated: true,
        existsInDB: userExistsInDB
      },
      projects,
      apiKeys,
      database: {
        connected: dbConnected,
        tablesExist
      },
      errors
    };
  }
);