-- Deployment tracking
CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  deployment_url TEXT,
  deployment_id TEXT,
  error_message TEXT,
  logs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_user_deployments ON deployments(user_id);
CREATE INDEX idx_project_deployments ON deployments(project_id);

-- Version control repositories
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  github_id INTEGER,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  private BOOLEAN DEFAULT false,
  html_url TEXT,
  clone_url TEXT,
  default_branch TEXT DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_user_repos ON repositories(user_id);
CREATE INDEX idx_project_repos ON repositories(project_id);

-- Secure data storage
CREATE TABLE secure_storage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, key_name)
);
CREATE INDEX idx_user_keys ON secure_storage(user_id);

-- Rate limiting
CREATE TABLE rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  requests INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_size_minutes INTEGER NOT NULL,
  max_requests INTEGER NOT NULL
);
CREATE INDEX idx_user_endpoint ON rate_limits(user_id, endpoint);
CREATE INDEX idx_window_start ON rate_limits(window_start);

-- Budget tracking
CREATE TABLE budget_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  used_amount DECIMAL(10,2) DEFAULT 0,
  limit_amount DECIMAL(10,2) NOT NULL,
  reset_period TEXT NOT NULL,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);
CREATE INDEX idx_user_budgets ON budget_limits(user_id);

-- Action history
CREATE TABLE action_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  input_data JSONB,
  output_data JSONB,
  undoable BOOLEAN DEFAULT false,
  undone BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_user_history ON action_history(user_id);
CREATE INDEX idx_project_history ON action_history(project_id);
CREATE INDEX idx_session_history ON action_history(session_id);
CREATE INDEX idx_timestamp ON action_history(timestamp);

-- Session analytics
CREATE TABLE session_analytics (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  actions_count INTEGER DEFAULT 0,
  ai_generations INTEGER DEFAULT 0,
  code_edits INTEGER DEFAULT 0,
  deployments INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  time_spent_minutes INTEGER DEFAULT 0
);
CREATE INDEX idx_user_sessions ON session_analytics(user_id);
CREATE INDEX idx_start_time ON session_analytics(start_time);

-- Local storage sync
CREATE TABLE local_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  local_data JSONB NOT NULL,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  offline_enabled BOOLEAN DEFAULT false
);
CREATE INDEX idx_user_local ON local_projects(user_id);
CREATE INDEX idx_project_local ON local_projects(project_id);

-- Tool configurations
CREATE TABLE tool_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config_data JSONB,
  api_key_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tool_id)
);
CREATE INDEX idx_user_tools ON tool_configs(user_id);