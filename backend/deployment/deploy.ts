import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { DeploymentRequest, DeploymentResult } from "./types";

export const deploy = api(
  { method: "POST", path: "/deploy", expose: true, auth: true },
  async (req: DeploymentRequest): Promise<DeploymentResult> => {
    const user = getAuthData()!;
    
    try {
      switch (req.config.provider) {
        case "vercel":
          return await deployToVercel(req, user.userID);
        case "netlify":
          return await deployToNetlify(req, user.userID);
        case "github-pages":
          return await deployToGitHubPages(req, user.userID);
        default:
          return {
            success: false,
            error: "Unsupported deployment provider"
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown deployment error"
      };
    }
  }
);

async function deployToVercel(req: DeploymentRequest, userId: string): Promise<DeploymentResult> {
  if (!req.accessToken) {
    return {
      success: false,
      error: "Vercel access token required"
    };
  }

  try {
    const response = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${req.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `project-${req.projectId}`,
        files: await getProjectFiles(req.projectId),
        projectSettings: {
          buildCommand: req.config.buildCommand || "npm run build",
          outputDirectory: req.config.outputDirectory || "dist",
          framework: "vite"
        },
        env: req.config.environmentVariables || {}
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Vercel deployment failed: ${error}`
      };
    }

    const deployment = await response.json() as any;
    return {
      success: true,
      deploymentUrl: `https://${deployment.url}`,
      deploymentId: deployment.id
    };
  } catch (error) {
    return {
      success: false,
      error: `Vercel deployment error: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

async function deployToNetlify(req: DeploymentRequest, userId: string): Promise<DeploymentResult> {
  if (!req.accessToken) {
    return {
      success: false,
      error: "Netlify access token required"
    };
  }

  try {
    const files = await getProjectFiles(req.projectId);
    const formData = new FormData();
    
    for (const [path, content] of Object.entries(files)) {
      formData.append(path, new Blob([content], { type: "text/plain" }));
    }

    const response = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${req.accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Netlify deployment failed: ${error}`
      };
    }

    const site = await response.json() as any;
    return {
      success: true,
      deploymentUrl: site.ssl_url || site.url,
      deploymentId: site.id
    };
  } catch (error) {
    return {
      success: false,
      error: `Netlify deployment error: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

async function deployToGitHubPages(req: DeploymentRequest, userId: string): Promise<DeploymentResult> {
  return {
    success: false,
    error: "GitHub Pages deployment requires repository integration - use version control features first"
  };
}

async function getProjectFiles(projectId: string): Promise<Record<string, string>> {
  // This would integrate with the files service to get all project files
  // For now, return a mock structure
  return {
    "index.html": `<!DOCTYPE html>
<html>
<head>
  <title>Project ${projectId}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
    "package.json": JSON.stringify({
      name: `project-${projectId}`,
      version: "1.0.0",
      type: "module",
      scripts: {
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.0.0",
        vite: "^4.4.0"
      }
    }, null, 2)
  };
}