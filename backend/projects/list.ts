import { api } from "encore.dev/api";
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

export interface ListProjectsResponse {
  projects: Project[];
}

// Lists all projects for the authenticated user
export const list = api<void, ListProjectsResponse>(
  { auth: true, expose: true, method: "GET", path: "/projects" },
  async () => {
    const auth = getAuthData()!;

    const projects = await db.queryAll<Project>`
      SELECT id, name, description, language, created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      WHERE user_id = ${auth.userID}
      ORDER BY updated_at DESC
    `;

    return { projects };
  }
);
