import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project, ProjectStatus, ProjectType } from "./types.js";

export interface CreateProjectInput {
  company_id: string;
  name: string;
  code?: string | null;
  client_name?: string | null;
  location?: string | null;
  project_type_id?: string | null;
  contract_reference?: string | null;
  contract_value?: number | null;
  contract_currency?: string | null;
  project_manager_id?: string | null;
  baseline_start_date?: string | null;
  baseline_end_date?: string | null;
  budget_amount?: number | null;
  budget_currency?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  code?: string | null;
  status?: ProjectStatus;
  client_name?: string | null;
  location?: string | null;
  project_type_id?: string | null;
  contract_reference?: string | null;
  contract_value?: number | null;
  contract_currency?: string | null;
  project_manager_id?: string | null;
  baseline_start_date?: string | null;
  baseline_end_date?: string | null;
  budget_amount?: number | null;
  budget_currency?: string | null;
}

export interface CreateProjectTypeInput {
  name: string;
  code?: string | null;
}

/**
 * Every method is keyed off the caller's own access token, not an
 * explicit tenant id — same convention as `TenancyRepository`
 * (backend/src/modules/tenancy/repository.ts): Postgres RLS
 * (`tenant_id = current_tenant_id()`) is the real isolation mechanism,
 * this adapter just has to not bypass it. FR-PROJ-001: `createProject`
 * is today's only path into this table ("authorized manual entry").
 * When M10/M11 (opportunity/contract-award workflows) exist, their
 * approved-event handler should call this same function — do not add a
 * second creation path for that later; wire it through here.
 */
export interface ProjectsRepository {
  createProject(accessToken: string, input: CreateProjectInput): Promise<Project>;
  listProjects(accessToken: string): Promise<Project[]>;
  getProject(accessToken: string, projectId: string): Promise<Project | null>;
  updateProject(accessToken: string, projectId: string, input: UpdateProjectInput): Promise<Project | null>;
  createProjectType(accessToken: string, input: CreateProjectTypeInput): Promise<ProjectType>;
  listProjectTypes(accessToken: string): Promise<ProjectType[]>;
}

/**
 * Supabase-backed implementation. Queries exclusively through the
 * user-scoped client (anon key + caller's bearer token), never the
 * service-role client. Not exercised against a live Supabase project in
 * this session (no reachable credentials in this sandbox, same
 * recurring gap as every prior ticket).
 */
export function createSupabaseProjectsRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): ProjectsRepository {
  return {
    async createProject(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("projects")
        .insert({ status: "active", ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createProject: ${error?.message ?? "no row returned"}`);
      return data as Project;
    },

    async listProjects(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("projects").select("*");
      if (error) throw new Error(`listProjects: ${error.message}`);
      return (data as Project[]) ?? [];
    },

    async getProject(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw new Error(`getProject: ${error.message}`);
      return (data as Project | null) ?? null;
    },

    async updateProject(accessToken, projectId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("projects")
        .update(input)
        .eq("id", projectId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateProject: ${error.message}`);
      return (data as Project | null) ?? null;
    },

    async createProjectType(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_types")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createProjectType: ${error?.message ?? "no row returned"}`);
      return data as ProjectType;
    },

    async listProjectTypes(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("project_types").select("*");
      if (error) throw new Error(`listProjectTypes: ${error.message}`);
      return (data as ProjectType[]) ?? [];
    },
  };
}
