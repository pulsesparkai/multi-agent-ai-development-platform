import { api } from "encore.dev/api";
import { HistoryEntry, UndoRequest, RefinementRequest, SessionAnalytics, UserAnalytics } from "./types";
import { getAuthData } from "~encore/auth";

export interface RecordActionRequest {
  projectId: string;
  type: "ai_generation" | "code_edit" | "file_create" | "file_delete" | "deployment";
  action: string;
  input: Record<string, any>;
  output: Record<string, any>;
  undoable: boolean;
}

export const recordAction = api(
  { method: "POST", path: "/history/record", expose: true, auth: true },
  async (entry: RecordActionRequest): Promise<{ id: string }> => {
    const user = getAuthData()!;
    
    const historyEntry: HistoryEntry = {
      ...entry,
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.userID,
      timestamp: new Date(),
      undone: false
    };
    
    // Store in database
    // This would use the database service
    
    return { id: historyEntry.id };
  }
);

export interface HistoryResponse {
  entries: HistoryEntry[];
}

export const getHistory = api(
  { method: "GET", path: "/history", expose: true, auth: true },
  async ({ projectId, limit = 50, offset = 0 }: { 
    projectId?: string; 
    limit?: number; 
    offset?: number; 
  }): Promise<HistoryResponse> => {
    const user = getAuthData()!;
    
    // Query database for user's history
    // This would use the database service with proper filtering
    
    // For now, return mock data
    return {
      entries: [
        {
          id: "hist_1",
          userId: user.userID,
          projectId: projectId || "proj_1",
          type: "ai_generation",
          action: "Generated React component",
          input: { prompt: "Create a todo list component" },
          output: { files: { "TodoList.tsx": "..." } },
          timestamp: new Date(Date.now() - 3600000),
          undoable: true,
          undone: false
        },
        {
          id: "hist_2",
          userId: user.userID,
          projectId: projectId || "proj_1",
          type: "code_edit",
          action: "Updated component styles",
          input: { file: "TodoList.tsx", changes: "..." },
          output: { success: true },
          timestamp: new Date(Date.now() - 1800000),
          undoable: true,
          undone: false
        }
      ]
    };
  }
);

export const undoAction = api(
  { method: "POST", path: "/history/undo", expose: true, auth: true },
  async (req: UndoRequest): Promise<{ success: boolean; error?: string }> => {
    const user = getAuthData()!;
    
    try {
      // Get the history entry
      // This would query the database
      
      // Verify ownership and undoability
      // Apply the undo operation based on the entry type
      
      // Mark as undone in database
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Undo failed"
      };
    }
  }
);

export const refineAction = api(
  { method: "POST", path: "/history/refine", expose: true, auth: true },
  async (req: RefinementRequest): Promise<{ success: boolean; newEntryId?: string; error?: string }> => {
    const user = getAuthData()!;
    
    try {
      // Get the original history entry
      // This would query the database
      
      // Apply refinement based on the original action and new instructions
      // Create a new history entry for the refinement
      
      const newEntryId = `hist_${Date.now()}_refined`;
      
      return {
        success: true,
        newEntryId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Refinement failed"
      };
    }
  }
);

export const startSession = api(
  { method: "POST", path: "/history/session/start", expose: true, auth: true },
  async (): Promise<{ sessionId: string }> => {
    const user = getAuthData()!;
    
    const sessionId = `sess_${Date.now()}_${user.userID}`;
    
    const session: SessionAnalytics = {
      sessionId,
      userId: user.userID,
      startTime: new Date(),
      actionsCount: 0,
      aiGenerations: 0,
      codeEdits: 0,
      deployments: 0,
      errorsCount: 0,
      timeSpent: 0
    };
    
    // Store in database
    // This would use the database service
    
    return { sessionId };
  }
);

export const endSession = api(
  { method: "POST", path: "/history/session/end", expose: true, auth: true },
  async ({ sessionId }: { sessionId: string }): Promise<{ success: boolean }> => {
    const user = getAuthData()!;
    
    try {
      // Update session end time and calculate duration
      // This would update the database
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }
);

export interface AnalyticsResponse {
  analytics: UserAnalytics | null;
}

export const getUserAnalytics = api(
  { method: "GET", path: "/history/analytics", expose: true, auth: true },
  async ({ optIn = false }: { optIn?: boolean }): Promise<AnalyticsResponse> => {
    const user = getAuthData()!;
    
    if (!optIn) {
      return { analytics: null }; // User must opt-in to analytics
    }
    
    // Calculate analytics from session and history data
    // This would query the database
    
    return {
      analytics: {
        userId: user.userID,
        totalSessions: 15,
        totalTimeSpent: 480, // minutes
        averageSessionLength: 32,
        mostUsedFeatures: ["ai_generation", "code_edit", "deployment"],
        projectsCreated: 5,
        deploymentsCount: 12,
        lastActivity: new Date()
      }
    };
  }
);