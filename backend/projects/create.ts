import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { v4 as uuidv4 } from "uuid";

export interface CreateProjectRequest {
  name: string;
  description?: string;
  language: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// Creates a new project
export const create = api<CreateProjectRequest, Project>(
  { auth: true, expose: true, method: "POST", path: "/projects" },
  async (req) => {
    const auth = getAuthData()!;
    const projectId = uuidv4();

    await db.exec`
      INSERT INTO projects (id, user_id, name, description, language)
      VALUES (${projectId}, ${auth.userID}, ${req.name}, ${req.description}, ${req.language})
    `;

    // Create a default main file based on language
    const defaultContent = getDefaultFileContent(req.language);
    const defaultFileName = getDefaultFileName(req.language);
    
    await db.exec`
      INSERT INTO files (id, project_id, name, path, content, language)
      VALUES (${uuidv4()}, ${projectId}, ${defaultFileName}, ${defaultFileName}, ${defaultContent}, ${req.language})
    `;

    const project = await db.queryRow<Project>`
      SELECT id, name, description, language, created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      WHERE id = ${projectId}
    `;

    return project!;
  }
);

function getDefaultFileContent(language: string): string {
  switch (language) {
    case 'javascript':
      return '// Welcome to your new JavaScript project\nconsole.log("Hello, World!");';
    case 'typescript':
      return '// Welcome to your new TypeScript project\nconsole.log("Hello, World!");';
    case 'python':
      return '# Welcome to your new Python project\nprint("Hello, World!")';
    case 'react':
      return `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello, World!</h1>
      <p>Welcome to your new React project!</p>
    </div>
  );
}

export default App;`;
    default:
      return '// Welcome to your new project\nconsole.log("Hello, World!");';
  }
}

function getDefaultFileName(language: string): string {
  switch (language) {
    case 'javascript':
      return 'index.js';
    case 'typescript':
      return 'index.ts';
    case 'python':
      return 'main.py';
    case 'react':
      return 'App.jsx';
    default:
      return 'index.js';
  }
}
