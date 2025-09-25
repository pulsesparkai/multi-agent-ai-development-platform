import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { v4 as uuidv4 } from "uuid";

export interface CodeExecutionRequest {
  sessionId: string;
  action: 'create_file' | 'write_file' | 'run_command' | 'build_project' | 'create_preview';
  payload: {
    filePath?: string;
    content?: string;
    command?: string;
    projectName?: string;
    framework?: 'react' | 'vue' | 'vanilla' | 'nextjs';
  };
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  files?: string[];
  previewUrl?: string;
}

// Execute code generation tools
export const executeCode = api<CodeExecutionRequest, CodeExecutionResult>(
  { auth: true, expose: true, method: "POST", path: "/tools/execute-code" },
  async (req) => {
    const auth = getAuthData()!;
    
    // Verify session ownership
    const session = await verifySessionOwnership(req.sessionId, auth.userID);
    if (!session) {
      return {
        success: false,
        error: "Session not found or unauthorized"
      };
    }

    try {
      switch (req.action) {
        case 'create_file':
          return await createFile(req.sessionId, req.payload.filePath!, req.payload.content!);
        
        case 'write_file':
          return await writeFile(req.sessionId, req.payload.filePath!, req.payload.content!);
        
        case 'run_command':
          return await runCommand(req.sessionId, req.payload.command!);
        
        case 'build_project':
          return await buildProject(req.sessionId, req.payload.projectName!);
        
        case 'create_preview':
          return await createPreview(req.sessionId, req.payload.framework || 'react');
        
        default:
          return {
            success: false,
            error: "Unknown action"
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

// Get project files for a session
export const getProjectFiles = api<{ sessionId: string }, { files: { path: string; content: string }[] }>(
  { auth: true, expose: true, method: "GET", path: "/tools/files/:sessionId" },
  async ({ sessionId }) => {
    const auth = getAuthData()!;
    
    const session = await verifySessionOwnership(sessionId, auth.userID);
    if (!session) {
      throw new Error("Session not found or unauthorized");
    }

    const projectDir = getProjectDirectory(sessionId);
    const files = await getAllFiles(projectDir);
    
    return { files };
  }
);

async function createFile(sessionId: string, filePath: string, content: string): Promise<CodeExecutionResult> {
  const projectDir = getProjectDirectory(sessionId);
  const fullPath = path.join(projectDir, filePath);
  
  // Ensure project directory exists
  await fs.mkdir(projectDir, { recursive: true });
  
  // Create file directory if needed
  const fileDir = path.dirname(fullPath);
  await fs.mkdir(fileDir, { recursive: true });
  
  // Write file
  await fs.writeFile(fullPath, content, 'utf8');
  
  return {
    success: true,
    output: `Created file: ${filePath}`,
    files: [filePath]
  };
}

async function writeFile(sessionId: string, filePath: string, content: string): Promise<CodeExecutionResult> {
  return await createFile(sessionId, filePath, content); // Same implementation
}

async function runCommand(sessionId: string, command: string): Promise<CodeExecutionResult> {
  const projectDir = getProjectDirectory(sessionId);
  
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      cwd: projectDir,
      stdio: 'pipe'
    });

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
        output: output || undefined,
        error: error || undefined
      });
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        error: 'Command timed out after 30 seconds'
      });
    }, 30000);
  });
}

async function buildProject(sessionId: string, projectName: string): Promise<CodeExecutionResult> {
  const projectDir = getProjectDirectory(sessionId);
  
  // Check if package.json exists
  const packageJsonPath = path.join(projectDir, 'package.json');
  try {
    await fs.access(packageJsonPath);
  } catch {
    // Create basic package.json if it doesn't exist
    const packageJson = {
      name: projectName,
      version: "1.0.0",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.0.0",
        "react-dom": "^18.0.0"
      },
      devDependencies: {
        "@types/react": "^18.0.0",
        "@types/react-dom": "^18.0.0",
        "@vitejs/plugin-react": "^4.0.0",
        typescript: "^5.0.0",
        vite: "^4.0.0"
      }
    };
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  // Install dependencies
  const installResult = await runCommand(sessionId, 'npm install');
  if (!installResult.success) {
    return installResult;
  }

  // Build project
  const buildResult = await runCommand(sessionId, 'npm run build');
  
  return {
    success: buildResult.success,
    output: `Project built successfully\n${buildResult.output}`,
    error: buildResult.error
  };
}

async function createPreview(sessionId: string, framework: string): Promise<CodeExecutionResult> {
  const projectDir = getProjectDirectory(sessionId);
  
  // Start dev server
  const devResult = await new Promise<CodeExecutionResult>((resolve) => {
    const child = spawn('npm', ['run', 'dev'], {
      cwd: projectDir,
      stdio: 'pipe'
    });

    let output = '';
    let error = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Look for local server URL
      const urlMatch = text.match(/Local:\s*(http:\/\/[^\s]+)/);
      if (urlMatch) {
        resolve({
          success: true,
          output: `Preview available at: ${urlMatch[1]}`,
          previewUrl: urlMatch[1]
        });
        return;
      }
    });

    child.stderr?.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: error || 'Failed to start preview server'
        });
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        error: 'Preview server startup timed out'
      });
    }, 10000);
  });

  return devResult;
}

function getProjectDirectory(sessionId: string): string {
  // Store projects in /tmp/leap-projects/sessionId
  return path.join('/tmp', 'leap-projects', sessionId);
}

async function getAllFiles(dir: string): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and other build directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          const subFiles = await getAllFiles(fullPath);
          files.push(...subFiles);
        }
      } else {
        // Read file content
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          const relativePath = path.relative(dir, fullPath);
          files.push({ path: relativePath, content });
        } catch {
          // Skip files that can't be read as text
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}

async function verifySessionOwnership(sessionId: string, userId: string) {
  // Import db here to avoid circular dependencies
  const { default: db } = await import('../db');
  
  return await db.queryRow`
    SELECT s.id
    FROM agent_sessions s
    JOIN agent_teams t ON s.team_id = t.id
    WHERE s.id = ${sessionId} AND t.user_id = ${userId}
  `;
}