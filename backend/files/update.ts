import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface UpdateFileRequest {
  content: string;
}

export interface UpdateFileParams {
  projectId: string;
  fileId: string;
}

export interface File {
  id: string;
  name: string;
  path: string;
  content: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Updates a file's content
export const update = api<UpdateFileRequest & UpdateFileParams, File>(
  { auth: true, expose: true, method: "PUT", path: "/projects/:projectId/files/:fileId" },
  async (params) => {
    const auth = getAuthData()!;

    // Verify user owns the project and update file
    const result = await db.queryRow<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM files f
        JOIN projects p ON f.project_id = p.id
        WHERE f.id = ${params.fileId} 
          AND f.project_id = ${params.projectId}
          AND p.user_id = ${auth.userID}
      ) as exists
    `;

    if (!result?.exists) {
      throw APIError.notFound("file not found");
    }

    await db.exec`
      UPDATE files 
      SET content = ${params.content}, updated_at = NOW()
      WHERE id = ${params.fileId}
    `;

    // Update project's updated_at timestamp
    await db.exec`
      UPDATE projects 
      SET updated_at = NOW()
      WHERE id = ${params.projectId}
    `;

    const file = await db.queryRow<File>`
      SELECT id, name, path, content, language, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM files
      WHERE id = ${params.fileId}
    `;

    return file!;
  }
);
