import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface File {
  id: string;
  name: string;
  path: string;
  content: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetFileParams {
  projectId: string;
  fileId: string;
}

// Gets a specific file with its content
export const get = api<GetFileParams, File>(
  { auth: true, expose: true, method: "GET", path: "/projects/:projectId/files/:fileId" },
  async (params) => {
    const auth = getAuthData()!;

    // Verify user owns the project and get file
    const file = await db.queryRow<File>`
      SELECT f.id, f.name, f.path, f.content, f.language, 
             f.created_at as "createdAt", f.updated_at as "updatedAt"
      FROM files f
      JOIN projects p ON f.project_id = p.id
      WHERE f.id = ${params.fileId} 
        AND f.project_id = ${params.projectId}
        AND p.user_id = ${auth.userID}
    `;

    if (!file) {
      throw APIError.notFound("file not found");
    }

    return file;
  }
);
