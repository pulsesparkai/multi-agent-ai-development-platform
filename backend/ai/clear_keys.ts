import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface ClearKeysResponse {
  success: boolean;
  clearedCount: number;
}

// Clear all API keys for the current user (for debugging/recovery)
export const clearAllKeys = api<void, ClearKeysResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/ai/keys/clear" },
  async () => {
    const auth = getAuthData()!;
    
    // First count how many we have
    const countResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM api_keys WHERE user_id = ${auth.userID}
    `;
    
    // Then delete them
    await db.exec`
      DELETE FROM api_keys
      WHERE user_id = ${auth.userID}
    `;
    
    return {
      success: true,
      clearedCount: countResult?.count || 0,
    };
  }
);