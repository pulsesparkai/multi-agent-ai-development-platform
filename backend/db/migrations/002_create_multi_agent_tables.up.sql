-- Agent teams table for storing multi-agent team configurations
CREATE TABLE agent_teams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  budget_limit DOUBLE PRECISION DEFAULT 10.00, -- USD budget limit
  budget_used DOUBLE PRECISION DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent definitions table for storing individual agents in teams
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'planner', 'coder', 'tester', 'reviewer', 'coordinator'
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', 'xai'
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  execution_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent execution sessions for tracking multi-agent workflows
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initial_prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused'
  current_iteration INTEGER DEFAULT 0,
  max_iterations INTEGER DEFAULT 10,
  total_cost DOUBLE PRECISION DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent messages for storing communication between agents
CREATE TABLE agent_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  iteration INTEGER NOT NULL,
  message_type TEXT NOT NULL, -- 'input', 'output', 'error', 'tool_call'
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  cost DOUBLE PRECISION DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage logs for monitoring and rate limiting
CREATE TABLE api_usage_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  cost DOUBLE PRECISION NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session fallbacks for storing single-agent responses when multi-agent fails
CREATE TABLE session_fallbacks (
  session_id TEXT PRIMARY KEY REFERENCES agent_sessions(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_agent_teams_user_id ON agent_teams(user_id);
CREATE INDEX idx_agent_teams_project_id ON agent_teams(project_id);
CREATE INDEX idx_agents_team_id ON agents(team_id);
CREATE INDEX idx_agent_sessions_team_id ON agent_sessions(team_id);
CREATE INDEX idx_agent_sessions_project_id ON agent_sessions(project_id);
CREATE INDEX idx_agent_messages_session_id ON agent_messages(session_id);
CREATE INDEX idx_agent_messages_agent_id ON agent_messages(agent_id);
CREATE INDEX idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX idx_api_usage_logs_created_at ON api_usage_logs(created_at);