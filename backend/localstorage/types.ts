export interface LocalProject {
  id: string;
  name: string;
  description?: string;
  files: Record<string, string>;
  settings: Record<string, any>;
  lastModified: Date;
  offline: boolean;
}

export interface OfflineCapabilities {
  storage: boolean;
  editor: boolean;
  localLLM: boolean;
  deployment: boolean;
}

export interface LocalLLMConfig {
  provider: "ollama" | "llamacpp" | "custom";
  endpoint: string;
  model: string;
  apiKey?: string;
}

export interface SyncRequest {
  projectId: string;
  localData: LocalProject;
  forceSync?: boolean;
}

export interface SyncResult {
  success: boolean;
  conflicts?: string[];
  mergedData?: LocalProject;
  error?: string;
}