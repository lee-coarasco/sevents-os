import type {
  AddScheduleActivityDependencyInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectTypeInput,
  CreateRegisterEntryInput,
  CreateScheduleActivityInput,
  CreateWBSNodeInput,
  ListRegisterEntriesFilters,
  ProjectsRepository,
  RecordProgressEntryInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
  UpdateRegisterEntryInput,
  UpdateScheduleActivityInput,
  UpdateWBSNodeInput,
} from "./repository.js";
import type {
  Milestone,
  ProgressEntry,
  Project,
  ProjectBaseline,
  ProjectBaselineChangeRequest,
  ProjectRegisterEntry,
  ProjectType,
  ScheduleActivity,
  ScheduleActivityDependency,
  WBSNode,
} from "./types.js";
import { getWorkflowInstance, startWorkflowInstance } from "../workflow/service.js";
import type { WorkflowRepository } from "../workflow/repository.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

/** Ticket 0075 (M09c): a project already has a baseline — propose a change instead of setting another "initial" one. */
export class DuplicateInitialBaselineError extends Error {}

/** Ticket 0075 (M09c): a baseline change was proposed before the project has any approved baseline to change. */
export class NoCurrentBaselineError extends Error {}

/** FR-PROJ-004: reason and impact analysis are both required, non-blank. */
export class MissingBaselineChangeReasonError extends Error {}

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

export async function createWBSNode(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateWBSNodeInput,
): Promise<WBSNode> {
  return repo.createWBSNode(accessToken, input);
}

