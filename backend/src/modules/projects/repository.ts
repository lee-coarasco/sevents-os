import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DependencyType,
  Milestone,
  MilestoneStatus,
  Project,
  ProgressEntry,
  ProjectStatus,
  ProjectType,
  ScheduleActivity,
  ScheduleActivityDependency,
  WBSNode,
} from "./types.js";

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

export interface CreateWBSNodeInput {
  project_id: string;
  parent_wbs_node_id?: string | null;
  code: string;
  name: string;
  sequence?: number;
  cost_code_id?: string | null;
}

export interface UpdateWBSNodeInput {
  name?: string;
  sequence?: number;
  parent_wbs_node_id?: string | null;
  cost_code_id?: string | null;
}

export interface CreateMilestoneInput {
  project_id: string;
  wbs_node_id?: string | null;
  name: string;
  target_date: string;
}

export interface UpdateMilestoneInput {
  name?: string;
  target_date?: string;
  actual_date?: string | null;
  status?: MilestoneStatus;
}

export interface CreateScheduleActivityInput {
  project_id: string;
  wbs_node_id?: string | null;
  name: string;
  planned_start?: string | null;
  planned_end?: string | null;
}

export interface UpdateScheduleActivityInput {
  name?: string;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  percent_complete?: number;
}

export interface AddScheduleActivityDependencyInput {
  activity_id: string;
  depends_on_activity_id: string;
  dependency_type?: DependencyType;
}

export interface RecordProgressEntryInput {
  schedule_activity_id: string;
  recorded_by: string | null;
  percent_complete: number;
  note?: string | null;
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

  createWBSNode(accessToken: string, input: CreateWBSNodeInput): Promise<WBSNode>;
  listWBSNodes(accessToken: string, projectId: string): Promise<WBSNode[]>;
  updateWBSNode(accessToken: string, wbsNodeId: string, input: UpdateWBSNodeInput): Promise<WBSNode | null>;

  createMilestone(accessToken: string, input: CreateMilestoneInput): Promise<Milestone>;
  listMilestones(accessToken: string, projectId: string): Promise<Milestone[]>;
  updateMilestone(accessToken: string, milestoneId: string, input: UpdateMilestoneInput): Promise<Milestone | null>;

  createScheduleActivity(accessToken: string, input: CreateScheduleActivityInput): Promise<ScheduleActivity>;
  listScheduleActivities(accessToken: string, projectId: string): Promise<ScheduleActivity[]>;
  updateScheduleActivity(
    accessToken: string,
    activityId: string,
    input: UpdateScheduleActivityInput,
  ): Promise<ScheduleActivity | null>;

  addScheduleActivityDependency(
    accessToken: string,
    input: AddScheduleActivityDependencyInput,
  ): Promise<ScheduleActivityDependency>;
  removeScheduleActivityDependency(
    accessToken: string,
    activityId: string,
    dependsOnActivityId: string,
  ): Promise<void>;
  listScheduleActivityDependencies(accessToken: string, activityId: string): Promise<ScheduleActivityDependency[]>;

  recordProgressEntry(accessToken: string, input: RecordProgressEntryInput): Promise<ProgressEntry>;
  listProgressEntries(accessToken: string, scheduleActivityId: string): Promise<ProgressEntry[]>;
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

    async createWBSNode(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("wbs_nodes")
        .insert({ sequence: 0, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createWBSNode: ${error?.message ?? "no row returned"}`);
      return data as WBSNode;
    },

    async listWBSNodes(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("wbs_nodes").select("*").eq("project_id", projectId);
      if (error) throw new Error(`listWBSNodes: ${error.message}`);
      return (data as WBSNode[]) ?? [];
    },

    async updateWBSNode(accessToken, wbsNodeId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("wbs_nodes")
        .update(input)
        .eq("id", wbsNodeId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateWBSNode: ${error.message}`);
      return (data as WBSNode | null) ?? null;
    },

    async createMilestone(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("milestones")
        .insert({ status: "pending", ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createMilestone: ${error?.message ?? "no row returned"}`);
      return data as Milestone;
    },

    async listMilestones(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("milestones").select("*").eq("project_id", projectId);
      if (error) throw new Error(`listMilestones: ${error.message}`);
      return (data as Milestone[]) ?? [];
    },

    async updateMilestone(accessToken, milestoneId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("milestones")
        .update(input)
        .eq("id", milestoneId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateMilestone: ${error.message}`);
      return (data as Milestone | null) ?? null;
    },

    async createScheduleActivity(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("schedule_activities")
        .insert({ percent_complete: 0, ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createScheduleActivity: ${error?.message ?? "no row returned"}`);
      return data as ScheduleActivity;
    },

    async listScheduleActivities(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("schedule_activities")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw new Error(`listScheduleActivities: ${error.message}`);
      return (data as ScheduleActivity[]) ?? [];
    },

    async updateScheduleActivity(accessToken, activityId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("schedule_activities")
        .update(input)
        .eq("id", activityId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateScheduleActivity: ${error.message}`);
      return (data as ScheduleActivity | null) ?? null;
    },

    async addScheduleActivityDependency(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("schedule_activity_dependencies")
        .insert({ dependency_type: "finish_to_start", ...input })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`addScheduleActivityDependency: ${error?.message ?? "no row returned"}`);
      }
      return data as ScheduleActivityDependency;
    },

    async removeScheduleActivityDependency(accessToken, activityId, dependsOnActivityId) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("schedule_activity_dependencies")
        .delete()
        .eq("activity_id", activityId)
        .eq("depends_on_activity_id", dependsOnActivityId);
      if (error) throw new Error(`removeScheduleActivityDependency: ${error.message}`);
    },

    async listScheduleActivityDependencies(accessToken, activityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("schedule_activity_dependencies")
        .select("*")
        .eq("activity_id", activityId);
      if (error) throw new Error(`listScheduleActivityDependencies: ${error.message}`);
      return (data as ScheduleActivityDependency[]) ?? [];
    },

    async recordProgressEntry(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("progress_entries")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`recordProgressEntry: ${error?.message ?? "no row returned"}`);
      return data as ProgressEntry;
    },

    async listProgressEntries(accessToken, scheduleActivityId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("progress_entries")
        .select("*")
        .eq("schedule_activity_id", scheduleActivityId)
        .order("recorded_at", { ascending: true });
      if (error) throw new Error(`listProgressEntries: ${error.message}`);
      return (data as ProgressEntry[]) ?? [];
    },
  };
}
