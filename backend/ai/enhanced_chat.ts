import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { getUserApiKey } from "./keys";
import { v4 as uuidv4 } from "uuid";
import { ChatMessage, ChatRequest, ChatResponse } from "./chat";

export interface EnhancedChatRequest extends ChatRequest {
  autoApply?: boolean; // Whether to automatically apply file changes
  autoBuild?: boolean; // Whether to automatically build after changes
  autoPreview?: boolean; // Whether to automatically start preview
}

export interface EnhancedChatResponse extends ChatResponse {
  filesChanged?: string[];
  buildStarted?: boolean;
  previewUrl?: string;
  errors?: string[];
}

// Enhanced chat that can apply file changes, build, and preview
export const enhancedChat = api<EnhancedChatRequest, EnhancedChatResponse>(
  { auth: true, expose: true, method: "POST", path: "/ai/enhanced-chat" },
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
        SELECT id, name FROM projects
        WHERE id = ${req.projectId} AND user_id = ${auth.userID}
      `;

      if (!project) {
        throw APIError.notFound("project not found");
      }

      // Get user's API key for the provider
      const apiKey = await getUserApiKey(auth.userID, req.provider);
      if (!apiKey) {
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
        sessionId = uuidv4();
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

      // Enhanced system prompt for code generation
      const enhancedSystemPrompt = `You are an expert web developer AI assistant. When users ask you to create websites, applications, or code:

1. ALWAYS generate complete, working files
2. Use modern best practices and frameworks (React, TypeScript, Tailwind CSS, etc.)
3. Provide ready-to-run code that doesn't require additional setup
4. When creating websites, include all necessary files (HTML, CSS, JS, package.json, etc.)

When responding with code changes, use this exact format for file operations:

<FILE_OPERATIONS>
[
  {
    "operation": "create",
    "path": "src/App.tsx",
    "content": "// Complete file content here"
  },
  {
    "operation": "create", 
    "path": "package.json",
    "content": "{\\"name\\": \\"my-app\\", ...}"
  }
]
</FILE_OPERATIONS>

Operations can be: create, update, delete
Always provide complete file contents, not just snippets.

Current project: ${project.name}`;

      // Add enhanced system prompt to messages
      const enhancedMessages: ChatMessage[] = [
        { role: 'system', content: enhancedSystemPrompt, timestamp: new Date() },
        ...messages
      ];

      // Get AI response
      const aiResponse = await callAI(req.provider, apiKey, enhancedMessages, req.model);
      
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

      const response: EnhancedChatResponse = {
        message: assistantMessage,
        sessionId,
        filesChanged: [],
        errors: []
      };

      // Parse and apply file operations if auto-apply is enabled
      if (req.autoApply) {
        const fileOperations = parseFileOperations(aiResponse);
        
        if (fileOperations.length > 0) {
          try {
            // Import workspace manager
            const { executeAIAction } = await import('../workspace/manager');
            
            const result = await executeAIAction({
              projectId: req.projectId,
              sessionId,
              action: 'generate_files',
              payload: {
                files: fileOperations.map(op => ({
                  path: op.path,
                  content: op.content || ''
                }))
              },
              source: 'ai_chat'
            });

            if (result.success) {
              response.filesChanged = result.changes?.map(c => c.filePath) || [];
            } else {
              response.errors?.push(result.error || 'Failed to apply file changes');
            }

            // Auto-build if requested and files were applied successfully
            if (req.autoBuild && result.success && fileOperations.length > 0) {
              try {
                const buildResult = await executeAIAction({
                  projectId: req.projectId,
                  sessionId,
                  action: 'build_project',
                  payload: {},
                  source: 'ai_chat'
                });

                response.buildStarted = buildResult.success;
                if (!buildResult.success) {
                  response.errors?.push(buildResult.error || 'Build failed');
                }
              } catch (buildError) {
                response.errors?.push(`Build error: ${buildError}`);
              }
            }

            // Auto-preview if requested and build was successful
            if (req.autoPreview && response.buildStarted && fileOperations.length > 0) {
              try {
                const previewResult = await executeAIAction({
                  projectId: req.projectId,
                  sessionId,
                  action: 'start_preview',
                  payload: { framework: 'react' },
                  source: 'ai_chat'
                });

                if (previewResult.success) {
                  response.previewUrl = previewResult.previewUrl;
                } else {
                  response.errors?.push(previewResult.error || 'Preview failed');
                }
              } catch (previewError) {
                response.errors?.push(`Preview error: ${previewError}`);
              }
            }

          } catch (workspaceError) {
            response.errors?.push(`Workspace error: ${workspaceError}`);
          }
        }
      }

      return response;

    } catch (error) {
      console.error('Enhanced chat API error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: getAuthData()?.userID,
        projectId: req?.projectId,
        provider: req?.provider,
      });
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal('Failed to process enhanced chat request', error as Error);
    }
  }
);

// Parse file operations from AI response
function parseFileOperations(response: string): { operation: string; path: string; content: string }[] {
  const operations: { operation: string; path: string; content: string }[] = [];
  
  // Look for FILE_OPERATIONS blocks
  const operationsRegex = /<FILE_OPERATIONS>\s*([\s\S]*?)\s*<\/FILE_OPERATIONS>/g;
  let match;
  
  while ((match = operationsRegex.exec(response)) !== null) {
    try {
      const operationsJson = JSON.parse(match[1]);
      
      if (Array.isArray(operationsJson)) {
        for (const op of operationsJson) {
          if (op.operation && op.path && typeof op.content === 'string') {
            operations.push({
              operation: op.operation,
              path: op.path,
              content: op.content
            });
          }
        }
      }
    } catch (parseError) {
      console.error('Failed to parse file operations:', parseError);
    }
  }
  
  return operations;
}

// AI calling function (simplified version from chat.ts)
async function callAI(provider: string, apiKey: string, messages: ChatMessage[], model?: string): Promise<string> {
  switch (provider) {
    case 'openai':
      return await callOpenAI(apiKey, messages, model || 'gpt-4');
    case 'anthropic':
      return await callAnthropic(apiKey, messages, model || 'claude-3-5-sonnet-20241022');
    case 'google':
      return await callGoogle(apiKey, messages, model || 'gemini-pro');
    case 'xai':
      return await callXAI(apiKey, messages, model || 'grok-beta');
    default:
      throw APIError.invalidArgument(`unsupported provider: ${provider}`);
  }
}

// AI provider implementations (reused from chat.ts)
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
      throw APIError.internal(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || 'No response from AI';
  } catch (error) {
    throw error instanceof APIError ? error : APIError.internal('Failed to call OpenAI API');
  }
}

async function callAnthropic(apiKey: string, messages: ChatMessage[], model: string): Promise<string> {
  try {
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const requestBody: any = {
      model,
      max_tokens: 4000,
      messages: userMessages.map(m => ({ 
        role: m.role, 
        content: m.content 
      })),
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw APIError.internal(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0]?.text || 'No response from AI';
  } catch (error) {
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