export async function listWBSNodes(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<WBSNode[]> {
  return repo.listWBSNodes(accessToken, projectId);
}

export async function updateWBSNode(
  repo: ProjectsRepository,
  accessToken: string,
  wbsNodeId: string,
  input: UpdateWBSNodeInput,
): Promise<WBSNode> {
  const updated = await repo.updateWBSNode(accessToken, wbsNodeId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function createMilestone(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateMilestoneInput,
): Promise<Milestone> {
  return repo.createMilestone(accessToken, input);
}

export async function listMilestones(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<Milestone[]> {
  return repo.listMilestones(accessToken, projectId);
}

export async function updateMilestone(
  repo: ProjectsRepository,
  accessToken: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<Milestone> {
  const updated = await repo.updateMilestone(accessToken, milestoneId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function createScheduleActivity(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateScheduleActivityInput,
): Promise<ScheduleActivity> {
  return repo.createScheduleActivity(accessToken, input);
}

export async function listScheduleActivities(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ScheduleActivity[]> {
  return repo.listScheduleActivities(accessToken, projectId);
}

export async function updateScheduleActivity(
  repo: ProjectsRepository,
  accessToken: string,
  activityId: string,
  input: UpdateScheduleActivityInput,
): Promise<ScheduleActivity> {
  const updated = await repo.updateScheduleActivity(accessToken, activityId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function addScheduleActivityDependency(
  repo: ProjectsRepository,
  accessToken: string,
  input: AddScheduleActivityDependencyInput,
): Promise<ScheduleActivityDependency> {
  return repo.addScheduleActivityDependency(accessToken, input);
}

export async function removeScheduleActivityDependency(
  repo: ProjectsRepository,
  accessToken: string,
  activityId: string,
  dependsOnActivityId: string,
): Promise<void> {
  return repo.removeScheduleActivityDependency(accessToken, activityId, dependsOnActivityId);
}

export async function listScheduleActivityDependencies(
  repo: ProjectsRepository,
  accessToken: string,
  activityId: string,
): Promise<ScheduleActivityDependency[]> {
  return repo.listScheduleActivityDependencies(accessToken, activityId);
}

/** Append-only (FR-PROJ-003): a correction is a new entry, never an edit of a past one. */
export async function recordProgressEntry(
  repo: ProjectsRepository,
  accessToken: string,
  input: RecordProgressEntryInput,
): Promise<ProgressEntry> {
  return repo.recordProgressEntry(accessToken, input);
}

export async function listProgressEntries(
  repo: ProjectsRepository,
  accessToken: string,
  scheduleActivityId: string,
): Promise<ProgressEntry[]> {
  return repo.listProgressEntries(accessToken, scheduleActivityId);
}

// ---------------------------------------------------------------------------
// Baseline snapshots & baseline-change control (ticket 0075, M09c)
// ---------------------------------------------------------------------------

/** The frozen copy FR-PROJ-004 asks for — WBS/milestone/activity planned dates and budget, read live and never updated again once captured. */
async function buildLiveSnapshot(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<Record<string, unknown>> {
  const project = await getProject(repo, accessToken, projectId);
  const [wbsNodes, milestones, scheduleActivities] = await Promise.all([
    repo.listWBSNodes(accessToken, projectId),
    repo.listMilestones(accessToken, projectId),
    repo.listScheduleActivities(accessToken, projectId),
  ]);
  return {
    budgetAmount: project.budget_amount,
    budgetCurrency: project.budget_currency,
    wbsNodes,
    milestones,
    scheduleActivities,
  };
}

async function requireCurrentBaseline(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ProjectBaseline> {
  const baselines = await repo.listBaselines(accessToken, projectId);
  const current = baselines.find((b) => b.status === "approved");
  if (!current) {
    throw new NoCurrentBaselineError(`project ${projectId} has no approved baseline yet — set the initial baseline first`);
  }
  return current;
}

/**
 * FR-PROJ-004: "the initial baseline requires approval" is not what
 * the BRD text says — it says baseline *changes* require approval.
 * Baseline v1 is captured directly from the project's current live
 * WBS/milestone/activity/budget state, no workflow instance involved.
 * Only ever callable once per project; later baselines only come from
 * an approved change request (see proposeBaselineChange below).
 */
export async function setInitialBaseline(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
  createdBy: string | null,
): Promise<ProjectBaseline> {
  const existing = await repo.listBaselines(accessToken, projectId);
  if (existing.length > 0) {
    throw new DuplicateInitialBaselineError(`project ${projectId} already has a baseline; propose a baseline change instead`);
  }
  const snapshot = await buildLiveSnapshot(repo, accessToken, projectId);
  return repo.createBaseline(accessToken, {
    project_id: projectId,
    version: 1,
    snapshot,
    status: "approved",
    created_by: createdBy,
  });
}

export async function listBaselines(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ProjectBaseline[]> {
  return repo.listBaselines(accessToken, projectId);
}

export async function getBaseline(repo: ProjectsRepository, accessToken: string, baselineId: string): Promise<ProjectBaseline> {
  const baseline = await repo.getBaseline(accessToken, baselineId);
  if (!baseline) throw new NotFoundError();
  return baseline;
}

export interface ProposeBaselineChangeInput {
  projectId: string;
  /** Whoever configured this feature in the Configuration Studio names which published approval workflow to run — same "no automatic resolution" convention as ticket 0066's explicit approverUserIds; this module does not guess a definition. */
  definitionId: string;
  proposedSnapshot: Record<string, unknown>;
  reason: string;
  impactAnalysis: string;
  submittedBy: string | null;
}

/**
 * FR-PROJ-004: starts a real `request_approval` workflow instance
 * (ticket 0066/0062's seam) rather than inventing a parallel approval
 * mechanism here. The change request only records what was proposed
 * and which instance is deciding it; resolveBaselineChangeRequest
 * reads the outcome back out of that same instance.
 */
export async function proposeBaselineChange(
  repo: ProjectsRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  input: ProposeBaselineChangeInput,
): Promise<ProjectBaselineChangeRequest> {
  if (!input.reason.trim() || !input.impactAnalysis.trim()) {
    throw new MissingBaselineChangeReasonError("a baseline change request requires a non-empty reason and impact analysis");
  }
  const currentBaseline = await requireCurrentBaseline(repo, accessToken, input.projectId);
  const { instance } = await startWorkflowInstance(workflowRepo, accessToken, input.definitionId, input.submittedBy, {
    projectId: input.projectId,
    currentBaselineId: currentBaseline.id,
  });
  return repo.createBaselineChangeRequest(accessToken, {
    project_id: input.projectId,
    current_baseline_id: currentBaseline.id,
    proposed_snapshot: input.proposedSnapshot,
    reason: input.reason,
    impact_analysis: input.impactAnalysis,
    submitted_by: input.submittedBy,
    workflow_instance_id: instance.id,
  });
}

export async function listBaselineChangeRequests(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ProjectBaselineChangeRequest[]> {
  return repo.listBaselineChangeRequests(accessToken, projectId);
}

/**
 * The polling half of the seam: no event bus exists in this codebase,
 * so a change request's outcome is read back on demand by inspecting
 * its workflow instance's step instances for the one whose output
 * carries a `decision` (only a resolved request_approval step's
 * completeStepInstance call ever writes that key — see ticket 0066's
 * decideApprovalStep). Idempotent: once a request is no longer
 * `pending`, this is a no-op read, never re-applies the outcome twice.
 */
export async function resolveBaselineChangeRequest(
  repo: ProjectsRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  requestId: string,
): Promise<ProjectBaselineChangeRequest> {
  const request = await repo.getBaselineChangeRequest(accessToken, requestId);
  if (!request) throw new NotFoundError();
  if (request.status !== "pending") return request;

  const { stepInstances } = await getWorkflowInstance(workflowRepo, accessToken, request.workflow_instance_id);
  const decidedStep = stepInstances.find((s) => typeof s.output?.decision === "string");
  if (!decidedStep) return request;

  const decision = decidedStep.output.decision as string;
  if (decision === "approved") {
    const baselines = await repo.listBaselines(accessToken, request.project_id);
    const nextVersion = Math.max(0, ...baselines.map((b) => b.version)) + 1;
    const newBaseline = await repo.createBaseline(accessToken, {
      project_id: request.project_id,
      version: nextVersion,
      snapshot: request.proposed_snapshot,
      status: "approved",
      created_by: request.submitted_by,
    });
    await repo.updateBaseline(accessToken, request.current_baseline_id, { status: "superseded" });
    const updated = await repo.updateBaselineChangeRequest(accessToken, requestId, {
      status: "approved",
      resulting_baseline_id: newBaseline.id,
    });
    return updated!;
  }

  const updated = await repo.updateBaselineChangeRequest(accessToken, requestId, {
    status: decision as "rejected" | "returned_for_correction",
  });
  return updated!;
}

// ---------------------------------------------------------------------------
// Issue/risk/decision/assumption/dependency/change-request register
// (ticket 0076, M09d)
// ---------------------------------------------------------------------------

export interface CreateRegisterEntryServiceInput {
  projectId: string;
  kind: CreateRegisterEntryInput["kind"];
  title: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  raisedBy: string | null;
  likelihood?: string | null;
  impact?: string | null;
}

/** A `change_request` row here is a logged intent/record only — it never starts a workflow instance itself; ticket 0075 owns FR-PROJ-004's one named approval path. */
export async function createRegisterEntry(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateRegisterEntryServiceInput,
): Promise<ProjectRegisterEntry> {
  return repo.createRegisterEntry(accessToken, {
    project_id: input.projectId,
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    owner_id: input.ownerId ?? null,
    due_date: input.dueDate ?? null,
    raised_by: input.raisedBy,
    likelihood: input.likelihood ?? null,
    impact: input.impact ?? null,
  });
}

export async function listRegisterEntries(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
  filters: ListRegisterEntriesFilters = {},
): Promise<ProjectRegisterEntry[]> {
  return repo.listRegisterEntries(accessToken, projectId, filters);
}

export async function updateRegisterEntry(
  repo: ProjectsRepository,
  accessToken: string,
  entryId: string,
  input: UpdateRegisterEntryInput,
): Promise<ProjectRegisterEntry> {
  const updated = await repo.updateRegisterEntry(accessToken, entryId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}
