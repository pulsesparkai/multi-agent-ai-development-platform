import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { v4 as uuidv4 } from "uuid";

export interface CreateFileRequest {
  name: string;
  path: string;
  content?: string;
  language?: string;
}

export interface CreateFileParams {
  projectId: string;
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

// Creates a new file in a project
export const create = api<CreateFileRequest & CreateFileParams, File>(
  { auth: true, expose: true, method: "POST", path: "/projects/:projectId/files" },
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

    // Check if file with same path already exists
    const existingFile = await db.queryRow`
      SELECT id FROM files
      WHERE project_id = ${params.projectId} AND path = ${params.path}
    `;

    if (existingFile) {
      throw APIError.alreadyExists("file with this path already exists");
    }

    const fileId = uuidv4();
    const content = params.content || '';

    await db.exec`
      INSERT INTO files (id, project_id, name, path, content, language)
      VALUES (${fileId}, ${params.projectId}, ${params.name}, ${params.path}, ${content}, ${params.language})
    `;

    const file = await db.queryRow<File>`
      SELECT id, name, path, content, language, 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM files
      WHERE id = ${fileId}
    `;

    return file!;
  }
);
