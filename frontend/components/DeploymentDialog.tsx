import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Rocket, ExternalLink } from "lucide-react";
import { useBackend } from '../hooks/useBackend';

interface DeploymentDialogProps {
  projectId: string;
  projectName: string;
}

type DeploymentProvider = "vercel" | "netlify" | "github-pages";

export default function DeploymentDialog({ projectId, projectName }: DeploymentDialogProps) {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<DeploymentProvider>("vercel");
  const [accessToken, setAccessToken] = useState("");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [envVars, setEnvVars] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const { toast } = useToast();

  const handleDeploy = async () => {
    if (!accessToken && provider !== "github-pages") {
      toast({
        title: "Access Token Required",
        description: `Please provide your ${provider} access token`,
        variant: "destructive"
      });
      return;
    }

    setDeploying(true);
    setDeploymentResult(null);

    try {
      const environmentVariables: Record<string, string> = {};
      if (envVars.trim()) {
        envVars.split('\n').forEach(line => {
          const [key, value] = line.split('=');
          if (key && value) {
            environmentVariables[key.trim()] = value.trim();
          }
        });
      }

      const result = await backend.deployment.deploy({
        projectId,
        config: {
          provider,
          projectId,
          buildCommand,
          outputDirectory,
          environmentVariables
        },
        accessToken: accessToken || undefined
      });

      setDeploymentResult(result);

      if (result.success) {
        toast({
          title: "Deployment Successful!",
          description: `Your project has been deployed to ${provider}`,
        });
      } else {
        toast({
          title: "Deployment Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Deployment error:", error);
      toast({
        title: "Deployment Error",
        description: "Failed to deploy project. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeploying(false);
    }
  };

  const getProviderInstructions = () => {
    switch (provider) {
      case "vercel":
        return "Get your Vercel token from: https://vercel.com/account/tokens";
      case "netlify":
        return "Get your Netlify token from: https://app.netlify.com/user/applications#personal-access-tokens";
      case "github-pages":
        return "GitHub Pages deployment requires repository setup first. Use version control features.";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Rocket className="h-4 w-4" />
          Deploy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deploy {projectName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="provider">Deployment Provider</Label>
            <Select value={provider} onValueChange={(value: DeploymentProvider) => setProvider(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="netlify">Netlify</SelectItem>
                <SelectItem value="github-pages">GitHub Pages</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getProviderInstructions()}
            </p>
          </div>

          {provider !== "github-pages" && (
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={`Enter your ${provider} access token`}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buildCommand">Build Command</Label>
              <Input
                id="buildCommand"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outputDirectory">Output Directory</Label>
              <Input
                id="outputDirectory"
                value={outputDirectory}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder="dist"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="envVars">Environment Variables</Label>
            <Textarea
              id="envVars"
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder="KEY1=value1&#10;KEY2=value2"
              className="h-20"
            />
            <p className="text-sm text-muted-foreground">
              One per line in KEY=value format
            </p>
          </div>

          {deploymentResult && (
            <div className="p-4 rounded-lg border">
              {deploymentResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <Rocket className="h-4 w-4" />
                    Deployment Successful!
                  </div>
                  {deploymentResult.deploymentUrl && (
                    <div className="flex items-center gap-2">
                      <Label>URL:</Label>
                      <a
                        href={deploymentResult.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        {deploymentResult.deploymentUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">
                  <div className="font-medium">Deployment Failed</div>
                  <div className="text-sm">{deploymentResult.error}</div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeploy} disabled={deploying}>
              {deploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deploy to {provider}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}