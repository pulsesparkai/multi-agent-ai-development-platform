import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { getUserApiKey } from "./keys";
import { ChatMessage, callAI } from "./chat";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export interface SimpleTestRequest {
  projectId: string;
  message: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai';
  model?: string;
}

export interface SimpleTestResponse {
  success: boolean;
  message?: string;
  sessionId?: string;
  error?: string;
}

// Simple test endpoint to debug the core AI calling
export const testChat = api<SimpleTestRequest, SimpleTestResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/test-chat" },
  async (req) => {
    console.log('=== Test Chat Request ===');
    console.log('Request:', {
      projectId: req.projectId,
      provider: req.provider,
      messageLength: req.message?.length
    });

    try {
      const auth = getAuthData();
      if (!auth) {
        throw APIError.unauthenticated("authentication required");
      }

      // Get API key
      console.log('Getting API key...');
      const apiKey = await getUserApiKey(auth.userID, req.provider);
      if (!apiKey) {
        throw APIError.unauthenticated(`No API key found for ${req.provider}`);
      }
      console.log('API key found:', !!apiKey);

      // Simple message array
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond briefly.',
          timestamp: new Date()
        },
        {
          role: 'user',
          content: req.message,
          timestamp: new Date()
        }
      ];

      console.log('Calling AI...');
      const aiResponse = await callAI(req.provider, apiKey, messages, req.model);
      console.log('AI response received, length:', aiResponse?.length);

      return {
        success: true,
        message: aiResponse,
        sessionId: generateId()
      };

    } catch (error) {
      console.error('=== Test Chat Error ===');
      console.error('Error:', {
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);