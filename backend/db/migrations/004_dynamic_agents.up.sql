-- Add dynamic role and persona support to agents table
ALTER TABLE agents 
ADD COLUMN can_adapt_role BOOLEAN DEFAULT FALSE,
ADD COLUMN available_roles TEXT[] DEFAULT ARRAY['planner', 'coder', 'tester', 'reviewer', 'coordinator'],
ADD COLUMN persona_id TEXT;

-- Create custom personas table
CREATE TABLE custom_personas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  suggested_role TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role assignment rules table
CREATE TABLE role_assignment_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
  project_type TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('task_completion', 'error_threshold', 'complexity_increase', 'manual', 'time_based')),
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  condition_text TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project requirements table
CREATE TABLE project_requirements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  complexity TEXT CHECK (complexity IN ('low', 'medium', 'high')) DEFAULT 'medium',
  domains TEXT[] DEFAULT ARRAY[]::TEXT[],
  tech_stack TEXT[] DEFAULT ARRAY[]::TEXT[],
  timeframe TEXT CHECK (timeframe IN ('short', 'medium', 'long')) DEFAULT 'medium',
  team_size TEXT CHECK (team_size IN ('small', 'medium', 'large')) DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role assignment history table for tracking dynamic role changes
CREATE TABLE role_assignment_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id TEXT,
  from_role TEXT NOT NULL,
  to_role TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_context JSONB,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_personas_user_public ON custom_personas(user_id, is_public);
CREATE INDEX idx_personas_tags ON custom_personas USING GIN(tags);
CREATE INDEX idx_role_rules_team ON role_assignment_rules(team_id, is_enabled);
CREATE INDEX idx_role_history_agent ON role_assignment_history(agent_id, assigned_at);
CREATE INDEX idx_project_requirements_project ON project_requirements(project_id);

-- Add foreign key constraint for persona_id in agents table
ALTER TABLE agents 
ADD CONSTRAINT fk_agents_persona 
FOREIGN KEY (persona_id) REFERENCES custom_personas(id) ON DELETE SET NULL;

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON custom_personas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_role_rules_updated_at BEFORE UPDATE ON role_assignment_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_requirements_updated_at BEFORE UPDATE ON project_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();