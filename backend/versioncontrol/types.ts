export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface CreateRepositoryRequest {
  name: string;
  description?: string;
  private?: boolean;
  projectId: string;
  accessToken: string;
}

export interface ImportRepositoryRequest {
  repositoryUrl: string;
  accessToken: string;
  projectId?: string;
}

export interface CommitRequest {
  repositoryName: string;
  message: string;
  branch?: string;
  files: Record<string, string>;
  accessToken: string;
}

export interface CreateBranchRequest {
  repositoryName: string;
  branchName: string;
  fromBranch?: string;
  accessToken: string;
}