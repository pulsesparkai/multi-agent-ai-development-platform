export interface HistoryEntry {
  id: string;
  userId: string;
  projectId: string;
  type: "ai_generation" | "code_edit" | "file_create" | "file_delete" | "deployment";
  action: string;
  input: Record<string, any>;
  output: Record<string, any>;
  timestamp: Date;
  undoable: boolean;
  undone: boolean;
}

export interface UndoRequest {
  entryId: string;
  reason?: string;
}

export interface RefinementRequest {
  entryId: string;
  instructions: string;
  parameters?: Record<string, any>;
}

export interface SessionAnalytics {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  actionsCount: number;
  aiGenerations: number;
  codeEdits: number;
  deployments: number;
  errorsCount: number;
  timeSpent: number; // in minutes
}

export interface UserAnalytics {
  userId: string;
  totalSessions: number;
  totalTimeSpent: number;
  averageSessionLength: number;
  mostUsedFeatures: string[];
  projectsCreated: number;
  deploymentsCount: number;
  lastActivity: Date;
}