export interface Tool {
  id: string;
  name: string;
  description: string;
  category: "image" | "search" | "code" | "data" | "other";
  enabled: boolean;
  requiresApiKey: boolean;
  apiKeyName?: string;
  configSchema?: Record<string, any>;
}

export interface ToolExecution {
  toolId: string;
  input: Record<string, any>;
  apiKey?: string;
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ImageEditRequest {
  imageUrl: string;
  operation: "resize" | "crop" | "filter" | "text" | "shape";
  parameters: Record<string, any>;
}

export interface SearchRequest {
  query: string;
  type: "web" | "images" | "news" | "academic";
  limit?: number;
  filters?: Record<string, any>;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedDate?: string;
  imageUrl?: string;
}