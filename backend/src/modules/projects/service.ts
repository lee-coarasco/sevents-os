import type {
  AddScheduleActivityDependencyInput,
  CreateLookaheadActivityInput,
  CreateLookaheadPlanInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectTypeInput,
  CreateRegisterEntryInput,
  CreateScheduleActivityInput,
  CreateScheduleDelayRecordInput,
  CreateWBSNodeInput,
  ListRegisterEntriesFilters,
  ProjectsRepository,
  RecordProgressEntryInput,
  UpdateLookaheadActivityInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
  UpdateProjectTypeInput,
  UpdateRegisterEntryInput,
  UpdateScheduleActivityInput,
  UpdateWBSNodeInput,
} from "./repository.js";
import {
  CLOSEOUT_ITEM_KEYS,
  DELAY_REASON_CATEGORIES,
  REGISTER_ENTRY_KINDS,
  type CloseoutItemKey,
  type DelayReasonCategory,
  type GanttActivity,
  type GanttScheduleResponse,
  type LookaheadActivity,
  type LookaheadPlan,
  type Milestone,
  type ProgressEntry,
  type Project,
  type ProjectBaseline,
  type ProjectBaselineChangeRequest,
  type ProjectBaselineStatus,
  type ProjectCloseoutChecklistItem,
  type ProjectHealthSnapshot,
  type ProjectRegisterEntry,
  type ProjectType,
  type RegisterEntryKind,
  type ScheduleActivity,
  type ScheduleActivityDependency,
  type ScheduleDelayRecord,
  type ScheduleVarianceSummary,
  type WBSNode,
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

export async function updateProjectType(
  repo: ProjectsRepository,
  accessToken: string,
  id: string,
  input: UpdateProjectTypeInput,
): Promise<ProjectType> {
  const updated = await repo.updateProjectType(accessToken, id, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function archiveProjectType(
  repo: ProjectsRepository,
  accessToken: string,
  id: string,
): Promise<ProjectType> {
  const archived = await repo.archiveProjectType(accessToken, id);
  if (!archived) throw new NotFoundError();
  return archived;
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

// ---------------------------------------------------------------------------
// Health, forecast-vs-baseline & closeout checklist (ticket 0077, M09e)
// ---------------------------------------------------------------------------

function maxDate(dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((d): d is string => !!d);
  if (valid.length === 0) return null;
  return valid.reduce((latest, d) => (d > latest ? d : latest));
}

/**
 * FR-PROJ-006: computed from existing recorded data only — overdue
 * schedule activities, overdue/missed milestones, open register
 * entries by kind, and current baseline status. Never a bare AI/ML
 * score; the returned snapshot's `factors` are exactly what fed
 * `summary`. A fresh row is inserted on every call (append-only, same
 * convention as ProgressEntry) — the snapshot's own `computed_at` is
 * the "last refresh time" FR-PROJ-006 asks for.
 */
export async function computeProjectHealth(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
  computedBy: string | null,
): Promise<ProjectHealthSnapshot> {
  const now = new Date().toISOString();
  const [scheduleActivities, milestones, registerEntries, baselines] = await Promise.all([
    repo.listScheduleActivities(accessToken, projectId),
    repo.listMilestones(accessToken, projectId),
    repo.listRegisterEntries(accessToken, projectId, {}),
    repo.listBaselines(accessToken, projectId),
  ]);

  const overdueScheduleActivitiesCount = scheduleActivities.filter(
    (a) => a.planned_end && a.planned_end < now && !a.actual_end,
  ).length;
  const overdueMilestonesCount = milestones.filter((m) => m.status === "pending" && m.target_date < now).length;
  const missedMilestonesCount = milestones.filter((m) => m.status === "missed").length;

  const openRegisterEntryCountsByKind = REGISTER_ENTRY_KINDS.reduce(
    (acc, kind) => {
      acc[kind] = registerEntries.filter(
        (e) => e.kind === kind && (e.status === "open" || e.status === "in_progress"),
      ).length;
      return acc;
    },
    {} as Record<RegisterEntryKind, number>,
  );
  const totalOpenRegisterEntries = Object.values(openRegisterEntryCountsByKind).reduce((a, b) => a + b, 0);

  const currentBaseline = baselines.find((b) => b.status === "approved");
  const pendingBaseline = baselines.find((b) => b.status === "pending_approval");
  const currentBaselineStatus: ProjectBaselineStatus | "none" = currentBaseline
    ? "approved"
    : pendingBaseline
      ? "pending_approval"
      : "none";

  const factors = {
    overdueScheduleActivitiesCount,
    overdueMilestonesCount,
    missedMilestonesCount,
    openRegisterEntryCountsByKind,
    currentBaselineStatus,
  };

  const summary =
    `${overdueScheduleActivitiesCount} overdue schedule activit${overdueScheduleActivitiesCount === 1 ? "y" : "ies"}; ` +
    `${overdueMilestonesCount} overdue and ${missedMilestonesCount} missed milestone(s); ` +
    `${totalOpenRegisterEntries} open register entr${totalOpenRegisterEntries === 1 ? "y" : "ies"}; ` +
    `baseline status: ${currentBaselineStatus}.`;

  return repo.createHealthSnapshot(accessToken, {
    project_id: projectId,
    factors,
    summary,
    computed_by: computedBy,
  });
}

export async function listHealthSnapshots(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ProjectHealthSnapshot[]> {
  return repo.listHealthSnapshots(accessToken, projectId);
}

/**
 * FR-PROJ-007: baseline and forecast are always two distinct, labelled
 * fields — never merged into one value, so a caller can never mistake
 * one for the other. Cost forecast is out of scope here: no
 * cost-actuals tracking exists yet (that's M21, Finance); this ticket
 * only has planned/actual *dates* to derive a naive completion
 * forecast from.
 */
export interface ProjectForecast {
  baseline: {
    baselineId: string | null;
    version: number | null;
    status: ProjectBaselineStatus | null;
    plannedCompletionDate: string | null;
  };
  forecast: {
    projectedCompletionDate: string | null;
    basis: string;
  };
}

export async function getProjectForecast(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ProjectForecast> {
  const baselines = await repo.listBaselines(accessToken, projectId);
  const currentBaseline = baselines.find((b) => b.status === "approved") ?? null;
  const baselineActivities = (currentBaseline?.snapshot?.scheduleActivities as ScheduleActivity[] | undefined) ?? [];
  const baselinePlannedCompletionDate = maxDate(baselineActivities.map((a) => a.planned_end));

  const liveActivities = await repo.listScheduleActivities(accessToken, projectId);
  const projectedCompletionDate = maxDate(liveActivities.map((a) => a.actual_end ?? a.planned_end));

  return {
    baseline: {
      baselineId: currentBaseline?.id ?? null,
      version: currentBaseline?.version ?? null,
      status: currentBaseline?.status ?? null,
      plannedCompletionDate: baselinePlannedCompletionDate,
    },
    forecast: {
      projectedCompletionDate,
      basis: "naive projection: latest of each live schedule activity's actual end date, or planned end date if not yet actualized",
    },
  };
}

/**
 * FR-PROJ-008: ensures all four fixed checklist items exist for a
 * project, creating any missing ones as `pending`. Checks the project
 * is visible to the caller first — this function writes as a side
 * effect of a read, so a cross-tenant projectId must fail closed
 * rather than silently materializing rows that reference a project
 * outside the caller's own tenant.
 */
export async function listCloseoutChecklist(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ProjectCloseoutChecklistItem[]> {
  await getProject(repo, accessToken, projectId);
  const existing = await repo.listCloseoutItems(accessToken, projectId);
  const existingKeys = new Set(existing.map((i) => i.item_key));
  const missing = CLOSEOUT_ITEM_KEYS.filter((key) => !existingKeys.has(key));
  const created = await Promise.all(
    missing.map((item_key) => repo.createCloseoutItem(accessToken, { project_id: projectId, item_key })),
  );
  return [...existing, ...created].sort(
    (a, b) => CLOSEOUT_ITEM_KEYS.indexOf(a.item_key) - CLOSEOUT_ITEM_KEYS.indexOf(b.item_key),
  );
}

/** A record only — completing every item is not a gate on project closure elsewhere, BRD doesn't ask for that gate. */
export async function completeCloseoutItem(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
  itemKey: CloseoutItemKey,
  completedBy: string | null,
): Promise<ProjectCloseoutChecklistItem> {
  await getProject(repo, accessToken, projectId);
  const existing = await repo.listCloseoutItems(accessToken, projectId);
  const current = existing.find((i) => i.item_key === itemKey);
  const now = new Date().toISOString();
  if (!current) {
    return repo.createCloseoutItem(accessToken, {
      project_id: projectId,
      item_key: itemKey,
      status: "complete",
      completed_by: completedBy,
      completed_at: now,
    });
  }
  const updated = await repo.updateCloseoutItem(accessToken, current.id, {
    status: "complete",
    completed_by: completedBy,
    completed_at: now,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

// ---------------------------------------------------------------------------
// Schedule, CPM, Lookahead & Delays (ticket 0120, M18)
// ---------------------------------------------------------------------------

function calculateDurationDays(startStr: string | null, endStr: string | null): number {
  if (!startStr || !endStr) return 1;
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return 1;
  const days = Math.round((end - start) / 86400000);
  return Math.max(1, days);
}

export async function computeGanttSchedule(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<GanttScheduleResponse> {
  await getProject(repo, accessToken, projectId);

  const [activities, wbsNodes, baselines, delayRecords] = await Promise.all([
    repo.listScheduleActivities(accessToken, projectId),
    repo.listWBSNodes(accessToken, projectId),
    repo.listBaselines(accessToken, projectId),
    repo.listScheduleDelayRecords(accessToken, projectId),
  ]);

  const approvedBaseline = baselines.find((b) => b.status === "approved");
  const baselineActivitiesMap = new Map<string, { planned_start: string | null; planned_end: string | null }>();
  if (approvedBaseline && typeof approvedBaseline.snapshot === "object" && approvedBaseline.snapshot !== null) {
    const snap = approvedBaseline.snapshot as { scheduleActivities?: Array<{ id: string; planned_start: string | null; planned_end: string | null }> };
    if (Array.isArray(snap.scheduleActivities)) {
      for (const act of snap.scheduleActivities) {
        baselineActivitiesMap.set(act.id, { planned_start: act.planned_start ?? null, planned_end: act.planned_end ?? null });
      }
    }
  }

  const wbsMap = new Map(wbsNodes.map((w) => [w.id, w]));
  const delayedActivityIds = new Set(delayRecords.map((d) => d.schedule_activity_id));

  // Fetch dependencies for all activities
  const activityDepsMap = new Map<string, string[]>();
  await Promise.all(
    activities.map(async (act) => {
      const deps = await repo.listScheduleActivityDependencies(accessToken, act.id);
      activityDepsMap.set(act.id, deps.map((d) => d.depends_on_activity_id));
    }),
  );

  const validActivityIds = new Set(activities.map((a) => a.id));
  const predsMap = new Map<string, string[]>();
  const succsMap = new Map<string, string[]>();
  for (const act of activities) {
    predsMap.set(act.id, []);
    succsMap.set(act.id, []);
  }

  for (const act of activities) {
    const rawDeps = activityDepsMap.get(act.id) ?? [];
    for (const predId of rawDeps) {
      if (validActivityIds.has(predId) && predId !== act.id) {
        predsMap.get(act.id)!.push(predId);
        succsMap.get(predId)!.push(act.id);
      }
    }
  }

  const now = new Date();
  const durations = new Map<string, number>();
  for (const act of activities) {
    durations.set(act.id, calculateDurationDays(act.planned_start, act.planned_end));
  }

  // Forward Pass (Canonical CPM)
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();
  const inDegree = new Map<string, number>();

  for (const act of activities) {
    const p = predsMap.get(act.id)!;
    inDegree.set(act.id, p.length);
    ES.set(act.id, 0);
    EF.set(act.id, durations.get(act.id)!);
  }

  const forwardQueue: string[] = activities
    .filter((a) => (inDegree.get(a.id) ?? 0) === 0)
    .map((a) => a.id);

  while (forwardQueue.length > 0) {
    const currId = forwardQueue.shift()!;
    const currEF = EF.get(currId)!;

    for (const succId of succsMap.get(currId)!) {
      const existingES = ES.get(succId) ?? 0;
      if (currEF > existingES) {
        ES.set(succId, currEF);
        EF.set(succId, currEF + durations.get(succId)!);
      }
      inDegree.set(succId, (inDegree.get(succId) ?? 1) - 1);
      if (inDegree.get(succId) === 0) {
        forwardQueue.push(succId);
      }
    }
  }

  // Backward Pass (Canonical CPM)
  const maxProjectFinish = activities.length > 0
    ? Math.max(...activities.map((a) => EF.get(a.id) ?? 0))
    : 0;

  const LF = new Map<string, number>();
  const LS = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const act of activities) {
    const s = succsMap.get(act.id)!;
    outDegree.set(act.id, s.length);
    LF.set(act.id, maxProjectFinish);
    LS.set(act.id, maxProjectFinish - durations.get(act.id)!);
  }

  const backwardQueue: string[] = activities
    .filter((a) => (outDegree.get(a.id) ?? 0) === 0)
    .map((a) => a.id);

  while (backwardQueue.length > 0) {
    const currId = backwardQueue.shift()!;
    const currLS = LS.get(currId)!;

    for (const predId of predsMap.get(currId)!) {
      const existingLF = LF.get(predId) ?? maxProjectFinish;
      if (currLS < existingLF) {
        LF.set(predId, currLS);
        LS.set(predId, currLS - durations.get(predId)!);
      }
      outDegree.set(predId, (outDegree.get(predId) ?? 1) - 1);
      if (outDegree.get(predId) === 0) {
        backwardQueue.push(predId);
      }
    }
  }

  const ganttActivities: GanttActivity[] = activities.map((act) => {
    const duration_days = durations.get(act.id) ?? 1;
    const es = ES.get(act.id) ?? 0;
    const ls = LS.get(act.id) ?? es;
    const floatDays = Math.max(0, ls - es);
    const is_critical = floatDays === 0;

    let status: GanttActivity["status"] = "not_started";
    const percent = act.percent_complete ?? 0;
    if (percent >= 100 || act.actual_end) {
      status = "completed";
    } else if (delayedActivityIds.has(act.id)) {
      status = "delayed";
    } else if (act.planned_end && new Date(act.planned_end).getTime() < now.getTime() && percent < 100) {
      status = "delayed";
    } else if (percent > 0 || act.actual_start) {
      status = "in_progress";
    }

    const wbs = act.wbs_node_id ? wbsMap.get(act.wbs_node_id) : undefined;
    const baseSnapshot = baselineActivitiesMap.get(act.id);

    return {
      id: act.id,
      wbs_node_id: act.wbs_node_id,
      wbs_code: wbs?.code ?? null,
      wbs_name: wbs?.name ?? null,
      name: act.name,
      planned_start: act.planned_start,
      planned_end: act.planned_end,
      actual_start: act.actual_start,
      actual_end: act.actual_end,
      baseline_start: baseSnapshot ? baseSnapshot.planned_start : (approvedBaseline ? null : act.planned_start),
      baseline_end: baseSnapshot ? baseSnapshot.planned_end : (approvedBaseline ? null : act.planned_end),
      percent_complete: percent,
      dependencies: activityDepsMap.get(act.id) ?? [],
      is_critical,
      total_float_days: floatDays,
      duration_days,
      status,
    };
  });

  const criticalPath = ganttActivities
    .filter((a) => a.is_critical)
    .sort((a, b) => (ES.get(a.id) ?? 0) - (ES.get(b.id) ?? 0))
    .map((a) => a.id);

  const completedActivities = ganttActivities.filter((a) => a.status === "completed").length;
  const overallProgress = activities.length > 0
    ? Math.round(ganttActivities.reduce((acc, a) => acc + a.percent_complete, 0) / activities.length)
    : 0;

  return {
    project_id: projectId,
    baseline_version: approvedBaseline?.version ?? null,
    activities: ganttActivities,
    critical_path: criticalPath,
    total_activities: activities.length,
    completed_activities: completedActivities,
    overall_progress: overallProgress,
  };
}

export async function createLookaheadPlan(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateLookaheadPlanInput,
): Promise<LookaheadPlan> {
  if (!input.title.trim()) {
    throw new Error("title is required");
  }
  if (input.period_end < input.period_start) {
    throw new Error("period_end must be greater than or equal to period_start");
  }
  await getProject(repo, accessToken, input.project_id);
  return repo.createLookaheadPlan(accessToken, input);
}

export async function listLookaheadPlans(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<LookaheadPlan[]> {
  await getProject(repo, accessToken, projectId);
  return repo.listLookaheadPlans(accessToken, projectId);
}

export async function getLookaheadPlanDetail(
  repo: ProjectsRepository,
  accessToken: string,
  planId: string,
): Promise<{ plan: LookaheadPlan; activities: LookaheadActivity[] }> {
  const plan = await repo.getLookaheadPlan(accessToken, planId);
  if (!plan) throw new NotFoundError();
  const activities = await repo.listLookaheadActivities(accessToken, planId);
  return { plan, activities };
}

export async function createLookaheadActivity(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateLookaheadActivityInput,
): Promise<LookaheadActivity> {
  if (!input.planned_action.trim()) {
    throw new Error("planned_action is required");
  }
  const plan = await repo.getLookaheadPlan(accessToken, input.lookahead_plan_id);
  if (!plan) throw new NotFoundError("lookahead plan not found");
  return repo.createLookaheadActivity(accessToken, input);
}

export async function updateLookaheadActivity(
  repo: ProjectsRepository,
  accessToken: string,
  activityId: string,
  input: UpdateLookaheadActivityInput,
): Promise<LookaheadActivity> {
  const updated = await repo.updateLookaheadActivity(accessToken, activityId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function createScheduleDelayRecord(
  repo: ProjectsRepository,
  accessToken: string,
  input: CreateScheduleDelayRecordInput,
): Promise<ScheduleDelayRecord> {
  if (input.delay_days <= 0) {
    throw new Error("delay_days must be greater than 0");
  }
  if (!input.description.trim()) {
    throw new Error("description is required");
  }
  await getProject(repo, accessToken, input.project_id);
  return repo.createScheduleDelayRecord(accessToken, input);
}

export async function listScheduleDelayRecords(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ScheduleDelayRecord[]> {
  await getProject(repo, accessToken, projectId);
  return repo.listScheduleDelayRecords(accessToken, projectId);
}

export async function getScheduleVariance(
  repo: ProjectsRepository,
  accessToken: string,
  projectId: string,
): Promise<ScheduleVarianceSummary> {
  const gantt = await computeGanttSchedule(repo, accessToken, projectId);
  const delays = await repo.listScheduleDelayRecords(accessToken, projectId);

  const delaysByCategory: Record<DelayReasonCategory, number> = {
    client: 0,
    design: 0,
    procurement: 0,
    subcontractor: 0,
    weather: 0,
    permits: 0,
    other: 0,
  };

  let totalDelayDays = 0;
  const delayedActIds = new Set<string>();
  const criticalDelayedActIds = new Set<string>();
  const criticalSet = new Set(gantt.critical_path);

  for (const d of delays) {
    totalDelayDays += d.delay_days;
    delayedActIds.add(d.schedule_activity_id);
    if (criticalSet.has(d.schedule_activity_id)) {
      criticalDelayedActIds.add(d.schedule_activity_id);
    }
    if (d.reason_category in delaysByCategory) {
      delaysByCategory[d.reason_category] += d.delay_days;
    }
  }

  for (const act of gantt.activities) {
    if (act.status === "delayed") {
      delayedActIds.add(act.id);
      if (act.is_critical) {
        criticalDelayedActIds.add(act.id);
      }
    }
  }

  return {
    project_id: projectId,
    total_activities: gantt.total_activities,
    delayed_activities_count: delayedActIds.size,
    total_delay_days: totalDelayDays,
    critical_delayed_count: criticalDelayedActIds.size,
    delays_by_category: delaysByCategory,
    total_float_consumed_days: totalDelayDays,
  };
}
