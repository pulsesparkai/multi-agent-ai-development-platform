import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, 
  Image, 
  Code, 
  Database, 
  Settings,
  Play,
  Loader2,
  ExternalLink,
  Key,
  Edit
} from "lucide-react";
import { useBackend } from '../hooks/useBackend';
import ImageEditor from "./ImageEditor";

interface ToolsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: "image" | "search" | "code" | "data" | "other";
  enabled: boolean;
  requiresApiKey: boolean;
  apiKeyName?: string;
}

interface ToolExecution {
  toolId: string;
  input: Record<string, any>;
  apiKey?: string;
}

const categoryIcons = {
  image: Image,
  search: Search,
  code: Code,
  data: Database,
  other: Settings
};

export default function ToolsPanel({ open, onOpenChange }: ToolsPanelProps) {
  const backend = useBackend();
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [toolInput, setToolInput] = useState<Record<string, any>>({});
  const [showImageEditor, setShowImageEditor] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const response = await backend.tools.listTools();
      setTools(response.tools);
    } catch (error) {
      console.error("Failed to load tools:", error);
      toast({
        title: "Error",
        description: "Failed to load available tools",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const executeTool = async (tool: Tool, input: Record<string, any>) => {
    setExecuting(true);
    setResult(null);

    try {
      const execution: ToolExecution = {
        toolId: tool.id,
        input,
        apiKey: tool.requiresApiKey ? apiKeys[tool.apiKeyName!] : undefined
      };

      const toolResult = await backend.tools.executeTool(execution);
      setResult(toolResult);

      if (toolResult.success) {
        toast({
          title: "Tool Executed Successfully",
          description: `${tool.name} completed successfully`,
        });
      } else {
        toast({
          title: "Tool Execution Failed",
          description: toolResult.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to execute tool:", error);
      toast({
        title: "Execution Error",
        description: "Failed to execute tool. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

  const renderToolInput = (tool: Tool) => {
    switch (tool.id) {
      case "web-search":
      case "google-search":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">Search Query</Label>
              <Input
                id="search-query"
                value={toolInput.query || ""}
                onChange={(e) => setToolInput({ ...toolInput, query: e.target.value })}
                placeholder="Enter your search query"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-limit">Number of Results</Label>
              <Select 
                value={toolInput.limit?.toString() || "10"} 
                onValueChange={(value) => setToolInput({ ...toolInput, limit: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 results</SelectItem>
                  <SelectItem value="10">10 results</SelectItem>
                  <SelectItem value="20">20 results</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tool.id === "google-search" && (
              <div className="space-y-2">
                <Label htmlFor="search-engine-id">Custom Search Engine ID</Label>
                <Input
                  id="search-engine-id"
                  value={toolInput.searchEngineId || ""}
                  onChange={(e) => setToolInput({ ...toolInput, searchEngineId: e.target.value })}
                  placeholder="Your Google Custom Search Engine ID"
                />
              </div>
            )}
          </div>
        );

      case "image-editor":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image Editor</Label>
              <Button
                onClick={() => setShowImageEditor(true)}
                className="w-full gap-2"
              >
                <Edit className="h-4 w-4" />
                Open Image Editor
              </Button>
              <p className="text-sm text-muted-foreground">
                Edit images with tools like crop, resize, filters, text, and shapes
              </p>
            </div>
          </div>
        );

      case "image-generation":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-prompt">Image Prompt</Label>
              <Textarea
                id="image-prompt"
                value={toolInput.prompt || ""}
                onChange={(e) => setToolInput({ ...toolInput, prompt: e.target.value })}
                placeholder="Describe the image you want to generate"
                className="h-20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image-size">Image Size</Label>
              <Select 
                value={toolInput.size || "1024x1024"} 
                onValueChange={(value) => setToolInput({ ...toolInput, size: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="256x256">256x256</SelectItem>
                  <SelectItem value="512x512">512x512</SelectItem>
                  <SelectItem value="1024x1024">1024x1024</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "code-analyzer":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code-input">Code to Analyze</Label>
              <Textarea
                id="code-input"
                value={toolInput.code || ""}
                onChange={(e) => setToolInput({ ...toolInput, code: e.target.value })}
                placeholder="Paste your code here"
                className="h-32 font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code-language">Language</Label>
              <Select 
                value={toolInput.language || "typescript"} 
                onValueChange={(value) => setToolInput({ ...toolInput, language: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label>Tool Input</Label>
            <Textarea
              value={JSON.stringify(toolInput, null, 2)}
              onChange={(e) => {
                try {
                  setToolInput(JSON.parse(e.target.value));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder="Enter tool input as JSON"
              className="h-20 font-mono"
            />
          </div>
        );
    }
  };

  const renderResult = (result: any) => {
    if (!result) return null;

    if (!result.success) {
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="font-medium text-red-800">Error</div>
          <div className="text-red-600">{result.error}</div>
        </div>
      );
    }

    switch (selectedTool?.id) {
      case "web-search":
      case "google-search":
        return (
          <div className="space-y-2">
            <div className="font-medium">Search Results</div>
            {result.output?.results?.map((item: any, index: number) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="font-medium text-blue-600">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.title}
                  </a>
                </div>
                <div className="text-sm text-muted-foreground">{item.snippet}</div>
                <div className="text-xs text-green-600">{item.source}</div>
              </div>
            ))}
          </div>
        );

      case "image-generation":
        return (
          <div className="space-y-2">
            <div className="font-medium">Generated Image</div>
            {result.output?.imageUrl && (
              <div className="space-y-2">
                <img 
                  src={result.output.imageUrl} 
                  alt="Generated" 
                  className="max-w-full h-auto rounded-lg border"
                />
                <a 
                  href={result.output.imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                >
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        );

      case "code-analyzer":
        return (
          <div className="space-y-2">
            <div className="font-medium">Analysis Results</div>
            <div className="p-3 border rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Lines of Code: {result.output?.analysis?.linesOfCode}</div>
                <div>Complexity: {result.output?.analysis?.complexity}</div>
                <div>Security: {result.output?.analysis?.security}</div>
                <div>Performance: {result.output?.analysis?.performance}</div>
              </div>
              {result.output?.analysis?.suggestions && (
                <div className="mt-2">
                  <div className="font-medium">Suggestions:</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {result.output.analysis.suggestions.map((suggestion: string, index: number) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <div className="font-medium">Tool Output</div>
            <pre className="p-3 border rounded-lg bg-gray-50 text-sm overflow-auto">
              {JSON.stringify(result.output, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Development Tools</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Available Tools</h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {tools.map((tool) => {
                  const IconComponent = categoryIcons[tool.category];
                  return (
                    <Card 
                      key={tool.id}
                      className={`cursor-pointer transition-colors ${
                        selectedTool?.id === tool.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedTool(tool)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <CardTitle className="text-sm">{tool.name}</CardTitle>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">
                              {tool.category}
                            </Badge>
                            {tool.requiresApiKey && (
                              <Badge variant="secondary" className="text-xs">
                                <Key className="h-2 w-2 mr-1" />
                                API Key
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs">
                          {tool.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {selectedTool ? (
              <>
                <div>
                  <h3 className="text-lg font-medium">{selectedTool.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTool.description}</p>
                </div>

                {selectedTool.requiresApiKey && (
                  <div className="space-y-2">
                    <Label htmlFor="api-key">{selectedTool.apiKeyName}</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKeys[selectedTool.apiKeyName!] || ""}
                      onChange={(e) => setApiKeys({ 
                        ...apiKeys, 
                        [selectedTool.apiKeyName!]: e.target.value 
                      })}
                      placeholder="Enter your API key"
                    />
                  </div>
                )}

                {renderToolInput(selectedTool)}

                {selectedTool.id !== "image-editor" && (
                  <Button 
                    onClick={() => executeTool(selectedTool, toolInput)}
                    disabled={executing || (selectedTool.requiresApiKey && !apiKeys[selectedTool.apiKeyName!])}
                    className="w-full"
                  >
                    {executing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Play className="mr-2 h-4 w-4" />
                    Execute Tool
                  </Button>
                )}

                {result && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Results</h4>
                    {renderResult(result)}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Select a tool to get started
              </div>
            )}
          </div>
        </div>
        
        <ImageEditor
          open={showImageEditor}
          onOpenChange={setShowImageEditor}
        />
      </DialogContent>
    </Dialog>
  );
}