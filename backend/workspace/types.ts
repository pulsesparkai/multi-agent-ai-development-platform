export interface FileChange {
  id: string;
  projectId: string;
  operation: 'create' | 'update' | 'delete';
  filePath: string;
  content?: string;
  previousContent?: string;
  timestamp: Date;
  applied: boolean;
  source: 'ai_chat' | 'multi_agent' | 'manual';
  sessionId?: string;
}

export interface BuildStatus {
  id: string;
  projectId: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  dependencies?: string[];
}

export interface PreviewServer {
  id: string;
  projectId: string;
  url: string;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  startedAt: Date;
  lastAccessed?: Date;
}

export interface WorkspaceStatus {
  projectId: string;
  fileCount: number;
  pendingChanges: number;
  buildStatus?: BuildStatus;
  previewServer?: PreviewServer;
  lastActivity: Date;
}

export interface AIActionRequest {
  projectId: string;
  sessionId?: string;
  action: 'generate_files' | 'modify_files' | 'build_project' | 'start_preview';
  payload: {
    files?: { path: string; content: string }[];
    prompt?: string;
    buildCommand?: string;
    framework?: string;
  };
  source: 'ai_chat' | 'multi_agent';
}

export interface AIActionResult {
  success: boolean;
  changes?: FileChange[];
  buildStatus?: BuildStatus;
  previewUrl?: string;
  error?: string;
}