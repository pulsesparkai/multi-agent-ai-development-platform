import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { BuildStatus, PreviewServer } from "./types";

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export interface StartBuildRequest {
  projectId: string;
  command?: string;
  installDependencies?: boolean;
}

export interface StartPreviewRequest {
  projectId: string;
  port?: number;
  framework?: 'react' | 'vue' | 'nextjs' | 'vite';
}

// Start a build process
export const startBuild = api<StartBuildRequest, BuildStatus>(
  { auth: true, expose: true, method: "POST", path: "/workspace/:projectId/build" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id, name FROM projects
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    const buildId = generateId();
    const projectDir = getProjectDirectory(req.projectId);

    // Initialize build status
    const buildStatus: BuildStatus = {
      id: buildId,
      projectId: req.projectId,
      status: 'running',
      startedAt: new Date()
    };

    await db.exec`
      INSERT INTO build_status (id, project_id, status, started_at)
      VALUES (${buildId}, ${req.projectId}, 'running', NOW())
    `;

    // Start build process in background
    executeBuild(buildId, projectDir, req.command, req.installDependencies).catch(err => {
      console.error(`Build failed for project ${req.projectId}:`, err);
    });

    return buildStatus;
  }
);

export interface GetBuildStatusRequest {
  projectId: string;
  buildId?: string;
}

export interface GetBuildStatusResponse {
  buildStatus: BuildStatus | null;
}

// Get build status
export const getBuildStatus = api<GetBuildStatusRequest, GetBuildStatusResponse>(
  { auth: true, expose: true, method: "GET", path: "/workspace/:projectId/build/status" },
  async ({ projectId, buildId }) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    let query;
    if (buildId) {
      query = db.queryRow<BuildStatus>`
        SELECT id, project_id as "projectId", status, output, error,
               started_at as "startedAt", completed_at as "completedAt"
        FROM build_status
        WHERE id = ${buildId} AND project_id = ${projectId}
      `;
    } else {
      query = db.queryRow<BuildStatus>`
        SELECT id, project_id as "projectId", status, output, error,
               started_at as "startedAt", completed_at as "completedAt"
        FROM build_status
        WHERE project_id = ${projectId}
        ORDER BY started_at DESC
        LIMIT 1
      `;
    }

    const buildStatus = await query;
    return { buildStatus };
  }
);

// Start preview server
export const startPreview = api<StartPreviewRequest, PreviewServer>(
  { auth: true, expose: true, method: "POST", path: "/workspace/:projectId/preview" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${req.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    // Check if preview server already running
    const existing = await db.queryRow`
      SELECT id, port, status FROM preview_servers
      WHERE project_id = ${req.projectId} AND status IN ('starting', 'running')
    `;

    if (existing) {
      const previewServer = await db.queryRow<PreviewServer>`
        SELECT id, project_id as "projectId", url, port, status,
               started_at as "startedAt", last_accessed as "lastAccessed"
        FROM preview_servers
        WHERE id = ${existing.id}
      `;
      return previewServer!;
    }

    const previewId = generateId();
    const port = req.port || await findAvailablePort();
    
    // Use production domain for preview URL
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? 'https://multi-agent-ai-development-platform-d3ac6ek82vji7q8c7gmg.lp.dev'
      : `http://localhost:${port}`;
    const url = isProduction ? `${baseUrl}/preview/${req.projectId}` : baseUrl;
    
    const projectDir = getProjectDirectory(req.projectId);

    const previewServer: PreviewServer = {
      id: previewId,
      projectId: req.projectId,
      url,
      port,
      status: 'starting',
      startedAt: new Date()
    };

    await db.exec`
      INSERT INTO preview_servers (id, project_id, url, port, status, started_at)
      VALUES (${previewId}, ${req.projectId}, ${url}, ${port}, 'starting', NOW())
    `;

    // Start preview server in background
    startPreviewServer(previewId, projectDir, port, req.framework).catch(err => {
      console.error(`Preview server failed for project ${req.projectId}:`, err);
    });

    return previewServer;
  }
);

export interface StopPreviewRequest {
  projectId: string;
}

export interface StopPreviewResponse {
  success: boolean;
}

// Stop preview server
export const stopPreview = api<StopPreviewRequest, StopPreviewResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/workspace/:projectId/preview" },
  async ({ projectId }) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    await db.exec`
      UPDATE preview_servers
      SET status = 'stopped'
      WHERE project_id = ${projectId} AND status IN ('starting', 'running')
    `;

    return { success: true };
  }
);

export interface GetPreviewUrlRequest {
  projectId: string;
}

export interface GetPreviewUrlResponse {
  url: string | null;
  status: string;
}

// Get preview URL
export const getPreviewUrl = api<GetPreviewUrlRequest, GetPreviewUrlResponse>(
  { auth: true, expose: true, method: "GET", path: "/workspace/:projectId/preview/url" },
  async ({ projectId }) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    const preview = await db.queryRow<{ url: string; status: string }>`
      SELECT url, status FROM preview_servers
      WHERE project_id = ${projectId} AND status IN ('starting', 'running')
      ORDER BY started_at DESC
      LIMIT 1
    `;

    return {
      url: preview?.url || null,
      status: preview?.status || 'stopped'
    };
  }
);

