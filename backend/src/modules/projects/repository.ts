import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DependencyType,
  Milestone,
  MilestoneStatus,
  Project,
  ProgressEntry,
  ProjectBaseline,
  ProjectBaselineChangeRequest,
  ProjectBaselineChangeRequestStatus,
  ProjectBaselineStatus,
  ProjectRegisterEntry,
  ProjectStatus,
  ProjectType,
  RegisterEntryKind,
  RegisterEntryStatus,
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

export interface CreateBaselineInput {
  project_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  status?: ProjectBaselineStatus;
  created_by: string | null;
}

export interface UpdateBaselineInput {
  status?: ProjectBaselineStatus;
}

export interface CreateBaselineChangeRequestInput {
  project_id: string;
  current_baseline_id: string;
  proposed_snapshot: Record<string, unknown>;
  reason: string;
  impact_analysis: string;
  submitted_by: string | null;
  workflow_instance_id: string;
}

export interface UpdateBaselineChangeRequestInput {
  status?: ProjectBaselineChangeRequestStatus;
  resulting_baseline_id?: string | null;
}

export interface CreateRegisterEntryInput {
  project_id: string;
  kind: RegisterEntryKind;
  title: string;
  description?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  raised_by: string | null;
  likelihood?: string | null;
  impact?: string | null;
}

export interface UpdateRegisterEntryInput {
  title?: string;
  description?: string | null;
  status?: RegisterEntryStatus;
  owner_id?: string | null;
  due_date?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  likelihood?: string | null;
  impact?: string | null;
}

export interface ListRegisterEntriesFilters {
  kind?: RegisterEntryKind;
  status?: RegisterEntryStatus;
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

  createBaseline(accessToken: string, input: CreateBaselineInput): Promise<ProjectBaseline>;
  listBaselines(accessToken: string, projectId: string): Promise<ProjectBaseline[]>;
  getBaseline(accessToken: string, baselineId: string): Promise<ProjectBaseline | null>;
  updateBaseline(accessToken: string, baselineId: string, input: UpdateBaselineInput): Promise<ProjectBaseline | null>;

  createBaselineChangeRequest(
    accessToken: string,
    input: CreateBaselineChangeRequestInput,
  ): Promise<ProjectBaselineChangeRequest>;
  listBaselineChangeRequests(accessToken: string, projectId: string): Promise<ProjectBaselineChangeRequest[]>;
  getBaselineChangeRequest(accessToken: string, requestId: string): Promise<ProjectBaselineChangeRequest | null>;
  updateBaselineChangeRequest(
    accessToken: string,
    requestId: string,
    input: UpdateBaselineChangeRequestInput,
  ): Promise<ProjectBaselineChangeRequest | null>;

  createRegisterEntry(accessToken: string, input: CreateRegisterEntryInput): Promise<ProjectRegisterEntry>;
  listRegisterEntries(
    accessToken: string,
    projectId: string,
    filters: ListRegisterEntriesFilters,
  ): Promise<ProjectRegisterEntry[]>;
  updateRegisterEntry(
    accessToken: string,
    entryId: string,
    input: UpdateRegisterEntryInput,
  ): Promise<ProjectRegisterEntry | null>;
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

    async createBaseline(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baselines")
        .insert({ status: "approved", ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createBaseline: ${error?.message ?? "no row returned"}`);
      return data as ProjectBaseline;
    },

    async listBaselines(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baselines")
        .select("*")
        .eq("project_id", projectId)
        .order("version", { ascending: true });
      if (error) throw new Error(`listBaselines: ${error.message}`);
      return (data as ProjectBaseline[]) ?? [];
    },

    async getBaseline(accessToken, baselineId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baselines")
        .select("*")
        .eq("id", baselineId)
        .maybeSingle();
      if (error) throw new Error(`getBaseline: ${error.message}`);
      return (data as ProjectBaseline | null) ?? null;
    },

    async updateBaseline(accessToken, baselineId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baselines")
        .update(input)
        .eq("id", baselineId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateBaseline: ${error.message}`);
      return (data as ProjectBaseline | null) ?? null;
    },

    async createBaselineChangeRequest(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baseline_change_requests")
        .insert({ status: "pending", ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createBaselineChangeRequest: ${error?.message ?? "no row returned"}`);
      return data as ProjectBaselineChangeRequest;
    },

    async listBaselineChangeRequests(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baseline_change_requests")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listBaselineChangeRequests: ${error.message}`);
      return (data as ProjectBaselineChangeRequest[]) ?? [];
    },

    async getBaselineChangeRequest(accessToken, requestId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baseline_change_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw new Error(`getBaselineChangeRequest: ${error.message}`);
      return (data as ProjectBaselineChangeRequest | null) ?? null;
    },

    async updateBaselineChangeRequest(accessToken, requestId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_baseline_change_requests")
        .update(input)
        .eq("id", requestId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateBaselineChangeRequest: ${error.message}`);
      return (data as ProjectBaselineChangeRequest | null) ?? null;
    },

    async createRegisterEntry(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_register_entries")
        .insert({ status: "open", ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createRegisterEntry: ${error?.message ?? "no row returned"}`);
      return data as ProjectRegisterEntry;
    },

    async listRegisterEntries(accessToken, projectId, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("project_register_entries").select("*").eq("project_id", projectId);
      if (filters.kind) query = query.eq("kind", filters.kind);
      if (filters.status) query = query.eq("status", filters.status);
      const { data, error } = await query.order("raised_at", { ascending: true });
      if (error) throw new Error(`listRegisterEntries: ${error.message}`);
      return (data as ProjectRegisterEntry[]) ?? [];
    },

    async updateRegisterEntry(accessToken, entryId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("project_register_entries")
        .update(input)
        .eq("id", entryId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateRegisterEntry: ${error.message}`);
      return (data as ProjectRegisterEntry | null) ?? null;
    },
  };
}
