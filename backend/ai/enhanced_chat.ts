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
    console.log('=== Enhanced Chat Request Start ===');
    console.log('Request details:', {
      projectId: req.projectId,
      provider: req.provider,
      messageLength: req.message?.length,
      autoApply: req.autoApply,
      autoBuild: req.autoBuild,
      autoPreview: req.autoPreview
    });
    
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
      
      // Limit message history to prevent API issues (keep last 10 messages)
      if (messages.length > 10) {
        console.log('Trimming message history from', messages.length, 'to 10 messages');
        messages = messages.slice(-10);
      }

      // Broadcast reasoning started
      console.log('Broadcasting reasoning...');
      try {
        await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Analyzing your request and planning implementation...', 'thinking');
      } catch (wsError) {
        console.warn('WebSocket broadcast failed:', wsError);
      }

      // Enhanced system prompt that works better with Claude
      const enhancedSystemPrompt = `You are a code generation assistant. When asked to create code or applications, you should generate complete, working code files.

IMPORTANT: At the end of your response, you MUST include a JSON code block with the following structure:

\`\`\`json
{
  "files": [
    {
      "operation": "create",
      "path": "path/to/file",
      "content": "file content here"
    }
  ]
}
\`\`\`

Make sure to:
1. Include ALL necessary files for a complete, working application
2. Use proper escaping for special characters in the content field (\\n for newlines, \\" for quotes)
3. Include package.json, index.html, and all source files
4. The JSON block MUST be valid JSON and appear at the very end of your response

Current project: ${project.name}`;

      // Create messages array with system prompt
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

      // Get AI response with timeout
      console.log('Calling AI with provider:', req.provider);
      console.log('Message count in history:', enhancedMessages.length);
      
      const aiResponse = await Promise.race([
        callAI(req.provider, apiKey, enhancedMessages, req.model),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AI call timeout after 60 seconds')), 60000)
        )
      ]);
      
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

      // Try to parse and apply file operations
      if (req.autoApply) {
        console.log('Auto-apply enabled, parsing file operations...');
        try {
          await wsManager.broadcastAgentReasoning(req.projectId, sessionId, 'AI Assistant', 'Parsing code and preparing to apply changes...', 'parsing');
        } catch (wsError) {
          console.warn('WebSocket broadcast failed:', wsError);
        }
        
        const fileOperations = parseFileOperationsImproved(aiResponse);
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
                  content: op.content
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
      } else {
        // Even if autoApply is false, try parsing to report errors
        try {
          const fileOperations = parseFileOperationsImproved(aiResponse);
          if (fileOperations.length === 0) {
            console.warn('No file operations found in AI response');
            response.errors?.push('Could not automatically apply files. Please check the response for code.');
          }
        } catch (parseError) {
          console.error('File parsing error:', parseError);
          response.errors?.push('Could not automatically apply files. Please check the response for code.');
        }
      }

      return response;

    } catch (error) {
      console.error('=== Enhanced Chat Error ===');
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: getAuthData()?.userID,
        projectId: req?.projectId,
        provider: req?.provider,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorCode: (error as any)?.code,
        errorStatus: (error as any)?.status
      });
      console.error('=== End Enhanced Chat Error ===');
      
      if (error instanceof APIError) {
        throw error;
      }
      
      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('Invalid model')) {
          throw APIError.invalidArgument(error.message);
        }
        if (error.message.includes('Authentication') || error.message.includes('Invalid API key')) {
          throw APIError.unauthenticated(error.message);
        }
        if (error.message.includes('Rate limit')) {
          throw APIError.resourceExhausted(error.message);
        }
      }
      
      throw APIError.internal('Failed to process enhanced chat request', error as Error);
    }
  }
);

// Improved parsing function
function parseFileOperationsImproved(response: string): { operation: string; path: string; content: string }[] {
  const operations: { operation: string; path: string; content: string }[] = [];
  
  // First, try to find the JSON block at the end of the response
  const lastJsonBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n```(?![\s\S]*```json)/);
  
  if (lastJsonBlockMatch) {
    try {
      const jsonData = JSON.parse(lastJsonBlockMatch[1]);
      
      if (jsonData.files && Array.isArray(jsonData.files)) {
        for (const file of jsonData.files) {
          if (file.operation && file.path && typeof file.content === 'string') {
            operations.push({
              operation: file.operation || 'create',
              path: file.path,
              content: file.content
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse JSON:', error);
    }
  }
  
  // If no JSON found, try to extract code blocks with file indicators
  if (operations.length === 0) {
    // Look for patterns like "// filename.ext" or "# filename.ext" followed by code
    const codeBlockRegex = /```(\w+)?\s*\n(?:\/\/|#|--)\s*([\w\/.]+\.\w+)[^\n]*\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      operations.push({
        operation: 'create',
        path: match[2],
        content: match[3].trim()
      });
    }
  }
  
  return operations;
}