import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { secret } from "encore.dev/config";
import db from "../db";
import crypto from "crypto";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const encryptionKey = secret("EncryptionKey");

export interface SetAPIKeyRequest {
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  apiKey: string;
}

// Add these validation functions
function validateAPIKeyFormat(provider: string, apiKey: string): { valid: boolean; error?: string } {
  // Remove any whitespace
  const trimmedKey = apiKey.trim();
  
  const patterns: Record<string, RegExp> = {
    anthropic: /^sk-ant-api\d{2}-[\w-]{48,}$/,
    openai: /^sk-[A-Za-z0-9]{48,}$/,
    google: /^AIza[0-9A-Za-z\-_]{35}$/,
    xai: /^xai-[\w-]{48,}$/
  };
  
  if (patterns[provider] && !patterns[provider].test(trimmedKey)) {
    return { 
      valid: false, 
      error: `Invalid ${provider} API key format`
    };
  }
  
  return { valid: true };
}

async function testAPIKeyConnectivity(provider: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  const testPrompt = "Say 'ok' in one word";
  
  try {
    switch(provider) {
      case 'anthropic':
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: testPrompt }]
          })
        });
        
        if (!anthropicResponse.ok) {
          const error = await anthropicResponse.json();
          return { 
            success: false, 
            error: (error as any).error?.message || `HTTP ${anthropicResponse.status}` 
          };
        }
        return { success: true };
        
      case 'openai':
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 10
          })
        });
        
        if (!openaiResponse.ok) {
          const error = await openaiResponse.json();
          return { 
            success: false, 
            error: (error as any).error?.message || `HTTP ${openaiResponse.status}` 
          };
        }
        return { success: true };
        
      case 'google':
        const googleResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testPrompt }] }]
            })
          }
        );
        
        if (!googleResponse.ok) {
          return { 
            success: false, 
            error: `HTTP ${googleResponse.status}` 
          };
        }
        return { success: true };
        
      case 'xai':
        const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [{ role: 'user', content: testPrompt }],
            max_tokens: 10
          })
        });
        
        if (!xaiResponse.ok) {
          return { 
            success: false, 
            error: `HTTP ${xaiResponse.status}` 
          };
        }
        return { success: true };
        
      default:
        return { success: true };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
}

export interface APIKeyInfo {
  id: string;
  provider: string;
  hasKey: boolean;
  createdAt: Date;
  isActive?: boolean;
  validatedAt?: Date;
  lastError?: string;
}

export interface ListAPIKeysResponse {
  apiKeys: APIKeyInfo[];
}

// Updated setKey function with validation
export const setKey = api<SetAPIKeyRequest, { success: boolean; message?: string }>(
  { auth: true, expose: true, method: "POST", path: "/ai/keys" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Step 1: Format validation
    const formatCheck = validateAPIKeyFormat(req.provider, req.apiKey);
    if (!formatCheck.valid) {
      throw APIError.invalidArgument(formatCheck.error!);
    }
    
    // Step 2: Test connectivity
    console.log(`Testing ${req.provider} API key connectivity...`);
    const connectivityTest = await testAPIKeyConnectivity(req.provider, req.apiKey);
    
    if (!connectivityTest.success) {
      // Store the key but mark it as inactive
      const encryptedKey = encryptApiKey(req.apiKey);
      
      await db.exec`
        INSERT INTO api_keys (id, user_id, provider, encrypted_key, is_active, last_error)
        VALUES (${generateId()}, ${auth.userID}, ${req.provider}, ${encryptedKey}, false, ${connectivityTest.error})
        ON CONFLICT (user_id, provider) DO UPDATE SET
          encrypted_key = EXCLUDED.encrypted_key,
          is_active = false,
          last_error = ${connectivityTest.error},
          updated_at = NOW()
      `;
      
      throw APIError.invalidArgument(`API key validation failed: ${connectivityTest.error}`);
    }
    
    // Step 3: Store validated key
    const encryptedKey = encryptApiKey(req.apiKey);
    
    await db.exec`
      INSERT INTO api_keys (id, user_id, provider, encrypted_key, is_active, validated_at)
      VALUES (${generateId()}, ${auth.userID}, ${req.provider}, ${encryptedKey}, true, NOW())
      ON CONFLICT (user_id, provider) DO UPDATE SET
        encrypted_key = EXCLUDED.encrypted_key,
        is_active = true,
        validated_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
    `;
    
    console.log(`Successfully validated and stored ${req.provider} API key for user ${auth.userID}`);
    
    return { 
      success: true,
      message: `${req.provider} API key validated and saved`
    };
  }
);

// Lists all API key providers for the user (without exposing the keys)
export const listKeys = api<void, ListAPIKeysResponse>(
  { auth: true, expose: true, method: "GET", path: "/ai/keys" },
  async () => {
    const auth = getAuthData()!;

    const keys = await db.queryAll<APIKeyInfo>`
      SELECT id, provider, true as "hasKey", created_at as "createdAt", 
             is_active as "isActive", validated_at as "validatedAt", last_error as "lastError"
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
    const key = encryptionKey();
    if (!key || key.length < 32) {
      throw new Error('EncryptionKey secret is too short or empty');
    }
    return key;
  } catch (error) {
    // Fallback for development - use a default key
    console.warn('EncryptionKey secret not configured or invalid, using development fallback. Error:', error instanceof Error ? error.message : 'Unknown');
    return 'dev-fallback-key-32-chars-long!!!';
  }
}

// Helper function to encrypt API keys
export function encryptApiKey(key: string): string {
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
    console.log('Looking for API key:', { userId, provider });
    
    const result = await db.queryRow<{ 
      encrypted_key: string;
      is_active?: boolean;
    }>`
      SELECT encrypted_key, is_active
      FROM api_keys
      WHERE user_id = ${userId} AND provider = ${provider}
    `;

    console.log('Database query result:', { 
      hasResult: !!result, 
      provider,
      isActive: result?.is_active
    });

    if (!result) {
      console.log('No API key found for user and provider');
      return null;
    }

    // Check if the API key is marked as inactive/invalid
    if (result.is_active === false) {
      console.log('API key exists but is marked as inactive/invalid');
      return null;  // Don't return invalid keys!
    }

    const decryptedKey = decryptApiKey(result.encrypted_key);
    console.log('Successfully decrypted ACTIVE API key for provider:', provider);
    return decryptedKey;
  } catch (error) {
    console.error('Failed to get user API key:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      provider,
    });
    return null;
  }
}

export const validateKey = api<{ provider: string }, { valid: boolean; error?: string }>(
  { auth: true, expose: true, method: "POST", path: "/ai/keys/validate" },
  async ({ provider }) => {
    const auth = getAuthData()!;
    
    const apiKey = await getUserApiKey(auth.userID, provider);
    if (!apiKey) {
      return { valid: false, error: "No API key found" };
    }
    
    const result = await testAPIKeyConnectivity(provider, apiKey);
    
    // Update validation status
    await db.exec`
      UPDATE api_keys 
      SET 
        last_validated = NOW(),
        is_active = ${result.success},
        last_error = ${result.error || null}
      WHERE user_id = ${auth.userID} AND provider = ${provider}
    `;
    
    return { valid: result.success, error: result.error };
  }
);
