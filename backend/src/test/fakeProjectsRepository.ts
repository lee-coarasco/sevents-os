import type {
  CreateProjectInput,
  CreateProjectTypeInput,
  ProjectsRepository,
  UpdateProjectInput,
} from "../modules/projects/repository.js";
import type { Project, ProjectType } from "../modules/projects/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for ProjectsRepository. Keyed off the caller's own
 * session (same convention as FakeTenancyRepository/FakeWorkforceRepository)
 * so "wrong tenant = not found" is actually exercised, not just asserted.
 */
export class FakeProjectsRepository implements ProjectsRepository {
  sessions = new Map<string, string>(); // accessToken -> tenant_id
  projects = new Map<string, Project>();
  projectTypes = new Map<string, ProjectType>();

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, tenantId);
  }

  private tenantOf(accessToken: string): string {
    const tenantId = this.sessions.get(accessToken);
    if (!tenantId) throw new Error("no tenant for this access token");
    return tenantId;
  }

  async createProject(accessToken: string, input: CreateProjectInput) {
    const tenant_id = this.tenantOf(accessToken);
    const project: Project = {
      id: nextId("project"),
      tenant_id,
      company_id: input.company_id,
      name: input.name,
      code: input.code ?? null,
      status: "active",
      client_name: input.client_name ?? null,
      location: input.location ?? null,
      project_type_id: input.project_type_id ?? null,
      contract_reference: input.contract_reference ?? null,
      contract_value: input.contract_value ?? null,
      contract_currency: input.contract_currency ?? null,
      project_manager_id: input.project_manager_id ?? null,
      baseline_start_date: input.baseline_start_date ?? null,
      baseline_end_date: input.baseline_end_date ?? null,
      budget_amount: input.budget_amount ?? null,
      budget_currency: input.budget_currency ?? null,
    };
    this.projects.set(project.id, project);
    return project;
  }

  async listProjects(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.projects.values()].filter((p) => p.tenant_id === tenant_id);
  }

  async getProject(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const project = this.projects.get(projectId);
    if (!project || project.tenant_id !== tenant_id) return null;
    return project;
  }

  async updateProject(accessToken: string, projectId: string, input: UpdateProjectInput) {
    const tenant_id = this.tenantOf(accessToken);
    const project = this.projects.get(projectId);
    if (!project || project.tenant_id !== tenant_id) return null;
    const updated: Project = { ...project, ...input };
    this.projects.set(projectId, updated);
    return updated;
  }

  async createProjectType(accessToken: string, input: CreateProjectTypeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const projectType: ProjectType = {
      id: nextId("project-type"),
      tenant_id,
      name: input.name,
      code: input.code ?? null,
    };
    this.projectTypes.set(projectType.id, projectType);
    return projectType;
  }

  async listProjectTypes(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.projectTypes.values()].filter((p) => p.tenant_id === tenant_id);
  }
}
