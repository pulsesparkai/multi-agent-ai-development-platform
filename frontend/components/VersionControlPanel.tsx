import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  GitBranch, 
  GitCommit, 
  GitFork, 
  Download, 
  Upload, 
  Plus,
  ExternalLink,
  Loader2
} from "lucide-react";
import { useBackend } from '../hooks/useBackend';

interface VersionControlPanelProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
}

interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export default function VersionControlPanel({ projectId, open, onOpenChange }: VersionControlPanelProps) {
  const backend = useBackend();
  const [accessToken, setAccessToken] = useState("");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDescription, setNewRepoDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"repositories" | "commits" | "branches" | "create">("repositories");
  const { toast } = useToast();

  const loadRepositories = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const response = await backend.versioncontrol.listRepositories({ accessToken });
      setRepositories(response.repositories);
    } catch (error) {
      console.error("Failed to load repositories:", error);
      toast({
        title: "Error",
        description: "Failed to load repositories. Check your access token.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadRepositories();
    }
  }, [accessToken]);

  const handleCreateRepository = async () => {
    if (!newRepoName || !accessToken) return;

    setLoading(true);
    try {
      const repo = await backend.versioncontrol.createRepository({
        name: newRepoName,
        description: newRepoDescription,
        private: false,
        projectId,
        accessToken
      });

      toast({
        title: "Repository Created",
        description: `Successfully created repository: ${repo.name}`,
      });

      setNewRepoName("");
      setNewRepoDescription("");
      setView("repositories");
      loadRepositories();
    } catch (error) {
      console.error("Failed to create repository:", error);
      toast({
        title: "Error",
        description: "Failed to create repository. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommitChanges = async () => {
    if (!selectedRepo || !commitMessage || !accessToken) return;

    setLoading(true);
    try {
      // Get project files (this would integrate with the files service)
      const files = {
        "README.md": `# ${selectedRepo.name}\n\nUpdated from AI Development Platform\n`,
        "package.json": JSON.stringify({
          name: selectedRepo.name,
          version: "1.0.0",
          description: selectedRepo.description
        }, null, 2)
      };

      await backend.versioncontrol.commitChanges({
        repositoryName: selectedRepo.fullName,
        message: commitMessage,
        branch: selectedBranch || selectedRepo.defaultBranch,
        files,
        accessToken
      });

      toast({
        title: "Changes Committed",
        description: "Successfully committed changes to repository",
      });

      setCommitMessage("");
    } catch (error) {
      console.error("Failed to commit changes:", error);
      toast({
        title: "Error",
        description: "Failed to commit changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!selectedRepo || !newBranchName || !accessToken) return;

    setLoading(true);
    try {
      await backend.versioncontrol.createBranch({
        repositoryName: selectedRepo.fullName,
        branchName: newBranchName,
        fromBranch: selectedBranch || selectedRepo.defaultBranch,
        accessToken
      });

      toast({
        title: "Branch Created",
        description: `Successfully created branch: ${newBranchName}`,
      });

      setNewBranchName("");
    } catch (error) {
      console.error("Failed to create branch:", error);
      toast({
        title: "Error",
        description: "Failed to create branch. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportRepository = async (repoUrl: string) => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const result = await backend.versioncontrol.importRepository({
        repositoryUrl: repoUrl,
        accessToken,
        projectId
      });

      if (result.success) {
        toast({
          title: "Repository Imported",
          description: "Successfully imported repository into project",
        });
      }
    } catch (error) {
      console.error("Failed to import repository:", error);
      toast({
        title: "Error",
        description: "Failed to import repository. Please check the URL.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Version Control</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!accessToken ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github-token">GitHub Access Token</Label>
                <Input
                  id="github-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-sm text-muted-foreground">
                  Get your token from:{" "}
                  <a 
                    href="https://github.com/settings/personal-access-tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GitHub Settings
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={view === "repositories" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("repositories")}
                >
                  Repositories
                </Button>
                <Button
                  variant={view === "commits" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("commits")}
                  disabled={!selectedRepo}
                >
                  <GitCommit className="h-4 w-4 mr-1" />
                  Commit
                </Button>
                <Button
                  variant={view === "branches" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("branches")}
                  disabled={!selectedRepo}
                >
                  <GitBranch className="h-4 w-4 mr-1" />
                  Branches
                </Button>
                <Button
                  variant={view === "create" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("create")}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </div>

              <Separator />

              {view === "repositories" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Your Repositories</h3>
                    <Button size="sm" onClick={loadRepositories} disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Refresh
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {repositories.map((repo) => (
                      <div
                        key={repo.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedRepo?.id === repo.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedRepo(repo)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{repo.name}</span>
                              {repo.private && <Badge variant="secondary">Private</Badge>}
                            </div>
                            {repo.description && (
                              <p className="text-sm text-muted-foreground mt-1">{repo.description}</p>
                            )}
                          </div>
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === "commits" && selectedRepo && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Commit Changes</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="commit-message">Commit Message</Label>
                      <Textarea
                        id="commit-message"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Describe your changes..."
                        className="h-20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="branch">Target Branch</Label>
                      <Input
                        id="branch"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        placeholder={selectedRepo.defaultBranch}
                      />
                    </div>

                    <Button onClick={handleCommitChanges} disabled={!commitMessage || loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Upload className="mr-2 h-4 w-4" />
                      Commit Changes
                    </Button>
                  </div>
                </div>
              )}

              {view === "branches" && selectedRepo && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Branch Management</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-branch">Create New Branch</Label>
                      <div className="flex gap-2">
                        <Input
                          id="new-branch"
                          value={newBranchName}
                          onChange={(e) => setNewBranchName(e.target.value)}
                          placeholder="feature/new-feature"
                        />
                        <Button onClick={handleCreateBranch} disabled={!newBranchName || loading}>
                          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <GitFork className="mr-2 h-4 w-4" />
                          Create
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === "create" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Create New Repository</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo-name">Repository Name</Label>
                      <Input
                        id="repo-name"
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        placeholder="my-awesome-project"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="repo-description">Description (optional)</Label>
                      <Textarea
                        id="repo-description"
                        value={newRepoDescription}
                        onChange={(e) => setNewRepoDescription(e.target.value)}
                        placeholder="A brief description of your project"
                        className="h-20"
                      />
                    </div>

                    <Button onClick={handleCreateRepository} disabled={!newRepoName || loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Plus className="mr-2 h-4 w-4" />
                      Create Repository
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}