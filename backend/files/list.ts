import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface File {
  id: string;
  name: string;
  path: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListFilesParams {
  projectId: string;
}

export interface ListFilesResponse {
  files: File[];
}

// Lists all files in a project
export const list = api<ListFilesParams, ListFilesResponse>(
  { auth: true, expose: true, method: "GET", path: "/projects/:projectId/files" },
  async (params) => {
    const auth = getAuthData()!;

    // Verify user owns the project
    const project = await db.queryRow`
      SELECT id FROM projects
      WHERE id = ${params.projectId} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    const files = await db.queryAll<File>`
      SELECT id, name, path, language, created_at as "createdAt", updated_at as "updatedAt"
      FROM files
      WHERE project_id = ${params.projectId}
      ORDER BY path
    `;

    return { files };
  }
);
