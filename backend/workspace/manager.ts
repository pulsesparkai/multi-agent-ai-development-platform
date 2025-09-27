import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { AIActionRequest, AIActionResult, WorkspaceStatus, BuildStatus, PreviewServer } from "./types";
import { applyFileChangesInternal } from "./filesystem";
import { startBuildInternal, startPreviewInternal } from "./build";
import { wsManager } from "../realtime/websocket";

// Internal function for use by other services (not exposed as API)
export async function executeAIActionInternal(req: AIActionRequest & { userID: string }): Promise<AIActionResult> {
  // Verify project ownership
  const project = await db.queryRow`
    SELECT id FROM projects
    WHERE id = ${req.projectId} AND user_id = ${req.userID}
  `;

  if (!project) {
    throw new Error("project not found");
  }

  try {
    const result: AIActionResult = { success: true };

    switch (req.action) {
      case 'generate_files':
      case 'modify_files':
        if (req.payload.files) {
          const changes = req.payload.files.map(file => ({
            operation: 'create' as const,
            filePath: file.path,
            content: file.content
          }));

          // Broadcast file creation updates via WebSocket
          for (const change of changes) {
            wsManager.broadcastFileUpdate(req.projectId, 'created', change.filePath, change.content);
          }

          const fileResult = await applyFileChangesInternal({
            projectId: req.projectId,
            changes,
            source: req.source,
            sessionId: req.sessionId
          });

          result.changes = fileResult.appliedChanges;
          
          if (fileResult.errors.length > 0) {
            result.error = `Some files failed to apply: ${fileResult.errors.map(e => e.error).join(', ')}`;
          }
        }
        break;

      case 'build_project':
        // Broadcast build started
        wsManager.broadcastBuildUpdate(req.projectId, 'started', 'building', '');
        
        const buildStatus = await startBuildInternal({
          projectId: req.projectId,
          command: req.payload.buildCommand,
          installDependencies: true
        });
        result.buildStatus = buildStatus;
        break;

      case 'start_preview':
        const previewServer = await startPreviewInternal({
          projectId: req.projectId,
          framework: req.payload.framework as any
        });
        result.previewUrl = previewServer.url;
        
        // Broadcast preview ready
        if (previewServer.url) {
          wsManager.broadcastPreviewReady(req.projectId, previewServer.url);
        }
        break;

      default:
        throw new Error(`Unknown action: ${req.action}`);
    }

    // Track action in history
    await db.exec`
      INSERT INTO workspace_actions (id, project_id, action, payload, source, session_id, result)
      VALUES (
        gen_random_uuid(), ${req.projectId}, ${req.action}, 
        ${JSON.stringify(req.payload)}::jsonb, ${req.source}, ${req.sessionId},
        ${JSON.stringify(result)}::jsonb
      )
    `;

    return result;

  } catch (error) {
    const errorResult: AIActionResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    // Track failed action
    await db.exec`
      INSERT INTO workspace_actions (id, project_id, action, payload, source, session_id, result)
      VALUES (
        gen_random_uuid(), ${req.projectId}, ${req.action}, 
        ${JSON.stringify(req.payload)}::jsonb, ${req.source}, ${req.sessionId},
        ${JSON.stringify(errorResult)}::jsonb
      )
    `;

    return errorResult;
  }
}

// Execute AI-generated actions (from chat or multi-agent)
export const executeAIAction = api<AIActionRequest, AIActionResult>(
  { auth: true, expose: true, method: "POST", path: "/workspace/:projectId/ai-action" },
  async (req) => {
    const auth = getAuthData()!;
    return executeAIActionInternal({ ...req, userID: auth.userID });
  }
);

export interface GetWorkspaceStatusRequest {
  projectId: string;
}

// Get workspace status
export const getWorkspaceStatus = api<GetWorkspaceStatusRequest, WorkspaceStatus>(
  { auth: true, expose: true, method: "GET", path: "/workspace/:projectId/status" },
  async ({ projectId }): Promise<WorkspaceStatus> => {
    const auth = getAuthData()!;

    // Verify project ownership
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    // Get file count
    const fileCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM files WHERE project_id = ${projectId}
    `;

    // Get pending changes count
    const pendingChanges = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM file_changes 
      WHERE project_id = ${projectId} AND applied = false
    `;

    // Get latest build status
    const buildStatus = await db.queryRow`
      SELECT id, project_id as "projectId", status, output, error,
             started_at as "startedAt", completed_at as "completedAt"
      FROM build_status
      WHERE project_id = ${projectId}
      ORDER BY started_at DESC
      LIMIT 1
    `;

    // Get active preview server
    const previewServer = await db.queryRow`
      SELECT id, project_id as "projectId", url, port, status,
             started_at as "startedAt", last_accessed as "lastAccessed"
      FROM preview_servers
      WHERE project_id = ${projectId} AND status IN ('starting', 'running')
      ORDER BY started_at DESC
      LIMIT 1
    `;

    // Get last activity
    const lastActivity = await db.queryRow<{ timestamp: Date }>`
      SELECT GREATEST(
        COALESCE(MAX(p.updated_at), '1970-01-01'::timestamp),
        COALESCE(MAX(fc.timestamp), '1970-01-01'::timestamp),
        COALESCE(MAX(wa.created_at), '1970-01-01'::timestamp)
      ) as timestamp
      FROM projects p
      LEFT JOIN file_changes fc ON p.id = fc.project_id
      LEFT JOIN workspace_actions wa ON p.id = wa.project_id
      WHERE p.id = ${projectId}
    `;

    return {
      projectId,
      fileCount: fileCount?.count || 0,
      pendingChanges: pendingChanges?.count || 0,
      buildStatus: buildStatus as BuildStatus | undefined,
      previewServer: previewServer as PreviewServer | undefined,
      lastActivity: lastActivity?.timestamp || new Date()
    };
  }
);