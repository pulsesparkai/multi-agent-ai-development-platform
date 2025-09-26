import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";

export interface DeleteProjectParams {
  id: string;
}

export interface DeleteProjectResponse {
  success: boolean;
  message: string;
}

// Deletes a project and all its associated data
export const deleteProject = api<DeleteProjectParams, DeleteProjectResponse>(
  { auth: true, expose: true, method: "DELETE", path: "/projects/:id" },
  async (params) => {
    const auth = getAuthData()!;

    // First verify the project exists and belongs to the user
    const project = await db.queryRow`
      SELECT id, name FROM projects
      WHERE id = ${params.id} AND user_id = ${auth.userID}
    `;

    if (!project) {
      throw APIError.notFound("project not found or access denied");
    }

    try {
      // Delete all files associated with the project (cascade will handle this, but being explicit)
      await db.exec`
        DELETE FROM files WHERE project_id = ${params.id}
      `;

      // Delete all chat sessions associated with the project
      await db.exec`
        DELETE FROM chat_sessions WHERE project_id = ${params.id}
      `;

      // Delete the project itself
      await db.exec`
        DELETE FROM projects WHERE id = ${params.id} AND user_id = ${auth.userID}
      `;

      return {
        success: true,
        message: `Project "${project.name}" has been deleted successfully`
      };
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw APIError.internal('Failed to delete project', error as Error);
    }
  }
);