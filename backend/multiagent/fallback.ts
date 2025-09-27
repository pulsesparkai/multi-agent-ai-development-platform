import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { getUserApiKey } from "../ai/keys";

interface FallbackRequest {
  sessionId: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  model?: string;
}

interface FallbackResponse {
  success: boolean;
  response: string;
  sessionId: string;
}

// Fallback to single-agent mode when multi-agent fails
export const fallbackToSingleAgent = api<FallbackRequest, FallbackResponse>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/fallback" },
  async (req) => {
    const auth = getAuthData()!;

    // Get session details and verify ownership
    const session = await db.queryRow<{
      id: string;
      initial_prompt: string;
      project_id: string;
      user_id: string;
      status: string;
    }>`
      SELECT s.id, s.initial_prompt, s.project_id, s.user_id, s.status
      FROM agent_sessions s
      JOIN agent_teams t ON s.team_id = t.id
      WHERE s.id = ${req.sessionId} AND t.user_id = ${auth.userID}
    `;

    if (!session) {
      throw APIError.notFound("session not found");
    }

    if (session.status === 'completed') {
      throw APIError.invalidArgument("session already completed");
    }

    // Get user's API key for the fallback provider
    const apiKey = await getUserApiKey(auth.userID, req.provider);
    if (!apiKey) {
      throw APIError.invalidArgument(`no API key found for provider: ${req.provider}`);
    }

    try {
      // Mark the multi-agent session as failed
      await db.exec`
        UPDATE agent_sessions
        SET status = 'failed', updated_at = NOW()
        WHERE id = ${req.sessionId}
      `;

      // Call single-agent API with the original prompt
      const response = await callSingleAgentAPI(
        req.provider,
        apiKey,
        session.initial_prompt,
        req.model || getDefaultModel(req.provider)
      );

      // Store the fallback response
      await storeFallbackResponse(req.sessionId, response, req.provider);

      return {
        success: true,
        response,
        sessionId: req.sessionId
      };

    } catch (error) {
      console.error('Fallback failed:', error);
      throw APIError.internal(`fallback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

// Get session status including fallback information
export const getSessionWithFallback = api<{ sessionId: string }, {
  session: any;
  fallbackResponse?: string;
  hasFallback: boolean;
}>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/fallback/:sessionId" },
  async ({ sessionId }) => {
    const auth = getAuthData()!;

    // Get session details
    const session = await db.queryRow`
      SELECT s.*
      FROM agent_sessions s
      JOIN agent_teams t ON s.team_id = t.id
      WHERE s.id = ${sessionId} AND t.user_id = ${auth.userID}
    `;

    if (!session) {
      throw APIError.notFound("session not found");
    }

    // Check for fallback response
    const fallback = await db.queryRow<{ response: string }>`
      SELECT response
      FROM session_fallbacks
      WHERE session_id = ${sessionId}
    `;

    return {
      session,
      fallbackResponse: fallback?.response,
      hasFallback: !!fallback
    };
  }
);

// Helper function to call single-agent API
async function callSingleAgentAPI(provider: string, apiKey: string, prompt: string, model: string): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful AI assistant. The user\'s request was originally intended for a multi-agent system, but we\'re providing a single-agent response as a fallback. Please provide a comprehensive and helpful response.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  switch (provider) {
    case 'openai':
      return await callOpenAI(apiKey, messages, model);
    case 'anthropic':
      return await callAnthropic(apiKey, messages, model);
    case 'google':
      return await callGoogle(apiKey, messages, model);
    case 'xai':
      return await callXAI(apiKey, messages, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Store fallback response in database
async function storeFallbackResponse(sessionId: string, response: string, provider: string) {
  await db.exec`
    INSERT INTO session_fallbacks (session_id, response, provider, created_at)
    VALUES (${sessionId}, ${response}, ${provider}, NOW())
    ON CONFLICT (session_id) DO UPDATE SET
      response = EXCLUDED.response,
      provider = EXCLUDED.provider,
      created_at = EXCLUDED.created_at
  `;
}

function getDefaultModel(provider: string): string {
  const defaults = {
    openai: 'gpt-4',
    anthropic: 'claude-opus-4-1-20250805',
    google: 'gemini-pro',
    xai: 'grok-beta'
  };
  return defaults[provider as keyof typeof defaults] || 'gpt-4';
}

// Simplified API calling functions (reusing from execution.ts)
async function callOpenAI(apiKey: string, messages: any[], model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || 'No response from AI';
}

async function callAnthropic(apiKey: string, messages: any[], model: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: messages.filter(m => m.role !== 'system').map(m => ({ 
        role: m.role, 
        content: m.content 
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return data.content[0]?.text || 'No response from AI';
}

async function callGoogle(apiKey: string, messages: any[], model: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Google AI API error: ${response.statusText}`);
  }

  const data = await response.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text || 'No response from AI';
}

async function callXAI(apiKey: string, messages: any[], model: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI API error: ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || 'No response from AI';
}