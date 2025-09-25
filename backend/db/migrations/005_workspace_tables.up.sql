-- File changes tracking
CREATE TABLE IF NOT EXISTS file_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  file_path VARCHAR(500) NOT NULL,
  content TEXT,
  previous_content TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  applied BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(20) NOT NULL CHECK (source IN ('ai_chat', 'multi_agent', 'manual')),
  session_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_changes_project_id ON file_changes(project_id);
CREATE INDEX idx_file_changes_timestamp ON file_changes(timestamp);
CREATE INDEX idx_file_changes_session_id ON file_changes(session_id);

-- Build status tracking
CREATE TABLE IF NOT EXISTS build_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  output TEXT,
  error TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_build_status_project_id ON build_status(project_id);
CREATE INDEX idx_build_status_started_at ON build_status(started_at);

-- Preview servers tracking
CREATE TABLE IF NOT EXISTS preview_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url VARCHAR(200) NOT NULL,
  port INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('starting', 'running', 'stopped', 'error')),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMP
);

CREATE INDEX idx_preview_servers_project_id ON preview_servers(project_id);
CREATE INDEX idx_preview_servers_status ON preview_servers(status);

-- Workspace actions history
CREATE TABLE IF NOT EXISTS workspace_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  payload JSONB,
  source VARCHAR(20) NOT NULL CHECK (source IN ('ai_chat', 'multi_agent', 'manual')),
  session_id UUID,
  result JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_actions_project_id ON workspace_actions(project_id);
CREATE INDEX idx_workspace_actions_created_at ON workspace_actions(created_at);
CREATE INDEX idx_workspace_actions_session_id ON workspace_actions(session_id);

-- Add unique constraint to files table to prevent duplicates
ALTER TABLE files ADD CONSTRAINT unique_project_file_path UNIQUE (project_id, path);