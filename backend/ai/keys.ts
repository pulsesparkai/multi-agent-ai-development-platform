import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { secret } from "encore.dev/config";
import db from "../db";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const encryptionKey = secret("EncryptionKey");

export interface SetAPIKeyRequest {
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  apiKey: string;
}

export interface APIKeyInfo {
  id: string;
  provider: string;
  hasKey: boolean;
  createdAt: Date;
}

export interface ListAPIKeysResponse {
  apiKeys: APIKeyInfo[];
}

// Sets an API key for a specific provider
export const setKey = api<SetAPIKeyRequest, { success: boolean }>(
  { auth: true, expose: true, method: "POST", path: "/ai/keys" },
  async (req) => {
    const auth = getAuthData()!;

    // Encrypt the API key
    const encryptedKey = encryptApiKey(req.apiKey);

    await db.exec`
      INSERT INTO api_keys (id, user_id, provider, encrypted_key)
      VALUES (${uuidv4()}, ${auth.userID}, ${req.provider}, ${encryptedKey})
      ON CONFLICT (user_id, provider) DO UPDATE SET
        encrypted_key = EXCLUDED.encrypted_key,
        updated_at = NOW()
    `;

    return { success: true };
  }
);

// Lists all API key providers for the user (without exposing the keys)
export const listKeys = api<void, ListAPIKeysResponse>(
  { auth: true, expose: true, method: "GET", path: "/ai/keys" },
  async () => {
    const auth = getAuthData()!;

    const keys = await db.queryAll<APIKeyInfo>`
      SELECT id, provider, true as "hasKey", created_at as "createdAt"
      FROM api_keys
      WHERE user_id = ${auth.userID}
      ORDER BY provider
    `;

    return { apiKeys: keys };
  }
);

// Helper function to get encryption key with fallback
function getEncryptionKey(): string {
  try {
    return encryptionKey();
  } catch (error) {
    // Fallback for development - use a default key
    console.warn('EncryptionKey secret not configured, using development fallback');
    return 'dev-fallback-key-32-chars-long!!!';
  }
}

// Helper function to encrypt API keys
function encryptApiKey(key: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(getEncryptionKey(), 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw error;
  }
}

// Helper function to decrypt API keys
export function decryptApiKey(encryptedKey: string): string {
  try {
    const parts = encryptedKey.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const keyBuffer = crypto.scryptSync(getEncryptionKey(), 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw error;
  }
}

// Internal function to get decrypted API key for a user and provider
export async function getUserApiKey(userId: string, provider: string): Promise<string | null> {
  try {
    const result = await db.queryRow<{ encrypted_key: string }>`
      SELECT encrypted_key
      FROM api_keys
      WHERE user_id = ${userId} AND provider = ${provider}
    `;

    if (!result) {
      return null;
    }

    return decryptApiKey(result.encrypted_key);
  } catch (error) {
    console.error('Failed to get user API key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      provider,
    });
    return null;
  }
}
