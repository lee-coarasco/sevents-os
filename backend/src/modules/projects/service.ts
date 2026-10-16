import type {
  AddScheduleActivityDependencyInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectTypeInput,
  CreateScheduleActivityInput,
  CreateWBSNodeInput,
  ProjectsRepository,
  RecordProgressEntryInput,
  UpdateMilestoneInput,
  UpdateProjectInput,
  UpdateScheduleActivityInput,
  UpdateWBSNodeInput,
} from "./repository.js";
import type {
  Milestone,
  ProgressEntry,
  Project,
  ProjectType,
  ScheduleActivity,
  ScheduleActivityDependency,
  WBSNode,
} from "./types.js";

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
