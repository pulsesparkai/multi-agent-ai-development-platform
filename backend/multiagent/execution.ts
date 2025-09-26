import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
// import { v4 as uuidv4 } from "uuid";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
import { getUserApiKey } from "../ai/keys";
import { StartSessionRequest, SessionResponse, Agent, SessionMessage, AgentMessage } from "./types";
import { checkRateLimit, checkBudgetLimit, logAPIUsage } from "./rate_limiter";

// Starts a multi-agent session
export const startSession = api<StartSessionRequest, SessionResponse>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/sessions" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify team ownership and is active
    const team = await db.queryRow`
      SELECT id, budget_limit as "budgetLimit", budget_used as "budgetUsed"
      FROM agent_teams
      WHERE id = ${req.teamId} AND user_id = ${auth.userID} AND is_active = true
    `;

    if (!team) {
      throw APIError.notFound("active team not found");
    }

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    // Check budget
    if (team.budgetUsed >= team.budgetLimit) {
      throw APIError.invalidArgument("budget limit exceeded");
    }

    // Check rate limits
    const rateLimitCheck = await checkRateLimit(auth.userID, 0.1); // Estimate initial cost
    if (!rateLimitCheck.isAllowed) {
      throw APIError.resourceExhausted(rateLimitCheck.reason || "rate limit exceeded");
    }

    // Check budget with estimated session cost
    const estimatedSessionCost = 1.0; // Conservative estimate for a full session
    const budgetCheck = await checkBudgetLimit(req.teamId, estimatedSessionCost);
    if (!budgetCheck.isAllowed) {
      throw APIError.invalidArgument(budgetCheck.reason || "budget limit would be exceeded");
    }

    const sessionId = generateId();
    
    await db.exec`
      INSERT INTO agent_sessions (id, team_id, project_id, user_id, initial_prompt, max_iterations)
      VALUES (${sessionId}, ${req.teamId}, ${req.projectId}, ${auth.userID}, ${req.prompt}, ${req.maxIterations || 10})
    `;

    // Start execution in background
    executeAgentWorkflow(sessionId, req.prompt).catch(err => {
      console.error(`Agent workflow failed for session ${sessionId}:`, err);
    });

    return {
      sessionId,
      status: 'running',
      messages: [],
      currentIteration: 0,
      totalCost: 0
    };
  }
);

// Gets session status and messages
export const getSession = api<{ sessionId: string }, SessionResponse>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/sessions/:sessionId" },
  async ({ sessionId }) => {
    const auth = getAuthData()!;

    const session = await db.queryRow`
      SELECT s.id, s.status, s.current_iteration as "currentIteration", s.total_cost as "totalCost"
      FROM agent_sessions s
      JOIN agent_teams t ON s.team_id = t.id
      WHERE s.id = ${sessionId} AND t.user_id = ${auth.userID}
    `;

    if (!session) {
      throw APIError.notFound("session not found");
    }

    const messages = await getSessionMessages(sessionId);

    return {
      sessionId,
      status: session.status as any,
      messages,
      currentIteration: session.currentIteration,
      totalCost: session.totalCost
    };
  }
);

