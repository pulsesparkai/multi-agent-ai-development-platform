import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { 
  History, 
  Undo, 
  RefreshCw, 
  Search,
  Clock,
  Code,
  FileText,
  Rocket,
  Trash2,
  Loader2
} from "lucide-react";
import { useBackend } from '../hooks/useBackend';

interface HistoryPanelProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEntry {
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

const typeIcons = {
  ai_generation: RefreshCw,
  code_edit: Code,
  file_create: FileText,
  file_delete: Trash2,
  deployment: Rocket
};

const typeColors = {
  ai_generation: "bg-blue-100 text-blue-800",
  code_edit: "bg-green-100 text-green-800",
  file_create: "bg-purple-100 text-purple-800",
  file_delete: "bg-red-100 text-red-800",
  deployment: "bg-orange-100 text-orange-800"
};

export default function HistoryPanel({ projectId, open, onOpenChange }: HistoryPanelProps) {
  const backend = useBackend();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [refinementInput, setRefinementInput] = useState("");
  const [undoing, setUndoing] = useState<string | null>(null);
  const [refining, setRefining] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, projectId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await backend.history.getHistory({ 
        projectId, 
        limit: 50 
      });
      setHistory(response.entries.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      })));
    } catch (error) {
      console.error("Failed to load history:", error);
      toast({
        title: "Error",
        description: "Failed to load project history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (entryId: string) => {
    setUndoing(entryId);
    try {
      const result = await backend.history.undoAction({ entryId });
      
      if (result.success) {
        toast({
          title: "Action Undone",
          description: "The action has been successfully undone",
        });
        loadHistory(); // Refresh history
      } else {
        toast({
          title: "Undo Failed",
          description: result.error || "Failed to undo action",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to undo action:", error);
      toast({
        title: "Error",
        description: "Failed to undo action",
        variant: "destructive"
      });
    } finally {
      setUndoing(null);
    }
  };

  const handleRefine = async (entryId: string, instructions: string) => {
    setRefining(entryId);
    try {
      const result = await backend.history.refineAction({ 
        entryId, 
        instructions 
      });
      
      if (result.success) {
        toast({
          title: "Action Refined",
          description: "The action has been refined with your instructions",
        });
        setRefinementInput("");
        setSelectedEntry(null);
        loadHistory(); // Refresh history
      } else {
        toast({
          title: "Refinement Failed",
          description: result.error || "Failed to refine action",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Failed to refine action:", error);
      toast({
        title: "Error",
        description: "Failed to refine action",
        variant: "destructive"
      });
    } finally {
      setRefining(null);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredHistory = history.filter(entry => 
    !searchQuery || 
    entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Project History
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[60vh]">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={loadHistory} disabled={loading} size="sm">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh
              </Button>
            </div>

            <div className="overflow-y-auto space-y-2 h-full">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No matching history entries" : "No history entries yet"}
                </div>
              ) : (
                filteredHistory.map((entry) => {
                  const IconComponent = typeIcons[entry.type];
                  return (
                    <div
                      key={entry.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedEntry?.id === entry.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                      } ${entry.undone ? "opacity-50" : ""}`}
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <IconComponent className="h-4 w-4 mt-0.5 text-gray-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{entry.action}</span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${typeColors[entry.type]}`}
                              >
                                {entry.type.replace("_", " ")}
                              </Badge>
                              {entry.undone && (
                                <Badge variant="outline" className="text-xs">
                                  Undone
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(entry.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {entry.undoable && !entry.undone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUndo(entry.id);
                            }}
                            disabled={undoing === entry.id}
                          >
                            {undoing === entry.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Undo className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-l pl-4 space-y-4">
            {selectedEntry ? (
              <>
                <div>
                  <h3 className="font-medium">Action Details</h3>
                  <Separator className="my-2" />
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">Action</div>
                    <div className="text-sm text-muted-foreground">{selectedEntry.action}</div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Type</div>
                    <Badge className={typeColors[selectedEntry.type]}>
                      {selectedEntry.type.replace("_", " ")}
                    </Badge>
                  </div>

                  <div>
                    <div className="text-sm font-medium">Timestamp</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedEntry.timestamp.toLocaleString()}
                    </div>
                  </div>

                  {selectedEntry.input && Object.keys(selectedEntry.input).length > 0 && (
                    <div>
                      <div className="text-sm font-medium">Input</div>
                      <pre className="text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-20">
                        {JSON.stringify(selectedEntry.input, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedEntry.output && Object.keys(selectedEntry.output).length > 0 && (
                    <div>
                      <div className="text-sm font-medium">Output</div>
                      <pre className="text-xs bg-gray-50 p-2 rounded border overflow-auto max-h-20">
                        {JSON.stringify(selectedEntry.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {selectedEntry.type === "ai_generation" && !selectedEntry.undone && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium">Refine This Action</div>
                        <div className="text-xs text-muted-foreground">
                          Provide instructions to improve or modify this result
                        </div>
                      </div>
                      
                      <Textarea
                        value={refinementInput}
                        onChange={(e) => setRefinementInput(e.target.value)}
                        placeholder="Enter refinement instructions..."
                        className="h-20 text-sm"
                      />
                      
                      <Button
                        size="sm"
                        onClick={() => handleRefine(selectedEntry.id, refinementInput)}
                        disabled={!refinementInput.trim() || refining === selectedEntry.id}
                        className="w-full"
                      >
                        {refining === selectedEntry.id && (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        )}
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Refine Action
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Select a history entry to view details
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}