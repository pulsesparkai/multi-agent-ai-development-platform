import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface Project {
  id: string;
  name: string;
  description?: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetProjectParams {
  id: string;
}

// Gets a specific project by ID
export const get = api<GetProjectParams, Project>(
  { auth: true, expose: true, method: "GET", path: "/projects/:id" },
  async (params) => {
    const auth = getAuthData()!;

    const project = await db.queryRow<Project>`
      SELECT id, name, description, language, created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      WHERE id = ${params.id} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found");
    }

    return project;
  }
);