// Lists all sessions for a team or project
export const listSessions = api<{ teamId?: string; projectId?: string }, { sessions: SessionResponse[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/sessions" },
  async (req) => {
    const auth = getAuthData()!;

    let whereClause = "WHERE t.user_id = $1";
    const params = [auth.userID];

    if (req.teamId) {
      whereClause += " AND s.team_id = $2";
      params.push(req.teamId);
    }

    if (req.projectId) {
      const paramIndex = params.length + 1;
      whereClause += ` AND s.project_id = $${paramIndex}`;
      params.push(req.projectId);
    }

    const query = `
      SELECT s.id, s.status, s.current_iteration as "currentIteration", s.total_cost as "totalCost"
      FROM agent_sessions s
      JOIN agent_teams t ON s.team_id = t.id
      ${whereClause}
      ORDER BY s.created_at DESC
    `;
    
    const sessions = await db.rawQueryAll(query, ...params);

    const sessionResponses: SessionResponse[] = [];
    for (const session of sessions) {
      const messages = await getSessionMessages(session.id);
      sessionResponses.push({
        sessionId: session.id,
        status: session.status as any,
        messages,
        currentIteration: session.currentIteration,
        totalCost: session.totalCost
      });
    }

    return { sessions: sessionResponses };
  }
);

// Pauses or resumes a session
export const controlSession = api<{ sessionId: string; action: 'pause' | 'resume' | 'stop' }, { success: boolean }>(
  { auth: true, expose: true, method: "PATCH", path: "/multiagent/sessions/:sessionId/control" },
  async ({ sessionId, action }) => {
    const auth = getAuthData()!;

    // Verify session ownership
    const session = await db.queryRow`
      SELECT s.id
      FROM agent_sessions s
      JOIN agent_teams t ON s.team_id = t.id
      WHERE s.id = ${sessionId} AND t.user_id = ${auth.userID}
    `;

    if (!session) {
      throw APIError.notFound("session not found");
    }

    const statusMap = {
      pause: 'paused',
      resume: 'running',
      stop: 'completed'
    };

    await db.exec`
      UPDATE agent_sessions
      SET status = ${statusMap[action]}, updated_at = NOW()
      WHERE id = ${sessionId}
    `;

    return { success: true };
  }
);

// Core agent workflow execution
async function executeAgentWorkflow(sessionId: string, initialPrompt: string) {
  try {
    // Get session details
    const session = await db.queryRow`
      SELECT s.*, t.user_id
      FROM agent_sessions s
      JOIN agent_teams t ON s.team_id = t.id
      WHERE s.id = ${sessionId}
    `;

    if (!session) {
      throw new Error("Session not found");
    }

    // Get agents for this team, ordered by execution_order
    const agents = await db.queryAll<Agent>`
      SELECT id, team_id as "teamId", name, role, provider, model, system_prompt as "systemPrompt",
             execution_order as "executionOrder", is_enabled as "isEnabled"
      FROM agents
      WHERE team_id = ${session.team_id} AND is_enabled = true
      ORDER BY execution_order
    `;

    if (agents.length === 0) {
      await updateSessionStatus(sessionId, 'failed');
      return;
    }

    let currentOutput = initialPrompt;
    let totalCost = 0;

    for (let iteration = 1; iteration <= session.max_iterations; iteration++) {
      // Check if session was paused or stopped
      const currentSession = await db.queryRow`
        SELECT status FROM agent_sessions WHERE id = ${sessionId}
      `;

      if (currentSession?.status !== 'running') {
        break;
      }

      await db.exec`
        UPDATE agent_sessions
        SET current_iteration = ${iteration}
        WHERE id = ${sessionId}
      `;

      // Execute each agent in order
      for (const agent of agents) {
        // Check rate limits before each agent execution
        const rateLimitCheck = await checkRateLimit(session.user_id, 0.05);
        if (!rateLimitCheck.isAllowed) {
          await storeAgentMessage(sessionId, agent.id, iteration, 'error', {
            error: `Rate limit exceeded: ${rateLimitCheck.reason}`,
            input: currentOutput
          }, 0);
          
          // Pause session instead of failing
          await updateSessionStatus(sessionId, 'paused');
          return;
        }

        // Check budget limits
        const budgetCheck = await checkBudgetLimit(session.team_id, 0.1);
        if (!budgetCheck.isAllowed) {
          await storeAgentMessage(sessionId, agent.id, iteration, 'error', {
            error: `Budget limit exceeded: ${budgetCheck.reason}`,
            input: currentOutput
          }, 0);
          
          await updateSessionStatus(sessionId, 'paused');
          return;
        }

        const result = await executeAgent(agent, currentOutput, session.user_id, sessionId, iteration);
        
        if (result.success) {
          currentOutput = result.output;
          totalCost += result.cost;

          // Log API usage for monitoring
          await logAPIUsage(session.user_id, agent.provider, result.tokens || 0, result.cost);

          // Store agent message
          await storeAgentMessage(sessionId, agent.id, iteration, 'output', {
            input: currentOutput,
            output: result.output,
            reasoning: result.reasoning
          }, result.cost);
        } else {
          // Store error message
          await storeAgentMessage(sessionId, agent.id, iteration, 'error', {
            error: result.error,
            input: currentOutput,
            agentName: agent.name,
            agentRole: agent.role
          }, 0);

          // Handle different types of errors
          if (result.critical) {
            // Critical errors stop the session
            await updateSessionStatus(sessionId, 'failed');
            return;
          } else {
            // Non-critical errors: try to continue with a simplified output
            const fallbackMessage = `Agent ${agent.name} encountered an error: ${result.error}. Continuing with previous output.`;
            await storeAgentMessage(sessionId, agent.id, iteration, 'output', {
              input: currentOutput,
              output: fallbackMessage,
              reasoning: 'Fallback due to agent error',
              isFallback: true
            }, 0);
          }
        }
      }

      // Update total cost
      await db.exec`
        UPDATE agent_sessions
        SET total_cost = ${totalCost}
        WHERE id = ${sessionId}
      `;

      // Update team budget usage
      await db.exec`
        UPDATE agent_teams
        SET budget_used = budget_used + ${totalCost}
        WHERE id = ${session.team_id}
      `;

      // Check if workflow should continue (coordinator agent decision)
      const coordinator = agents.find(a => a.role === 'coordinator');
      if (coordinator) {
        const shouldContinue = await shouldContinueIteration(coordinator, currentOutput, session.user_id, iteration, session.max_iterations);
        if (!shouldContinue) {
          break;
        }
      }
    }

    await updateSessionStatus(sessionId, 'completed');
  } catch (error) {
    console.error("Agent workflow error:", error);
    await updateSessionStatus(sessionId, 'failed');
  }
}

// Executes a single agent
async function executeAgent(agent: Agent, input: string, userId: string, sessionId: string, iteration: number) {
  try {
    // Get API key for this agent's provider
    const apiKey = await getUserApiKey(userId, agent.provider);
    if (!apiKey) {
      return {
        success: false,
        error: `No API key configured for ${agent.provider}`,
        critical: false,
        output: input,
        cost: 0
      };
    }

    // Enhanced system prompt with tool capabilities
    const enhancedSystemPrompt = `${agent.systemPrompt}

You have access to code execution tools. When you need to create files, build projects, or generate previews, you should specify the exact actions needed in your response using this format:

<TOOL_ACTION>
{
  "action": "create_file",
  "payload": {
    "filePath": "src/App.tsx",
    "content": "// React component code here"
  }
}
</TOOL_ACTION>

Available actions:
- create_file: Create/write a file
- run_command: Execute shell commands
- build_project: Build the project with npm
- create_preview: Start preview server

For website generation requests, you MUST create actual files and build working projects.`;

    // Prepare messages for AI call
    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
      { role: 'user', content: `Current input from previous agent or user:\n\n${input}\n\nPlease process this according to your role as ${agent.role}. Iteration: ${iteration}\n\nIf this involves creating a website or application, use the tool actions to create actual files and build the project.` }
    ];

    // Call AI API
    const response = await callAI(agent.provider, apiKey, messages, agent.model);
    
    // Parse and execute tool actions
    const executionResults = await executeToolActions(response, sessionId);
    
    // Estimate tokens and cost (simplified)
    const inputTokens = Math.ceil(input.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = estimateAPICost(agent.provider, totalTokens);

    // Combine AI response with tool execution results
    let finalOutput = response;
    if (executionResults.length > 0) {
      finalOutput += "\n\n--- Tool Execution Results ---\n";
      executionResults.forEach(result => {
        finalOutput += `\n${result.action}: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
        if (result.output) finalOutput += `Output: ${result.output}\n`;
        if (result.error) finalOutput += `Error: ${result.error}\n`;
        if (result.previewUrl) finalOutput += `Preview URL: ${result.previewUrl}\n`;
      });
    }

    return {
      success: true,
      output: finalOutput,
      reasoning: `Processed by ${agent.name} (${agent.role}) with ${executionResults.length} tool actions`,
      cost: estimatedCost,
      tokens: totalTokens
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Determine if this is a critical error that should stop the session
    const isCritical = errorMessage.includes('API key') || 
                      errorMessage.includes('authentication') ||
                      errorMessage.includes('authorization') ||
                      errorMessage.includes('budget') ||
                      errorMessage.includes('rate limit');
    
    return {
      success: false,
      error: errorMessage,
      critical: isCritical,
      output: input,
      cost: 0,
      tokens: 0
    };
  }
}

// Determines if workflow should continue
async function shouldContinueIteration(coordinator: Agent, currentOutput: string, userId: string, iteration: number, maxIterations: number): Promise<boolean> {
  if (iteration >= maxIterations) {
    return false;
  }

  try {
    const apiKey = await getUserApiKey(userId, coordinator.provider);
    if (!apiKey) {
      return false;
    }

    const messages = [
      { 
        role: 'system', 
        content: `${coordinator.systemPrompt}\n\nYou must decide whether the current iteration should continue. Respond with only "CONTINUE" or "STOP" based on whether the current output meets the requirements or needs further refinement.` 
      },
      { 
        role: 'user', 
        content: `Current output after iteration ${iteration}:\n\n${currentOutput}\n\nShould we continue to iteration ${iteration + 1}? Maximum iterations: ${maxIterations}` 
      }
    ];

    const response = await callAI(coordinator.provider, apiKey, messages, coordinator.model);
    return response.trim().toUpperCase().includes('CONTINUE');

  } catch (error) {
    console.error("Error in coordinator decision:", error);
    return false;
  }
}

// Helper functions
async function updateSessionStatus(sessionId: string, status: string) {
  await db.exec`
    UPDATE agent_sessions
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${sessionId}
  `;
}

async function storeAgentMessage(sessionId: string, agentId: string, iteration: number, messageType: string, content: any, cost: number) {
  await db.exec`
    INSERT INTO agent_messages (id, session_id, agent_id, iteration, message_type, content, cost)
    VALUES (${uuidv4()}, ${sessionId}, ${agentId}, ${iteration}, ${messageType}, ${JSON.stringify(content)}::jsonb, ${cost})
  `;
}

async function getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const messages = await db.queryAll<any>`
    SELECT m.*, a.name as agent_name, a.role as agent_role
    FROM agent_messages m
    JOIN agents a ON m.agent_id = a.id
    WHERE m.session_id = ${sessionId}
    ORDER BY m.iteration, a.execution_order, m.created_at
  `;

  return messages.map(m => ({
    agentName: m.agent_name,
    agentRole: m.agent_role,
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    iteration: m.iteration,
    messageType: m.message_type,
    timestamp: m.created_at,
    cost: m.cost
  }));
}

function estimateAPICost(provider: string, tokenCount: number): number {
  // Simplified cost estimation (per 1K tokens)
  const costs = {
    openai: 0.01,
    anthropic: 0.015,
    google: 0.001,
    xai: 0.01
  };

  const costPer1K = costs[provider as keyof typeof costs] || 0.01;
  return (tokenCount / 1000) * costPer1K;
}

// Simplified AI calling function (reusing logic from chat.ts)
async function callAI(provider: string, apiKey: string, messages: any[], model: string): Promise<string> {
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

// API calling functions (duplicated from chat.ts for now)
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

// Execute tool actions from AI response
async function executeToolActions(aiResponse: string, sessionId: string) {
  const results: any[] = [];
  
  // Extract tool actions from AI response
  const toolActionRegex = /<TOOL_ACTION>\s*({[^}]+})\s*<\/TOOL_ACTION>/g;
  let match;
  
  while ((match = toolActionRegex.exec(aiResponse)) !== null) {
    try {
      const actionData = JSON.parse(match[1]);
      
      // Import execution module dynamically to avoid circular dependency
      const { executeCode } = await import('../tools/execution');
      
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
        error: `Failed to parse or execute tool action: ${error}`
      });
    }
  }
  
  return results;
}