import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { promises as fs } from 'fs';
import path from 'path';

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
import { FileChange } from "./types";

export interface ApplyFileChangesRequest {
  projectId: string;
  changes: {
    operation: 'create' | 'update' | 'delete';
    filePath: string;
    content?: string;
  }[];
  source: 'ai_chat' | 'multi_agent';
  sessionId?: string;
}

export interface ApplyFileChangesResponse {
  appliedChanges: FileChange[];
  errors: { filePath: string; error: string }[];
}

// Internal function for applying file changes (not an API endpoint)
export async function applyFileChangesInternal(req: ApplyFileChangesRequest): Promise<ApplyFileChangesResponse> {
  const appliedChanges: FileChange[] = [];
  const errors: { filePath: string; error: string }[] = [];
  
  const projectDir = getProjectDirectory(req.projectId);
  await fs.mkdir(projectDir, { recursive: true });

  for (const change of req.changes) {
    try {
      const changeId = generateId();
      const fullPath = path.join(projectDir, change.filePath);
      
      let previousContent: string | undefined;
      
      // Get previous content if file exists
      try {
        if (change.operation !== 'create') {
          previousContent = await fs.readFile(fullPath, 'utf8');
        }
      } catch {
        // File doesn't exist
      }

      // Apply the change
      switch (change.operation) {
        case 'create':
        case 'update':
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, change.content || '', 'utf8');
          break;
          
        case 'delete':
          try {
            await fs.unlink(fullPath);
          } catch {
            // File doesn't exist
          }
          break;
      }

      // Record the change in database
      const fileChange: FileChange = {
        id: changeId,
        projectId: req.projectId,
        operation: change.operation,
        filePath: change.filePath,
        content: change.content,
        previousContent,
        timestamp: new Date(),
        applied: true,
        source: req.source,
        sessionId: req.sessionId
      };

      await db.exec`
        INSERT INTO file_changes (
          id, project_id, operation, file_path, content, previous_content, 
          applied, source, session_id
        ) VALUES (
          ${changeId}, ${req.projectId}, ${change.operation}, ${change.filePath},
          ${change.content}, ${previousContent}, true, ${req.source}, ${req.sessionId}
        )
      `;

      // Update or create file record in database
      if (change.operation === 'delete') {
        await db.exec`
          DELETE FROM files WHERE project_id = ${req.projectId} AND path = ${change.filePath}
        `;
      } else {
        await db.exec`
          INSERT INTO files (id, project_id, name, path, content, language)
          VALUES (${generateId()}, ${req.projectId}, ${path.basename(change.filePath)}, ${change.filePath}, ${change.content || ''}, ${getLanguageFromPath(change.filePath)})
          ON CONFLICT (project_id, path) 
          DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
        `;
      }

      appliedChanges.push(fileChange);
    } catch (error) {
      errors.push({
        filePath: change.filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update project timestamp
  await db.exec`
    UPDATE projects SET updated_at = NOW() WHERE id = ${req.projectId}
  `;

  return { appliedChanges, errors };
}

export interface GetFileDiffParams {
  projectId: string;
  filePath: string;
  changeId?: string;
}

export interface FileDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  diff: string;
  changeId: string;
}

// Apply file changes from AI responses
export const applyFileChanges = api<ApplyFileChangesRequest, ApplyFileChangesResponse>(
  { auth: true, expose: true, method: "POST", path: "/workspace/:projectId/apply-changes" },
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

    return await applyFileChangesInternal(req);
  }
);

// Get diff for a file change
export const getFileDiff = api<GetFileDiffParams, FileDiff>(
  { auth: true, expose: true, method: "GET", path: "/workspace/:projectId/diff" },
  async (params) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${params.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    let change;
    if (params.changeId) {
      change = await db.queryRow<FileChange>`
        SELECT * FROM file_changes
        WHERE id = ${params.changeId} AND project_id = ${params.projectId}
      `;
    } else {
      change = await db.queryRow<FileChange>`
        SELECT * FROM file_changes
        WHERE project_id = ${params.projectId} AND file_path = ${params.filePath}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
    }

    if (!change) {
      throw APIError.notFound("file change not found");
    }

    const oldContent = change.previousContent || '';
    const newContent = change.content || '';
    const diff = generateDiff(oldContent, newContent);

    return {
      filePath: change.filePath,
      oldContent,
      newContent,
      diff,
      changeId: change.id
    };
  }
);

// Revert file changes
export const revertChanges = api<{ projectId: string; changeIds: string[] }, { success: boolean; reverted: number }>(
  { auth: true, expose: true, method: "POST", path: "/workspace/:projectId/revert" },
  async ({ projectId, changeIds }) => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    const projectDir = getProjectDirectory(projectId);
    let reverted = 0;

    for (const changeId of changeIds) {
      const change = await db.queryRow<FileChange>`
        SELECT * FROM file_changes
        WHERE id = ${changeId} AND project_id = ${projectId}
      `;

      if (!change) continue;

      try {
        const fullPath = path.join(projectDir, change.filePath);

        if (change.operation === 'create') {
          // Remove created file
          await fs.unlink(fullPath);
        } else if (change.operation === 'delete') {
          // Restore deleted file
          if (change.previousContent) {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, change.previousContent, 'utf8');
          }
        } else if (change.operation === 'update') {
          // Restore previous content
          if (change.previousContent !== undefined) {
            await fs.writeFile(fullPath, change.previousContent, 'utf8');
          }
        }

        // Mark as reverted
        await db.exec`
          UPDATE file_changes SET applied = false WHERE id = ${changeId}
        `;

        reverted++;
      } catch (error) {
        console.error(`Failed to revert change ${changeId}:`, error);
      }
    }

    return { success: true, reverted };
  }
);

function getProjectDirectory(projectId: string): string {
  return path.join('/tmp', 'leap-workspace', projectId);
}

function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.json': 'json',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml'
  };
  return languageMap[ext] || 'text';
}

function generateDiff(oldContent: string, newContent: string): string {
  // Simple diff implementation - in production, consider using a proper diff library
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  let diff = '';
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      if (oldLine) diff += `- ${oldLine}\n`;
      if (newLine) diff += `+ ${newLine}\n`;
    }
  }
  
  return diff;
}