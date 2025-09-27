import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { getUserApiKey } from "./keys";

// Import Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  projectId: string;
  message: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  model?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GetChatParams {
  projectId: string;
  sessionId: string;
}

// Sends a chat message to the AI
export const chat = api<ChatRequest, ChatResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/chat" },
  async (req) => {
    try {
      const auth = getAuthData();
      if (!auth) {
        throw APIError.unauthenticated("authentication required");
      }

      // Validate request
      if (!req.projectId || !req.message || !req.provider) {
        throw APIError.invalidArgument("missing required fields: projectId, message, provider");
      }

      // Verify user owns the project
      const project = await db.queryRow`
        SELECT id FROM projects
        WHERE id = ${req.projectId} AND user_id = ${auth.userID}
      `;

      if (!project) {
        throw APIError.notFound("project not found");
      }

      // Get user's API key for the provider
      console.log('Chat request - auth data:', { userID: auth.userID, provider: req.provider });
      const apiKey = await getUserApiKey(auth.userID, req.provider);
      console.log('Retrieved API key:', { hasKey: !!apiKey, provider: req.provider });
      
      if (!apiKey) {
        console.error('No API key found:', { userID: auth.userID, provider: req.provider });
        throw APIError.invalidArgument(`no API key found for provider: ${req.provider}`);
      }

    // Get or create chat session
    let session = await db.queryRow<{ id: string, messages: ChatMessage[] }>`
      SELECT id, messages
      FROM chat_sessions
      WHERE project_id = ${req.projectId} AND user_id = ${auth.userID}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    let sessionId: string;
    let messages: ChatMessage[] = [];

    if (!session) {
      sessionId = generateId();
      await db.exec`
        INSERT INTO chat_sessions (id, project_id, user_id, messages)
        VALUES (${sessionId}, ${req.projectId}, ${auth.userID}, '[]'::jsonb)
      `;
    } else {
      sessionId = session.id;
      messages = session.messages || [];
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: req.message,
      timestamp: new Date(),
    };
    messages.push(userMessage);

    // Get AI response
    const aiResponse = await callAI(req.provider, apiKey, messages, req.model);
    
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    };
    messages.push(assistantMessage);

    // Update session in database
    await db.exec`
      UPDATE chat_sessions
      SET messages = ${JSON.stringify(messages)}::jsonb, updated_at = NOW()
      WHERE id = ${sessionId}
    `;

      return {
        message: assistantMessage,
        sessionId,
      };
    } catch (error) {
      console.error('Chat API error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: getAuthData()?.userID,
        projectId: req?.projectId,
        provider: req?.provider,
      });
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal('Failed to process chat request', error as Error);
    }
  }
);

// Gets a chat session
export const getSession = api<GetChatParams, ChatSession>(
  { auth: true, expose: true, method: "GET", path: "/ai/chat/:projectId/:sessionId" },
  async (params) => {
    const auth = getAuthData()!;

    const session = await db.queryRow<ChatSession>`
      SELECT cs.id, cs.messages, cs.created_at as "createdAt", cs.updated_at as "updatedAt"
      FROM chat_sessions cs
      JOIN projects p ON cs.project_id = p.id
      WHERE cs.id = ${params.sessionId} 
        AND cs.project_id = ${params.projectId}
        AND p.user_id = ${auth.userID}
    `;

    if (!session) {
      throw APIError.notFound("chat session not found");
    }

    return session;
  }
);

// Helper function to call different AI providers
export async function callAI(provider: string, apiKey: string, messages: ChatMessage[], model?: string): Promise<string> {
  switch (provider) {
    case 'openai':
      return await callOpenAI(apiKey, messages, model || 'gpt-4');
    case 'anthropic':
      return await callAnthropic(apiKey, messages, model || 'claude-4-sonnet');
    case 'google':
      return await callGoogle(apiKey, messages, model || 'gemini-pro');
    case 'xai':
      return await callXAI(apiKey, messages, model || 'grok-beta');
    default:
      throw APIError.invalidArgument(`unsupported provider: ${provider}`);
  }
}

async function callOpenAI(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
  try {
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
      const errorText = await response.text();
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw APIError.internal(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || 'No response from AI';
  } catch (error) {
    console.error('OpenAI call failed:', error);
    throw error instanceof APIError ? error : APIError.internal('Failed to call OpenAI API');
  }
}

async function callAnthropic(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
  try {
    // Initialize Anthropic client with API key
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const modelToUse = model || 'claude-4-sonnet';

    console.log('Anthropic SDK request:', {
      model: modelToUse,
      messageCount: userMessages.length,
      hasSystem: !!systemMessage
    });

    // Use official Anthropic SDK
    const response = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 4000,
      system: systemMessage || undefined, // Only include system if exists
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
    });

    const result = response.content[0]?.type === 'text' ? response.content[0].text : 'No response from AI';
    
    console.log('Anthropic SDK success:', {
      model: modelToUse,
      responseLength: result.length,
      usage: response.usage
    });
    
    return result;
  } catch (error) {
    console.error('Anthropic SDK call failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      anthropicError: (error as any)?.status ? {
        status: (error as any).status,
        message: (error as any).message,
        type: (error as any).type
      } : undefined
    });

    // Handle Anthropic-specific errors
    if ((error as any)?.status) {
      const anthropicError = error as any;
      if (anthropicError.status === 400) {
        throw APIError.invalidArgument(`Anthropic API error: ${anthropicError.message}`);
      }
      if (anthropicError.status === 401) {
        throw APIError.unauthenticated(`Invalid Anthropic API key: ${anthropicError.message}`);
      }
      if (anthropicError.status === 429) {
        throw APIError.resourceExhausted(`Anthropic rate limit exceeded: ${anthropicError.message}`);
      }
      throw APIError.internal(`Anthropic API error (${anthropicError.status}): ${anthropicError.message}`);
    }
    
    throw error instanceof APIError ? error : APIError.internal('Failed to call Anthropic API');
  }
}

async function callGoogle(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
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
    throw APIError.internal(`Google AI API error: ${response.statusText}`);
  }

  const data = await response.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text || 'No response from AI';
}

async function callXAI(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
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
    throw APIError.internal(`xAI API error: ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || 'No response from AI';
}