// Serve preview files
export const servePreview = api<{ projectId: string; filePath?: string }, { content: string; contentType: string }>(
  { expose: true, method: "GET", path: "/preview/:projectId/*filePath" },
  async ({ projectId, filePath = "index.html" }) => {
    const projectDir = getProjectDirectory(projectId);
    const distDir = path.join(projectDir, "dist");
    
    // Default to index.html for directory requests
    const targetFile = filePath.endsWith('/') || !filePath ? 'index.html' : filePath;
    const fullPath = path.join(distDir, targetFile);
    
    // Security check - ensure we're serving from the dist directory
    if (!fullPath.startsWith(distDir)) {
      throw APIError.notFound("File not found");
    }
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const ext = path.extname(fullPath);
      
      const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
      
      const contentType = contentTypes[ext] || 'text/plain';
      
      return { content, contentType };
    } catch (error) {
      // If file not found and it's not index.html, try serving index.html (SPA routing)
      if (targetFile !== 'index.html') {
        try {
          const indexPath = path.join(distDir, 'index.html');
          const content = await fs.readFile(indexPath, 'utf-8');
          return { content, contentType: 'text/html' };
        } catch (indexError) {
          throw APIError.notFound("File not found");
        }
      }
      throw APIError.notFound("File not found");
    }
  }
);

async function executeBuild(buildId: string, projectDir: string, customCommand?: string, installDeps = true) {
  try {
    let output = '';
    let error = '';

    // Ensure package.json exists
    await ensurePackageJson(projectDir);

    // Install dependencies if requested
    if (installDeps) {
      const installResult = await runCommand('npm install', projectDir);
      output += installResult.output;
      if (!installResult.success) {
        error += installResult.error;
        await updateBuildStatus(buildId, 'failed', output, error);
        return;
      }
    }

    // Run build command
    const buildCommand = customCommand || 'npm run build';
    const buildResult = await runCommand(buildCommand, projectDir);
    output += buildResult.output;
    error += buildResult.error;

    await updateBuildStatus(
      buildId,
      buildResult.success ? 'completed' : 'failed',
      output,
      error
    );

  } catch (err) {
    await updateBuildStatus(buildId, 'failed', '', err instanceof Error ? err.message : 'Unknown error');
  }
}

async function startPreviewServer(previewId: string, projectDir: string, port: number, framework = 'react') {
  try {
    // Ensure package.json exists
    await ensurePackageJson(projectDir);

    // Install dependencies if needed
    const installResult = await runCommand('npm install', projectDir);
    if (!installResult.success) {
      await updatePreviewStatus(previewId, 'error');
      return;
    }

    // Determine dev command based on framework
    const devCommands: Record<string, string> = {
      react: 'npm run dev',
      vite: 'npm run dev',
      nextjs: 'npm run dev',
      vue: 'npm run serve'
    };

    const devCommand = devCommands[framework] || 'npm run dev';

    // Start dev server with CORS enabled
    const child = spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--host', '0.0.0.0'], {
      cwd: projectDir,
      stdio: 'pipe',
      env: { 
        ...process.env, 
        PORT: port.toString(),
        VITE_HOST: '0.0.0.0'
      }
    });

    let hasStarted = false;

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`Preview ${previewId}:`, output);
      
      // Look for server startup indicators
      if (!hasStarted && (
        output.includes('Local:') ||
        output.includes('localhost') ||
        output.includes('server running') ||
        output.includes('ready')
      )) {
        hasStarted = true;
        updatePreviewStatus(previewId, 'running').catch(console.error);
      }
    });

    child.stderr?.on('data', (data) => {
      console.error(`Preview ${previewId} error:`, data.toString());
    });

    child.on('close', (code) => {
      if (code !== 0 && !hasStarted) {
        updatePreviewStatus(previewId, 'error').catch(console.error);
      }
    });

    // Timeout check
    setTimeout(() => {
      if (!hasStarted) {
        child.kill();
        updatePreviewStatus(previewId, 'error').catch(console.error);
      }
    }, 30000); // 30 second timeout

  } catch (err) {
    await updatePreviewStatus(previewId, 'error');
  }
}

async function ensurePackageJson(projectDir: string) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  
  try {
    await fs.access(packageJsonPath);
  } catch {
    // Create basic package.json
    const packageJson = {
      name: "leap-project",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
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
        typescript: "^5.0.0",
        vite: "^4.4.0"
      }
    };
    
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

async function runCommand(command: string, cwd: string): Promise<{ success: boolean; output: string; error: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, { cwd, stdio: 'pipe' });

    let output = '';
    let error = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output,
        error
      });
    });

    // 5 minute timeout
    setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        output,
        error: error + '\nCommand timed out after 5 minutes'
      });
    }, 300000);
  });
}

async function updateBuildStatus(buildId: string, status: string, output?: string, error?: string) {
  await db.exec`
    UPDATE build_status
    SET status = ${status}, output = ${output}, error = ${error}, 
        completed_at = ${status !== 'running' ? new Date() : null}
    WHERE id = ${buildId}
  `;
}

async function updatePreviewStatus(previewId: string, status: string) {
  await db.exec`
    UPDATE preview_servers
    SET status = ${status}
    WHERE id = ${previewId}
  `;
}

async function findAvailablePort(): Promise<number> {
  // Simple port finder - in production use a proper port finder library
  return 3000 + Math.floor(Math.random() * 1000);
}

function getProjectDirectory(projectId: string): string {
  return path.join('/tmp', 'leap-workspace', projectId);
}