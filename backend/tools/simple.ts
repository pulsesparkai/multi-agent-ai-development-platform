import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { getUserApiKey } from "../ai/keys";
// import { v4 as uuidv4 } from "uuid";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export interface SimpleCodeGenRequest {
  prompt: string;
  provider?: string;
  model?: string;
}

export interface SimpleCodeGenResponse {
  sessionId: string;
  status: 'generating' | 'building' | 'completed' | 'failed';
  files?: { path: string; content: string }[];
  previewUrl?: string;
  error?: string;
  logs?: string[];
}

// Single-API website generation (like bolt.new, lovable.dev)
export const generateWebsite = api<SimpleCodeGenRequest, SimpleCodeGenResponse>(
  { auth: true, expose: true, method: "POST", path: "/simple/generate" },
  async (req) => {
    const auth = getAuthData()!;
    const sessionId = generateId();
    
    // Start generation in background
    generateWebsiteWorkflow(sessionId, req.prompt, auth.userID, req.provider || 'openai', req.model || 'gpt-4').catch(err => {
      console.error(`Website generation failed for session ${sessionId}:`, err);
    });

    return {
      sessionId,
      status: 'generating',
      logs: ['Starting website generation...']
    };
  }
);

// Get generation status
export const getGenerationStatus = api<{ sessionId: string }, SimpleCodeGenResponse>(
  { auth: true, expose: true, method: "GET", path: "/simple/status/:sessionId" },
  async ({ sessionId }) => {
    const auth = getAuthData()!;
    
    // Get session from memory/cache (simplified for demo)
    const session = getSessionFromMemory(sessionId);
    if (!session) {
      return {
        sessionId,
        status: 'failed',
        error: 'Session not found'
      };
    }

    return session;
  }
);

// Simple in-memory session storage (replace with database in production)
const sessions = new Map<string, SimpleCodeGenResponse>();

function getSessionFromMemory(sessionId: string): SimpleCodeGenResponse | null {
  return sessions.get(sessionId) || null;
}

function updateSession(sessionId: string, update: Partial<SimpleCodeGenResponse>) {
  const current = sessions.get(sessionId) || { sessionId, status: 'generating' as const };
  sessions.set(sessionId, { ...current, ...update });
}

// Main workflow - single AI call that builds everything
async function generateWebsiteWorkflow(sessionId: string, prompt: string, userId: string, provider: string, model: string) {
  try {
    updateSession(sessionId, { 
      status: 'generating',
      logs: ['Analyzing requirements...', 'Planning website structure...']
    });

    // Get API key
    const apiKey = await getUserApiKey(userId, provider);
    if (!apiKey) {
      updateSession(sessionId, { 
        status: 'failed',
        error: `No API key configured for ${provider}`
      });
      return;
    }

    // Enhanced prompt for website generation
    const enhancedPrompt = `Create a complete, working website based on this request: "${prompt}"

You must create ALL necessary files for a working website. Use these tool actions:

<TOOL_ACTION>
{
  "action": "create_file",
  "payload": {
    "filePath": "package.json",
    "content": "{ your package.json content }"
  }
}
</TOOL_ACTION>

<TOOL_ACTION>
{
  "action": "create_file", 
  "payload": {
    "filePath": "index.html",
    "content": "<!DOCTYPE html>..."
  }
}
</TOOL_ACTION>

Requirements:
1. Create a modern, responsive website
2. Use React + Vite OR vanilla HTML/CSS/JS
3. Include proper styling (Tailwind or custom CSS)
4. Make it functional and interactive
5. Create ALL files needed (package.json, main files, components, styles)
6. Use modern web development practices

After creating files, build the project:

<TOOL_ACTION>
{
  "action": "build_project",
  "payload": {
    "projectName": "generated-website"
  }
}
</TOOL_ACTION>

Then create a preview:

<TOOL_ACTION>
{
  "action": "create_preview",
  "payload": {
    "framework": "react"
  }
}
</TOOL_ACTION>

Generate a complete, professional website that fully satisfies the user's request.`;

    updateSession(sessionId, { 
      logs: ['Generating website files...']
    });

    // Call AI API
    const response = await callAI(provider, apiKey, enhancedPrompt, model);
    
    updateSession(sessionId, { 
      status: 'building',
      logs: ['Generated code, now building...']
    });

    // Execute tool actions
    const executionResults = await executeToolActions(response, sessionId);
    
    // Get generated files
    const files = await getProjectFiles(sessionId);
    
    // Check for preview URL
    let previewUrl: string | undefined;
    const previewResult = executionResults.find(r => r.action === 'create_preview');
    if (previewResult?.previewUrl) {
      previewUrl = previewResult.previewUrl;
    }

    // Update final status
    const hasErrors = executionResults.some(r => !r.success);
    updateSession(sessionId, {
      status: hasErrors ? 'failed' : 'completed',
      files,
      previewUrl,
      logs: [
        'Generated code',
        `Created ${files.length} files`,
        ...executionResults.map(r => `${r.action}: ${r.success ? 'SUCCESS' : 'FAILED'}`),
        previewUrl ? `Preview available at: ${previewUrl}` : 'No preview generated'
      ],
      error: hasErrors ? 'Some build steps failed' : undefined
    });

  } catch (error) {
    updateSession(sessionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      logs: ['Generation failed']
    });
  }
}

// Simplified AI calling function
async function callAI(provider: string, apiKey: string, prompt: string, model: string): Promise<string> {
  const messages = [
    { 
      role: 'system', 
      content: 'You are an expert web developer who creates complete, working websites. You must use the tool actions provided to create actual files and build working projects.' 
    },
    { role: 'user', content: prompt }
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
    case 'deepseek':
      return await callDeepSeek(apiKey, messages, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Execute tool actions (reuse from execution.ts)
async function executeToolActions(aiResponse: string, sessionId: string) {
  const results: any[] = [];
  
  const toolActionRegex = /<TOOL_ACTION>\s*({[^}]+})\s*<\/TOOL_ACTION>/g;
  let match;
  
  while ((match = toolActionRegex.exec(aiResponse)) !== null) {
    try {
      const actionData = JSON.parse(match[1]);
      
      const { executeCode } = await import('./execution');
      
      const result = await executeCode({
        sessionId,
        action: actionData.action,
        payload: actionData.payload
      });
      
      results.push({
        action: actionData.action,
        ...result
      });
      
    } catch (error) {
      results.push({
        action: 'parse_error',
        success: false,
        error: `Failed to parse tool action: ${error}`
      });
    }
  }
  
  return results;
}

async function getProjectFiles(sessionId: string) {
  try {
    const { getProjectFiles } = await import('./execution');
    const result = await getProjectFiles({ sessionId });
    return result.files;
  } catch {
    return [];
  }
}

// API calling functions (same as before)
async function callOpenAI(apiKey: string, messages: any[], model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8000,
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
      max_tokens: 8000,
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
      messages,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    throw new Error(`xAI API error: ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || 'No response from AI';
}

async function callDeepSeek(apiKey: string, messages: any[], model: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages,
      max_tokens: 8000,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || 'No response from AI';
}