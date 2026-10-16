import type {
  AddScheduleActivityDependencyInput,
  CreateBaselineChangeRequestInput,
  CreateBaselineInput,
  CreateCloseoutItemInput,
  CreateHealthSnapshotInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectTypeInput,
  CreateRegisterEntryInput,
  CreateScheduleActivityInput,
  CreateWBSNodeInput,
  ListRegisterEntriesFilters,
  ProjectsRepository,
  RecordProgressEntryInput,
  UpdateBaselineChangeRequestInput,
  UpdateBaselineInput,
  UpdateCloseoutItemInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
  UpdateRegisterEntryInput,
  UpdateScheduleActivityInput,
  UpdateWBSNodeInput,
} from "../modules/projects/repository.js";
import type {
  Milestone,
  ProgressEntry,
  Project,
  ProjectBaseline,
  ProjectBaselineChangeRequest,
  ProjectCloseoutChecklistItem,
  ProjectHealthSnapshot,
  ProjectRegisterEntry,
  ProjectType,
  ScheduleActivity,
  ScheduleActivityDependency,
  WBSNode,
} from "../modules/projects/types.js";

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
  wbsNodes = new Map<string, WBSNode>();
  milestones = new Map<string, Milestone>();
  scheduleActivities = new Map<string, ScheduleActivity>();
  dependencies: ScheduleActivityDependency[] = [];
  progressEntries: ProgressEntry[] = [];
  baselines = new Map<string, ProjectBaseline>();
  baselineChangeRequests = new Map<string, ProjectBaselineChangeRequest>();
  registerEntries = new Map<string, ProjectRegisterEntry>();
  healthSnapshots = new Map<string, ProjectHealthSnapshot>();
  closeoutItems = new Map<string, ProjectCloseoutChecklistItem>();

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

  async createWBSNode(accessToken: string, input: CreateWBSNodeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const wbsNode: WBSNode = {
      id: nextId("wbs-node"),
      tenant_id,
      project_id: input.project_id,
      parent_wbs_node_id: input.parent_wbs_node_id ?? null,
      code: input.code,
      name: input.name,
      sequence: input.sequence ?? 0,
      cost_code_id: input.cost_code_id ?? null,
    };
    this.wbsNodes.set(wbsNode.id, wbsNode);
    return wbsNode;
  }

  async listWBSNodes(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.wbsNodes.values()].filter((n) => n.tenant_id === tenant_id && n.project_id === projectId);
  }

  async updateWBSNode(accessToken: string, wbsNodeId: string, input: UpdateWBSNodeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const wbsNode = this.wbsNodes.get(wbsNodeId);
    if (!wbsNode || wbsNode.tenant_id !== tenant_id) return null;
    const updated: WBSNode = { ...wbsNode, ...input };
    this.wbsNodes.set(wbsNodeId, updated);
    return updated;
  }

  async createMilestone(accessToken: string, input: CreateMilestoneInput) {
    const tenant_id = this.tenantOf(accessToken);
    const milestone: Milestone = {
      id: nextId("milestone"),
      tenant_id,
      project_id: input.project_id,
      wbs_node_id: input.wbs_node_id ?? null,
      name: input.name,
      target_date: input.target_date,
      actual_date: null,
      status: "pending",
    };
    this.milestones.set(milestone.id, milestone);
    return milestone;
  }

  async listMilestones(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.milestones.values()].filter((m) => m.tenant_id === tenant_id && m.project_id === projectId);
  }

  async updateMilestone(accessToken: string, milestoneId: string, input: UpdateMilestoneInput) {
    const tenant_id = this.tenantOf(accessToken);
    const milestone = this.milestones.get(milestoneId);
    if (!milestone || milestone.tenant_id !== tenant_id) return null;
    const updated: Milestone = { ...milestone, ...input };
    this.milestones.set(milestoneId, updated);
    return updated;
  }

  async createScheduleActivity(accessToken: string, input: CreateScheduleActivityInput) {
    const tenant_id = this.tenantOf(accessToken);
    const activity: ScheduleActivity = {
      id: nextId("schedule-activity"),
      tenant_id,
      project_id: input.project_id,
      wbs_node_id: input.wbs_node_id ?? null,
      name: input.name,
      planned_start: input.planned_start ?? null,
      planned_end: input.planned_end ?? null,
      actual_start: null,
      actual_end: null,
      percent_complete: 0,
    };
    this.scheduleActivities.set(activity.id, activity);
    return activity;
  }

  async listScheduleActivities(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.scheduleActivities.values()].filter(
      (a) => a.tenant_id === tenant_id && a.project_id === projectId,
    );
  }

  async updateScheduleActivity(accessToken: string, activityId: string, input: UpdateScheduleActivityInput) {
    const tenant_id = this.tenantOf(accessToken);
    const activity = this.scheduleActivities.get(activityId);
    if (!activity || activity.tenant_id !== tenant_id) return null;
    const updated: ScheduleActivity = { ...activity, ...input };
    this.scheduleActivities.set(activityId, updated);
    return updated;
  }

  async addScheduleActivityDependency(accessToken: string, input: AddScheduleActivityDependencyInput) {
    const tenant_id = this.tenantOf(accessToken);
    const dependency: ScheduleActivityDependency = {
      tenant_id,
      activity_id: input.activity_id,
      depends_on_activity_id: input.depends_on_activity_id,
      dependency_type: input.dependency_type ?? "finish_to_start",
    };
    this.dependencies.push(dependency);
    return dependency;
  }

  async removeScheduleActivityDependency(accessToken: string, activityId: string, dependsOnActivityId: string) {
    const tenant_id = this.tenantOf(accessToken);
    this.dependencies = this.dependencies.filter(
      (d) =>
        !(
          d.tenant_id === tenant_id &&
          d.activity_id === activityId &&
          d.depends_on_activity_id === dependsOnActivityId
        ),
    );
  }

  async listScheduleActivityDependencies(accessToken: string, activityId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return this.dependencies.filter((d) => d.tenant_id === tenant_id && d.activity_id === activityId);
  }

  async recordProgressEntry(accessToken: string, input: RecordProgressEntryInput) {
    const tenant_id = this.tenantOf(accessToken);
    const entry: ProgressEntry = {
      id: nextId("progress-entry"),
      tenant_id,
      schedule_activity_id: input.schedule_activity_id,
      recorded_by: input.recorded_by,
      recorded_at: new Date().toISOString(),
      percent_complete: input.percent_complete,
      note: input.note ?? null,
    };
    this.progressEntries.push(entry);
    return entry;
  }

  async listProgressEntries(accessToken: string, scheduleActivityId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return this.progressEntries.filter(
      (e) => e.tenant_id === tenant_id && e.schedule_activity_id === scheduleActivityId,
    );
  }

  async createBaseline(accessToken: string, input: CreateBaselineInput) {
    const tenant_id = this.tenantOf(accessToken);
    const baseline: ProjectBaseline = {
      id: nextId("baseline"),
      tenant_id,
      project_id: input.project_id,
      version: input.version,
      snapshot: input.snapshot,
      status: input.status ?? "approved",
      created_by: input.created_by,
      created_at: new Date().toISOString(),
    };
    this.baselines.set(baseline.id, baseline);
    return baseline;
  }

  async listBaselines(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.baselines.values()]
      .filter((b) => b.tenant_id === tenant_id && b.project_id === projectId)
      .sort((a, b) => a.version - b.version);
  }

  async getBaseline(accessToken: string, baselineId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const baseline = this.baselines.get(baselineId);
    if (!baseline || baseline.tenant_id !== tenant_id) return null;
    return baseline;
  }

  async updateBaseline(accessToken: string, baselineId: string, input: UpdateBaselineInput) {
    const tenant_id = this.tenantOf(accessToken);
    const baseline = this.baselines.get(baselineId);
    if (!baseline || baseline.tenant_id !== tenant_id) return null;
    const updated: ProjectBaseline = { ...baseline, ...input };
    this.baselines.set(baselineId, updated);
    return updated;
  }

  async createBaselineChangeRequest(accessToken: string, input: CreateBaselineChangeRequestInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const request: ProjectBaselineChangeRequest = {
      id: nextId("baseline-change-request"),
      tenant_id,
      project_id: input.project_id,
      current_baseline_id: input.current_baseline_id,
      proposed_snapshot: input.proposed_snapshot,
      reason: input.reason,
      impact_analysis: input.impact_analysis,
      status: "pending",
      submitted_by: input.submitted_by,
      workflow_instance_id: input.workflow_instance_id,
      resulting_baseline_id: null,
      created_at: now,
      updated_at: now,
    };
    this.baselineChangeRequests.set(request.id, request);
    return request;
  }

  async listBaselineChangeRequests(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.baselineChangeRequests.values()].filter(
      (r) => r.tenant_id === tenant_id && r.project_id === projectId,
    );
  }

  async getBaselineChangeRequest(accessToken: string, requestId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const request = this.baselineChangeRequests.get(requestId);
    if (!request || request.tenant_id !== tenant_id) return null;
    return request;
  }

  async updateBaselineChangeRequest(accessToken: string, requestId: string, input: UpdateBaselineChangeRequestInput) {
    const tenant_id = this.tenantOf(accessToken);
    const request = this.baselineChangeRequests.get(requestId);
    if (!request || request.tenant_id !== tenant_id) return null;
    const updated: ProjectBaselineChangeRequest = {
      ...request,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.baselineChangeRequests.set(requestId, updated);
    return updated;
  }

  async createRegisterEntry(accessToken: string, input: CreateRegisterEntryInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const entry: ProjectRegisterEntry = {
      id: nextId("register-entry"),
      tenant_id,
      project_id: input.project_id,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      status: "open",
      owner_id: input.owner_id ?? null,
      due_date: input.due_date ?? null,
      raised_by: input.raised_by,
      raised_at: now,
      resolved_at: null,
      resolution_note: null,
      likelihood: input.likelihood ?? null,
      impact: input.impact ?? null,
      created_at: now,
      updated_at: now,
    };
    this.registerEntries.set(entry.id, entry);
    return entry;
  }

  async listRegisterEntries(accessToken: string, projectId: string, filters: ListRegisterEntriesFilters) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.registerEntries.values()].filter(
      (e) =>
        e.tenant_id === tenant_id &&
        e.project_id === projectId &&
        (!filters.kind || e.kind === filters.kind) &&
        (!filters.status || e.status === filters.status),
    );
  }

  async updateRegisterEntry(accessToken: string, entryId: string, input: UpdateRegisterEntryInput) {
    const tenant_id = this.tenantOf(accessToken);
    const entry = this.registerEntries.get(entryId);
    if (!entry || entry.tenant_id !== tenant_id) return null;
    const updated: ProjectRegisterEntry = { ...entry, ...input, updated_at: new Date().toISOString() };
    this.registerEntries.set(entryId, updated);
    return updated;
  }

  async createHealthSnapshot(accessToken: string, input: CreateHealthSnapshotInput) {
    const tenant_id = this.tenantOf(accessToken);
    const snapshot: ProjectHealthSnapshot = {
      id: nextId("health-snapshot"),
      tenant_id,
      project_id: input.project_id,
      computed_at: new Date().toISOString(),
      factors: input.factors,
      summary: input.summary,
      computed_by: input.computed_by,
    };
    this.healthSnapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  async listHealthSnapshots(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.healthSnapshots.values()]
      .filter((s) => s.tenant_id === tenant_id && s.project_id === projectId)
      .sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1));
  }

  async listCloseoutItems(accessToken: string, projectId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.closeoutItems.values()].filter((i) => i.tenant_id === tenant_id && i.project_id === projectId);
  }

  async createCloseoutItem(accessToken: string, input: CreateCloseoutItemInput) {
    const tenant_id = this.tenantOf(accessToken);
    const item: ProjectCloseoutChecklistItem = {
      id: nextId("closeout-item"),
      tenant_id,
      project_id: input.project_id,
      item_key: input.item_key,
      status: input.status ?? "pending",
      completed_by: input.completed_by ?? null,
      completed_at: input.completed_at ?? null,
    };
    this.closeoutItems.set(item.id, item);
    return item;
  }

  async updateCloseoutItem(accessToken: string, itemId: string, input: UpdateCloseoutItemInput) {
    const tenant_id = this.tenantOf(accessToken);
    const item = this.closeoutItems.get(itemId);
    if (!item || item.tenant_id !== tenant_id) return null;
    const updated: ProjectCloseoutChecklistItem = { ...item, ...input };
    this.closeoutItems.set(itemId, updated);
    return updated;
  }
}
