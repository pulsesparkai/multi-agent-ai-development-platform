import { api } from "encore.dev/api";
import { 
  GitHubRepository, 
  GitHubCommit, 
  GitHubBranch,
  CreateRepositoryRequest,
  ImportRepositoryRequest,
  CommitRequest,
  CreateBranchRequest
} from "./types";
import { getAuthData } from "~encore/auth";

export const createRepository = api(
  { method: "POST", path: "/github/repositories", expose: true, auth: true },
  async (req: CreateRepositoryRequest): Promise<GitHubRepository> => {
    const user = getAuthData()!;
    
    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        name: req.name,
        description: req.description,
        private: req.private || false,
        auto_init: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create repository: ${error}`);
    }

    const repo = await response.json() as any;
    
    // After creating repo, push initial project files
    if (req.projectId) {
      await pushInitialFiles(req.projectId, repo.full_name, req.accessToken);
    }
    
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at
    };
  }
);

export const importRepository = api(
  { method: "POST", path: "/github/import", expose: true, auth: true },
  async (req: ImportRepositoryRequest): Promise<{ success: boolean; projectId?: string }> => {
    const user = getAuthData()!;
    
    // Extract owner and repo from URL
    const urlParts = req.repositoryUrl.replace("https://github.com/", "").split("/");
    if (urlParts.length < 2) {
      throw new Error("Invalid GitHub repository URL");
    }
    
    const [owner, repo] = urlParts;
    
    // Get repository info
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!repoResponse.ok) {
      throw new Error("Repository not found or access denied");
    }

    // Get repository contents
    const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!contentsResponse.ok) {
      throw new Error("Failed to fetch repository contents");
    }

    const contents = await contentsResponse.json();
    
    // Create new project with imported files
    const projectId = req.projectId || `imported-${Date.now()}`;
    
    // This would integrate with the files service to create project files
    // For now, just return success
    
    return {
      success: true,
      projectId
    };
  }
);

export const commitChanges = api(
  { method: "POST", path: "/github/commit", expose: true, auth: true },
  async (req: CommitRequest): Promise<GitHubCommit> => {
    const user = getAuthData()!;
    
    const [owner, repo] = req.repositoryName.split("/");
    const branch = req.branch || "main";
    
    // Get the latest commit SHA for the branch
    const branchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!branchResponse.ok) {
      throw new Error("Failed to get branch information");
    }

    const branchData = await branchResponse.json() as any;
    const latestCommitSha = branchData.object.sha;

    // Get the tree SHA from the latest commit
    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    const commitData = await commitResponse.json() as any;
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const tree = [];
    for (const [path, content] of Object.entries(req.files)) {
      const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        headers: {
          "Authorization": `token ${req.accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify({
          content: Buffer.from(content).toString("base64"),
          encoding: "base64"
        })
      });

      const blob = await blobResponse.json() as any;
      tree.push({
        path,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      });
    }

    // Create new tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree
      })
    });

    const newTree = await treeResponse.json() as any;

    // Create new commit
    const newCommitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: req.message,
        tree: newTree.sha,
        parents: [latestCommitSha]
      })
    });

    const newCommit = await newCommitResponse.json() as any;

    // Update branch reference
    await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        sha: newCommit.sha
      })
    });

    return {
      sha: newCommit.sha,
      message: newCommit.message,
      author: {
        name: newCommit.author.name,
        email: newCommit.author.email,
        date: newCommit.author.date
      },
      url: newCommit.html_url
    };
  }
);

export const createBranch = api(
  { method: "POST", path: "/github/branches", expose: true, auth: true },
  async (req: CreateBranchRequest): Promise<GitHubBranch> => {
    const user = getAuthData()!;
    
    const [owner, repo] = req.repositoryName.split("/");
    const fromBranch = req.fromBranch || "main";
    
    // Get the SHA of the source branch
    const branchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`, {
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!branchResponse.ok) {
      throw new Error("Source branch not found");
    }

    const branchData = await branchResponse.json() as any;
    
    // Create new branch
    const newBranchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: {
        "Authorization": `token ${req.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        ref: `refs/heads/${req.branchName}`,
        sha: branchData.object.sha
      })
    });

    if (!newBranchResponse.ok) {
      const error = await newBranchResponse.text();
      throw new Error(`Failed to create branch: ${error}`);
    }

    const newBranch = await newBranchResponse.json() as any;
    
    return {
      name: req.branchName,
      commit: {
        sha: newBranch.object.sha,
        url: newBranch.object.url
      },
      protected: false
    };
  }
);

export interface RepositoriesResponse {
  repositories: GitHubRepository[];
}

export const listRepositories = api(
  { method: "GET", path: "/github/repositories", expose: true, auth: true },
  async ({ accessToken }: { accessToken: string }): Promise<RepositoriesResponse> => {
    const user = getAuthData()!;
    
    const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
      headers: {
        "Authorization": `token ${accessToken}`,
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch repositories");
    }

    const repos = await response.json() as any;
    
    return {
      repositories: repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at
      }))
    };
  }
);

async function pushInitialFiles(projectId: string, repositoryName: string, accessToken: string): Promise<void> {
  // This would get project files and push them to the repository
  // For now, just create a basic README
  const files = {
    "README.md": `# Project ${projectId}\n\nGenerated by Multi-Agent AI Development Platform\n`,
    ".gitignore": "node_modules/\n.env\n.env.local\ndist/\nbuild/\n"
  };
  
  await commitChanges({
    repositoryName,
    message: "Initial commit from AI platform",
    files,
    accessToken
  });
}