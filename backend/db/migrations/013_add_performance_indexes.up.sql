-- Add performance indexes for improved query performance

-- Index for chat sessions queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_user ON chat_sessions(project_id, user_id);

-- Index for API keys queries
CREATE INDEX IF NOT EXISTS idx_api_keys_user_provider ON api_keys(user_id, provider);

-- Index for projects queries
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- Index for file changes queries
CREATE INDEX IF NOT EXISTS idx_file_changes_project ON file_changes(project_id);

-- Index for workspace actions queries
CREATE INDEX IF NOT EXISTS idx_workspace_actions_project ON workspace_actions(project_id);

-- Index for session timestamp queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- Index for API key validation queries
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(user_id, provider, is_active);