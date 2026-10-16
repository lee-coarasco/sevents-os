import type {
  CreateProjectInput,
  CreateProjectTypeInput,
  ProjectsRepository,
  UpdateProjectInput,
} from "./repository.js";
import type { Project, ProjectType } from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

/** FR-PROJ-001: the only creation path today is this authorized-manual-entry call. */
export async function createProject(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateProjectInput,
): Promise<Project> {
  return repo.createProject(accessToken, input);
}

export async function listProjects(repo: ProjectsRepository, accessToken: string): Promise<Project[]> {
  return repo.listProjects(accessToken);
}

export async function getProject(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<Project> {
  const project = await repo.getProject(accessToken, projectId);
  if (!project) throw new NotFoundError();
  return project;
}

export async function updateProject(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const updated = await repo.updateProject(accessToken, projectId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function createProjectType(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateProjectTypeInput,
): Promise<ProjectType> {
  return repo.createProjectType(accessToken, input);
}

export async function listProjectTypes(repo: ProjectsRepository, accessToken: string): Promise<ProjectType[]> {
  return repo.listProjectTypes(accessToken);
}
