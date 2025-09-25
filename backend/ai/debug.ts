import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { getUserApiKey } from "./keys";
import db from "../db";

export interface DebugAPIKeyResponse {
  hasKeys: boolean;
  providers: string[];
  canDecrypt: Record<string, boolean>;
  userId: string;
}

// Debug endpoint to check API key status
export const debugAPIKeys = api<void, DebugAPIKeyResponse>(
  { auth: true, expose: true, method: "GET", path: "/ai/debug-keys" },
  async () => {
    const auth = getAuthData()!;
    
    // Get all saved keys for this user
    const savedKeys = await db.queryAll<{ provider: string; encrypted_key: string }>`
      SELECT provider, encrypted_key
      FROM api_keys
      WHERE user_id = ${auth.userID}
    `;

    const result: DebugAPIKeyResponse = {
      hasKeys: savedKeys.length > 0,
      providers: savedKeys.map(k => k.provider),
      canDecrypt: {},
      userId: auth.userID,
    };

    // Test decryption for each key
    for (const key of savedKeys) {
      try {
        const decryptedKey = await getUserApiKey(auth.userID, key.provider);
        result.canDecrypt[key.provider] = !!decryptedKey;
      } catch (error) {
        result.canDecrypt[key.provider] = false;
      }
    }

    return result;
  }
);