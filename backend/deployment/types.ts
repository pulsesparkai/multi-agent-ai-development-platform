export interface DeploymentConfig {
  provider: "vercel" | "netlify" | "github-pages";
  projectId: string;
  buildCommand?: string;
  outputDirectory?: string;
  environmentVariables?: Record<string, string>;
}

export interface DeploymentRequest {
  projectId: string;
  config: DeploymentConfig;
  accessToken?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentUrl?: string;
  deploymentId?: string;
  error?: string;
  logs?: string[];
}

export interface DeploymentStatus {
  id: string;
  status: "pending" | "building" | "success" | "error";
  url?: string;
  createdAt: Date;
  completedAt?: Date;
  logs: string[];
}