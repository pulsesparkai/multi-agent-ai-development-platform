import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { getUserApiKey } from "./keys";
import { ChatMessage, ChatRequest, ChatResponse, callAI } from "./chat";
import { wsManager } from "../realtime/websocket";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

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
      console.log('Enhanced chat request received:', { projectId: req.projectId, provider: req.provider, autoApply: req.autoApply });
      
      const auth = getAuthData();
      if (!auth) {
        throw APIError.unauthenticated("authentication required");
      }

      console.log('Auth data:', { userID: auth.userID, projectId: req.projectId });

      // Ensure user exists in database
      let user = await db.queryRow`
        SELECT id FROM users WHERE id = ${auth.userID}
      `;

      if (!user) {
        console.log('User not found, creating user record...');
        // Create user if doesn't exist
        await db.exec`
          INSERT INTO users (id, email, name)
          VALUES (${auth.userID}, ${auth.userID}@clerk.dev, 'User')
          ON CONFLICT (id) DO NOTHING
        `;
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
      console.log('Getting API key for provider:', req.provider);
      const apiKey = await getUserApiKey(auth.userID, req.provider);
      console.log('Retrieved API key:', { hasKey: !!apiKey, provider: req.provider });
      
      if (!apiKey) {
        console.error('No API key found:', { userID: auth.userID, provider: req.provider });
        throw APIError.unauthenticated(`Please configure your ${req.provider} API key in settings to use AI features`);
      }

      // Get or create chat session
      console.log('Getting or creating chat session...');
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
        console.log('Creating new chat session...');
        sessionId = generateId();
        await db.exec`
          INSERT INTO chat_sessions (id, project_id, user_id, messages)
          VALUES (${sessionId}, ${req.projectId}, ${auth.userID}, '[]'::jsonb)
        `;
      } else {
        console.log('Using existing session:', session.id);
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

      // Broadcast reasoning started
      console.log('Broadcasting reasoning...');
      try {
        await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Analyzing your request and planning implementation...', 'thinking');
      } catch (wsError) {
        console.warn('WebSocket broadcast failed:', wsError);
      }

      // Enhanced system prompt for code generation
      const enhancedSystemPrompt = `You are an expert web developer AI assistant. When users ask you to create websites, applications, or code, follow this EXACT response format:

1. FIRST: Acknowledge what the user asked for by repeating their request
2. SECOND: Say you'll begin working on it
3. THIRD: Include a "Thought process" section explaining your approach
4. FOURTH: Generate the code with organized, collapsible sections

Example response format:
"[User Request]"

I'll help you [restate what they asked]. Let me start working on this.

## Thought process

[Brief explanation of your approach and what you'll build]

## Implementation

I'll create the following files:

<details>
<summary>📄 src/App.tsx - Main component</summary>

\`\`\`tsx
[component code here]
\`\`\`

</details>

<details>
<summary>📦 package.json - Project configuration</summary>

\`\`\`json
[package.json content]
\`\`\`

</details>

CRITICAL: You MUST include file operations in your response. Use this exact JSON format at the end of your response:

\`\`\`json
{
  "files": [
    {
      "operation": "create",
      "path": "src/App.tsx",
      "content": "import React from 'react';\\n\\nfunction App() {\\n  return <div>Hello World</div>;\\n}\\n\\nexport default App;"
    },
    {
      "operation": "create", 
      "path": "package.json",
      "content": "{\\n  \\"name\\": \\"my-project\\",\\n  \\"version\\": \\"1.0.0\\",\\n  \\"type\\": \\"module\\",\\n  \\"scripts\\": {\\n    \\"dev\\": \\"vite\\",\\n    \\"build\\": \\"vite build\\",\\n    \\"preview\\": \\"vite preview\\"\\n  },\\n  \\"dependencies\\": {\\n    \\"react\\": \\"^18.2.0\\",\\n    \\"react-dom\\": \\"^18.2.0\\"\\n  },\\n  \\"devDependencies\\": {\\n    \\"@types/react\\": \\"^18.2.0\\",\\n    \\"@types/react-dom\\": \\"^18.2.0\\",\\n    \\"@vitejs/plugin-react\\": \\"^4.0.0\\",\\n    \\"typescript\\": \\"^5.0.0\\",\\n    \\"vite\\": \\"^4.4.0\\",\\n    \\"tailwindcss\\": \\"^3.3.0\\",\\n    \\"autoprefixer\\": \\"^10.4.0\\",\\n    \\"postcss\\": \\"^8.4.0\\"\\n  }\\n}"
    },
    {
      "operation": "create",
      "path": "index.html",
      "content": "<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n  <meta charset=\\"UTF-8\\">\\n  <meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1.0\\">\\n  <title>Vite + React + TS</title>\\n</head>\\n<body>\\n  <div id=\\"root\\"></div>\\n  <script type=\\"module\\" src=\\"/src/main.tsx\\"></script>\\n</body>\\n</html>"
    },
    {
      "operation": "create",
      "path": "src/main.tsx",
      "content": "import React from 'react'\\nimport ReactDOM from 'react-dom/client'\\nimport App from './App.tsx'\\nimport './index.css'\\n\\nReactDOM.createRoot(document.getElementById('root')!).render(\\n  <React.StrictMode>\\n    <App />\\n  </React.StrictMode>,\\n)"
    },
    {
      "operation": "create",
      "path": "src/index.css",
      "content": "@tailwind base;\\n@tailwind components;\\n@tailwind utilities;\\n\\nbody {\\n  margin: 0;\\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',\\n    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',\\n    sans-serif;\\n  -webkit-font-smoothing: antialiased;\\n  -moz-osx-font-smoothing: grayscale;\\n}"
    },
    {
      "operation": "create",
      "path": "vite.config.ts",
      "content": "import { defineConfig } from 'vite'\\nimport react from '@vitejs/plugin-react'\\n\\nexport default defineConfig({\\n  plugins: [react()],\\n  server: {\\n    host: '0.0.0.0',\\n    port: 3000,\\n    cors: true\\n  }\\n})"
    },
    {
      "operation": "create",
      "path": "tailwind.config.js",
      "content": "/** @type {import('tailwindcss').Config} */\\nexport default {\\n  content: [\\n    \\"./index.html\\",\\n    \\"./src/**/*.{js,ts,jsx,tsx}\\"\\n  ],\\n  theme: {\\n    extend: {},\\n  },\\n  plugins: [],\\n}"
    },
    {
      "operation": "create",
      "path": "postcss.config.js",
      "content": "export default {\\n  plugins: {\\n    tailwindcss: {},\\n    autoprefixer: {},\\n  },\\n}"
    }
  ]
}
\`\`\`

Operations can be: create, update, delete
Always provide complete file contents, not just snippets.
Include ALL necessary files for a working project (package.json, index.html, vite.config.ts, etc.).

Current project: ${project.name}`;

      // Add enhanced system prompt to messages
      const enhancedMessages: ChatMessage[] = [
        { role: 'system', content: enhancedSystemPrompt, timestamp: new Date() },
        ...messages
      ];

      // Broadcast AI thinking
      console.log('Broadcasting AI thinking...');
      try {
        await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Generating code and preparing files...', 'generating');
      } catch (wsError) {
        console.warn('WebSocket broadcast failed:', wsError);
      }

      // Get AI response with streaming if supported
      console.log('Calling AI with provider:', req.provider);
      
      let aiResponse: string;
      if (req.provider === 'anthropic') {
        // Use streaming for Anthropic
        aiResponse = await callAIStreaming(req.provider, apiKey, enhancedMessages, req.model, 
          (chunk: string) => {
            // Broadcast each chunk as reasoning
            wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', chunk, 'thinking').catch(console.warn);
          });
      } else {
        aiResponse = await callAI(req.provider, apiKey, enhancedMessages, req.model);
      }
      
      console.log('AI response received, length:', aiResponse.length);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };
      messages.push(assistantMessage);

      // Update session in database
      console.log('Updating session in database...');
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
        console.log('Auto-apply enabled, parsing file operations...');
        try {
          await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Parsing code and preparing to apply changes...', 'parsing');
        } catch (wsError) {
          console.warn('WebSocket broadcast failed:', wsError);
        }
        
        const fileOperations = parseFileOperations(aiResponse);
        console.log('Found file operations:', fileOperations.length);
        
        if (fileOperations.length > 0) {
          try {
            try {
              await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Found ${fileOperations.length} files to create. Applying changes...`, 'applying');
            } catch (wsError) {
              console.warn('WebSocket broadcast failed:', wsError);
            }
            
            // Import workspace manager
            console.log('Importing workspace manager...');
            const { executeAIAction } = await import('../workspace/manager');
            
            console.log('Executing AI action...');
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
              console.log('Files applied successfully:', response.filesChanged);
              try {
                await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Successfully created ${response.filesChanged.length} files!`, 'completed');
              } catch (wsError) {
                console.warn('WebSocket broadcast failed:', wsError);
              }
            } else {
              console.error('Failed to apply files:', result.error);
              response.errors?.push(result.error || 'Failed to apply file changes');
              try {
                await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Error applying files: ${result.error}`, 'error');
              } catch (wsError) {
                console.warn('WebSocket broadcast failed:', wsError);
              }
            }

            // Auto-build if requested and files were applied successfully
            if (req.autoBuild && result.success && fileOperations.length > 0) {
              try {
                wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Starting build process...', 'building');
                
                // Add small delay to ensure files are written to disk
                await new Promise(resolve => setTimeout(resolve, 1000));
                
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
                  wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Build failed: ${buildResult.error}`, 'error');
                } else {
                  wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Build completed successfully!', 'completed');
                }
              } catch (buildError) {
                response.errors?.push(`Build error: ${buildError}`);
                wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Build error: ${buildError}`, 'error');
              }
            }

            // Auto-preview if requested and build was successful
            if (req.autoPreview && response.buildStarted && fileOperations.length > 0) {
              try {
                wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Starting preview server...', 'previewing');
                
                // Add delay to ensure build is complete before starting preview
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const previewResult = await executeAIAction({
                  projectId: req.projectId,
                  sessionId,
                  action: 'start_preview',
                  payload: { framework: 'vite' }, // Default to vite for better compatibility
                  source: 'ai_chat'
                });

                if (previewResult.success) {
                  response.previewUrl = previewResult.previewUrl;
                  wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Preview ready at ${previewResult.previewUrl}`, 'completed');
                } else {
                  response.errors?.push(previewResult.error || 'Preview failed');
                  wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Preview failed: ${previewResult.error}`, 'error');
                }
              } catch (previewError) {
                response.errors?.push(`Preview error: ${previewError}`);
                wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', `Preview error: ${previewError}`, 'error');
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
  
  // Look for JSON code blocks with file operations
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = jsonBlockRegex.exec(response)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      
      if (jsonData.files && Array.isArray(jsonData.files)) {
        for (const file of jsonData.files) {
          if (file.operation && file.path && typeof file.content === 'string') {
            operations.push({
              operation: file.operation,
              path: file.path,
              content: file.content
            });
          }
        }
      }
    } catch (parseError) {
      console.error('Failed to parse JSON file operations:', parseError);
    }
  }
  
  // Fallback 1: Look for 📄 markdown format blocks
  if (operations.length === 0) {
    const fileBlockRegex = /📄\s+([^\s-]+)(?:\s*-[^`]*)?```(\w+)?\s*\n([\s\S]*?)\n```/g;
    let fileMatch;
    
    while ((fileMatch = fileBlockRegex.exec(response)) !== null) {
      const path = fileMatch[1];
      const content = fileMatch[3];
      
      if (path && content) {
        operations.push({
          operation: 'create',
          path: path,
          content: content
        });
      }
    }
  }

  // Fallback 2: Look for old FILE_OPERATIONS format
  if (operations.length === 0) {
    const operationsRegex = /<FILE_OPERATIONS>\s*([\s\S]*?)\s*<\/FILE_OPERATIONS>/g;
    let legacyMatch;
    
    while ((legacyMatch = operationsRegex.exec(response)) !== null) {
      try {
        const operationsJson = JSON.parse(legacyMatch[1]);
        
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
        console.error('Failed to parse legacy file operations:', parseError);
      }
    }
  }

  // Fallback 3: Look for any code blocks with file paths in comments
  if (operations.length === 0) {
    const genericBlockRegex = /(?:```(\w+)?\s*\n(?:\/\/ |# |\/\* )?([^\n]+)\n([\s\S]*?)\n```)/g;
    let genericMatch;
    
    while ((genericMatch = genericBlockRegex.exec(response)) !== null) {
      const language = genericMatch[1];
      const possiblePath = genericMatch[2];
      const content = genericMatch[3];
      
      // Check if the comment looks like a file path
      if (possiblePath && (possiblePath.includes('.') || possiblePath.includes('/'))) {
        const cleanPath = possiblePath.replace(/^(\/\/ |# |\/\* |\* )/, '').replace(/\s*\*\/$/, '').trim();
        
        if (cleanPath && content) {
          operations.push({
            operation: 'create',
            path: cleanPath,
            content: content
          });
        }
      }
    }
  }
  
  return operations;
}

// Streaming AI call function for live thinking display
async function callAIStreaming(
  provider: string, 
  apiKey: string, 
  messages: ChatMessage[], 
  model?: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  if (provider === 'anthropic') {
    return await callAnthropicStreaming(apiKey, messages, model || 'claude-3-5-sonnet-20241022', onChunk);
  } else {
    // Fallback to non-streaming for other providers
    return await callAI(provider, apiKey, messages, model);
  }
}

async function callAnthropicStreaming(
  apiKey: string, 
  messages: ChatMessage[], 
  model: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    const requestBody: any = {
      model,
      max_tokens: 4000,
      stream: true,
      messages: userMessages.map(m => ({ 
        role: m.role, 
        content: m.content 
      })),
    };

    // Add system message if present
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
      const errorText = await response.text();
      console.error('Anthropic API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    let fullResponse = '';
    let buffer = '';
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content_block_delta' && data.delta?.text) {
                const text = data.delta.text;
                fullResponse += text;
                
                // Send chunk for live display
                if (onChunk) {
                  onChunk(text);
                }
              }
            } catch (parseError) {
              // Ignore JSON parse errors for non-JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullResponse || 'No response from AI';
  } catch (error) {
    console.error('Anthropic streaming call failed:', error);
    throw error;
  }
}