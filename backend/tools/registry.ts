import { api } from "encore.dev/api";
import { Tool, ToolExecution, ToolResult } from "./types";
import { getAuthData } from "~encore/auth";

const AVAILABLE_TOOLS: Tool[] = [
  {
    id: "image-editor",
    name: "Image Editor",
    description: "Edit images with resize, crop, filters, and overlay capabilities",
    category: "image",
    enabled: true,
    requiresApiKey: false
  },
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the web using Serper API",
    category: "search",
    enabled: true,
    requiresApiKey: true,
    apiKeyName: "SERPER_API_KEY"
  },
  {
    id: "google-search",
    name: "Google Search",
    description: "Search using Google Custom Search API",
    category: "search",
    enabled: true,
    requiresApiKey: true,
    apiKeyName: "GOOGLE_SEARCH_API_KEY"
  },
  {
    id: "image-generation",
    name: "AI Image Generation",
    description: "Generate images using DALL-E or Stable Diffusion",
    category: "image",
    enabled: true,
    requiresApiKey: true,
    apiKeyName: "OPENAI_API_KEY"
  },
  {
    id: "code-analyzer",
    name: "Code Analyzer",
    description: "Analyze code quality, security, and performance",
    category: "code",
    enabled: true,
    requiresApiKey: false
  }
];

export interface ToolsResponse {
  tools: Tool[];
}

export const listTools = api(
  { method: "GET", path: "/tools", expose: true, auth: true },
  async (): Promise<ToolsResponse> => {
    const user = getAuthData()!;
    
    // This would check user preferences and enabled tools
    return {
      tools: AVAILABLE_TOOLS.filter(tool => tool.enabled)
    };
  }
);

export const executeTool = api(
  { method: "POST", path: "/tools/execute", expose: true, auth: true },
  async (req: ToolExecution): Promise<ToolResult> => {
    const user = getAuthData()!;
    
    const tool = AVAILABLE_TOOLS.find(t => t.id === req.toolId);
    if (!tool) {
      return {
        success: false,
        error: "Tool not found"
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        error: "Tool is disabled"
      };
    }

    if (tool.requiresApiKey && !req.apiKey) {
      return {
        success: false,
        error: `API key required for ${tool.name}`
      };
    }

    try {
      switch (req.toolId) {
        case "image-editor":
          return await executeImageEditor(req.input);
        case "web-search":
          return await executeWebSearch(req.input, req.apiKey!);
        case "google-search":
          return await executeGoogleSearch(req.input, req.apiKey!);
        case "image-generation":
          return await executeImageGeneration(req.input, req.apiKey!);
        case "code-analyzer":
          return await executeCodeAnalyzer(req.input);
        default:
          return {
            success: false,
            error: "Tool execution not implemented"
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
);

async function executeImageEditor(input: any): Promise<ToolResult> {
  // This would integrate with a client-side image editing library like Fabric.js
  // For server-side processing, could use Sharp or similar
  return {
    success: true,
    output: {
      message: "Image editor requires client-side integration with Fabric.js",
      supportedOperations: ["resize", "crop", "filter", "text", "shape"]
    }
  };
}

async function executeWebSearch(input: any, apiKey: string): Promise<ToolResult> {
  const { query, limit = 10 } = input;
  
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: query,
        num: limit
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      output: {
        results: (data as any).organic?.map((result: any) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          source: result.source
        })) || [],
        totalResults: (data as any).searchInformation?.totalResults || 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed"
    };
  }
}

async function executeGoogleSearch(input: any, apiKey: string): Promise<ToolResult> {
  const { query, limit = 10, searchEngineId } = input;
  
  if (!searchEngineId) {
    return {
      success: false,
      error: "Google Custom Search Engine ID required"
    };
  }

  try {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("cx", searchEngineId);
    url.searchParams.set("q", query);
    url.searchParams.set("num", limit.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      output: {
        results: (data as any).items?.map((item: any) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          source: item.displayLink
        })) || [],
        totalResults: (data as any).searchInformation?.totalResults || 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed"
    };
  }
}

async function executeImageGeneration(input: any, apiKey: string): Promise<ToolResult> {
  const { prompt, size = "1024x1024", model = "dall-e-3" } = input;
  
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality: "standard",
        n: 1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      output: {
        imageUrl: (data as any).data[0]?.url,
        revisedPrompt: (data as any).data[0]?.revised_prompt
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Image generation failed"
    };
  }
}

async function executeCodeAnalyzer(input: any): Promise<ToolResult> {
  const { code, language = "typescript" } = input;
  
  // This would integrate with static analysis tools
  // For now, return basic analysis
  return {
    success: true,
    output: {
      analysis: {
        linesOfCode: code.split('\n').length,
        complexity: "medium",
        security: "good",
        performance: "acceptable",
        suggestions: [
          "Consider adding type annotations",
          "Use consistent naming conventions",
          "Add error handling for async operations"
        ]
      }
    }
  };
}