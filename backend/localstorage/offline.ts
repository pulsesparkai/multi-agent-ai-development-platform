import { api } from "encore.dev/api";
import { LocalProject, OfflineCapabilities, LocalLLMConfig, SyncRequest, SyncResult } from "./types";
import { getAuthData } from "~encore/auth";

export const getOfflineCapabilities = api(
  { method: "GET", path: "/offline/capabilities", expose: true },
  async (): Promise<OfflineCapabilities> => {
    return {
      storage: true, // IndexedDB support
      editor: true,  // Monaco editor works offline
      localLLM: false, // Requires configuration
      deployment: false // Requires internet connection
    };
  }
);

export const configureLocalLLM = api(
  { method: "POST", path: "/offline/llm", expose: true, auth: true },
  async (config: LocalLLMConfig): Promise<{ success: boolean; error?: string }> => {
    const user = getAuthData()!;
    
    try {
      // Test connection to local LLM
      const testResponse = await fetch(`${config.endpoint}/api/tags`, {
        method: "GET",
        headers: config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {}
      });
      
      if (!testResponse.ok) {
        return {
          success: false,
          error: "Failed to connect to local LLM endpoint"
        };
      }
      
      // Store configuration securely
      // This would use the secrets management system
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed"
      };
    }
  }
);

export const syncWithServer = api(
  { method: "POST", path: "/offline/sync", expose: true, auth: true },
  async (req: SyncRequest): Promise<SyncResult> => {
    const user = getAuthData()!;
    
    try {
      // Get server version of the project
      // This would integrate with the projects service
      
      // For now, simulate sync logic
      const conflicts: string[] = [];
      
      // Check for conflicts based on timestamps
      // In a real implementation, this would be more sophisticated
      
      if (conflicts.length > 0 && !req.forceSync) {
        return {
          success: false,
          conflicts,
          error: "Conflicts detected. Review changes and force sync if needed."
        };
      }
      
      // Merge changes and update server
      const mergedData: LocalProject = {
        ...req.localData,
        lastModified: new Date(),
        offline: false
      };
      
      return {
        success: true,
        mergedData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed"
      };
    }
  }
);

export interface LocalProjectsResponse {
  projects: LocalProject[];
}

export const getLocalProjects = api(
  { method: "GET", path: "/offline/projects", expose: true, auth: true },
  async (): Promise<LocalProjectsResponse> => {
    const user = getAuthData()!;
    
    // This would query projects marked as available offline
    // For now, return empty array
    return { projects: [] };
  }
);

export const enableOfflineMode = api(
  { method: "POST", path: "/offline/enable/:projectId", expose: true, auth: true },
  async ({ projectId }: { projectId: string }): Promise<{ success: boolean; project?: LocalProject }> => {
    const user = getAuthData()!;
    
    try {
      // Get project data and prepare for offline use
      // This would integrate with the projects and files services
      
      const project: LocalProject = {
        id: projectId,
        name: `Project ${projectId}`,
        files: {
          "README.md": "# Offline Project\n\nThis project is available offline."
        },
        settings: {},
        lastModified: new Date(),
        offline: true
      };
      
      return {
        success: true,
        project
      };
    } catch (error) {
      return {
        success: false
      };
    }
  }
);