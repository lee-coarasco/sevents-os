import type {
  AddBlockerInput,
  AddEquipmentEntryInput,
  AddManpowerEntryInput,
  AddWorkProgressEntryInput,
  CreateDprInput,
  CreateSiteInstructionInput,
  SiteRepository,
  UpdateBlockerInput,
  UpdateDprInput,
  UpdateSiteInstructionInput,
} from "./repository.js";
import type {
  DailyProgressReport,
  DprBlocker,
  DprDetail,
  DprEquipmentEntry,
  DprManpowerEntry,
  DprSiteInstruction,
  DprStatus,
  DprWorkProgressEntry,
  SiteInstructionPriority,
  SiteInstructionStatus,
} from "./types.js";

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ---- DPR Lifecycle --------------------------------------------------------

export async function createDpr(
  repo: SiteRepository,
  accessToken: string,
  input: CreateDprInput,
): Promise<DailyProgressReport> {
  if (!input.project_id || !input.report_date) {
    throw new ValidationError("project_id and report_date are required");
  }
  // Check date pattern YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.report_date)) {
    throw new ValidationError("report_date must be in YYYY-MM-DD format");
  }
  return repo.createDpr(accessToken, input);
}

export async function getDpr(
  repo: SiteRepository,
  accessToken: string,
  id: string,
): Promise<DailyProgressReport> {
  const dpr = await repo.getDpr(accessToken, id);
  if (!dpr) throw new NotFoundError("DailyProgressReport", id);
  return dpr;
}

export async function getDprDetail(
  repo: SiteRepository,
  accessToken: string,
  id: string,
): Promise<DprDetail> {
  const dpr = await getDpr(repo, accessToken, id);
  const [manpowerEntries, equipmentEntries, workProgressEntries, blockers] = await Promise.all([
    repo.listManpowerEntries(accessToken, id),
    repo.listEquipmentEntries(accessToken, id),
    repo.listWorkProgressEntries(accessToken, id),
    repo.listBlockers(accessToken, id),
  ]);

  return {
    report: dpr,
    manpowerEntries,
    equipmentEntries,
    workProgressEntries,
    blockers,
  };
}

export async function listDprs(
  repo: SiteRepository,
  accessToken: string,
  projectId: string,
  filters?: { status?: DprStatus; fromDate?: string; toDate?: string },
): Promise<DailyProgressReport[]> {
  return repo.listDprs(accessToken, projectId, filters);
}

export async function updateDpr(
  repo: SiteRepository,
  accessToken: string,
  id: string,
  input: UpdateDprInput,
): Promise<DailyProgressReport> {
  const existing = await getDpr(repo, accessToken, id);
  if (existing.status === "approved") {
    throw new InvalidStateError("Approved DPRs cannot be modified");
  }
  const updated = await repo.updateDpr(accessToken, id, input);
  if (!updated) throw new NotFoundError("DailyProgressReport", id);
  return updated;
}

export async function deleteDpr(
  repo: SiteRepository,
  accessToken: string,
  id: string,
): Promise<void> {
  const existing = await getDpr(repo, accessToken, id);
  if (existing.status !== "draft") {
    throw new InvalidStateError(`Only draft DPRs can be deleted (current status: ${existing.status})`);
  }
  await repo.deleteDpr(accessToken, id);
}

export async function submitDpr(
  repo: SiteRepository,
  accessToken: string,
  id: string,
): Promise<DailyProgressReport> {
  const existing = await getDpr(repo, accessToken, id);
  if (existing.status !== "draft" && existing.status !== "rejected") {
    throw new InvalidStateError(`Only draft or rejected DPRs can be submitted (current status: ${existing.status})`);
  }
  const updated = await repo.updateDpr(accessToken, id, {
    status: "submitted",
    rejection_reason: null,
  });
  if (!updated) throw new NotFoundError("DailyProgressReport", id);
  return updated;
}

export async function approveDpr(
  repo: SiteRepository,
  accessToken: string,
  id: string,
  approvedBy: string,
): Promise<DailyProgressReport> {
  const existing = await getDpr(repo, accessToken, id);
  if (existing.status !== "submitted") {
    throw new InvalidStateError(`Only submitted DPRs can be approved (current status: ${existing.status})`);
  }
  const now = new Date().toISOString();
  const updated = await repo.updateDpr(accessToken, id, {
    status: "approved",
    approved_at: now,
    approved_by: approvedBy,
    rejection_reason: null,
  });
  if (!updated) throw new NotFoundError("DailyProgressReport", id);
  return updated;
}

export async function rejectDpr(
  repo: SiteRepository,
  accessToken: string,
  id: string,
  rejectionReason: string,
): Promise<DailyProgressReport> {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new ValidationError("Rejection reason is required");
  }
  const existing = await getDpr(repo, accessToken, id);
  if (existing.status !== "submitted") {
    throw new InvalidStateError(`Only submitted DPRs can be rejected (current status: ${existing.status})`);
  }
  const updated = await repo.updateDpr(accessToken, id, {
    status: "rejected",
    rejection_reason: rejectionReason.trim(),
  });
  if (!updated) throw new NotFoundError("DailyProgressReport", id);
  return updated;
}

// ---- DPR Child Entries ----------------------------------------------------

export async function addManpowerEntry(
  repo: SiteRepository,
  accessToken: string,
  input: AddManpowerEntryInput,
): Promise<DprManpowerEntry> {
  const dpr = await getDpr(repo, accessToken, input.dpr_id);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot add manpower to an approved DPR");
  }
  if (!input.trade || !input.trade.trim()) {
    throw new ValidationError("Trade is required");
  }
  if (input.headcount === undefined || input.headcount < 0) {
    throw new ValidationError("Headcount must be greater than or equal to 0");
  }
  return repo.addManpowerEntry(accessToken, input);
}

export async function removeManpowerEntry(
  repo: SiteRepository,
  accessToken: string,
  dprId: string,
  entryId: string,
): Promise<void> {
  const dpr = await getDpr(repo, accessToken, dprId);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot remove manpower from an approved DPR");
  }
  const removed = await repo.removeManpowerEntry(accessToken, entryId);
  if (!removed) throw new NotFoundError("DprManpowerEntry", entryId);
}

export async function addEquipmentEntry(
  repo: SiteRepository,
  accessToken: string,
  input: AddEquipmentEntryInput,
): Promise<DprEquipmentEntry> {
  const dpr = await getDpr(repo, accessToken, input.dpr_id);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot add equipment to an approved DPR");
  }
  if (!input.equipment_type || !input.equipment_type.trim()) {
    throw new ValidationError("Equipment type is required");
  }
  if (input.quantity !== undefined && input.quantity <= 0) {
    throw new ValidationError("Quantity must be greater than 0");
  }
  return repo.addEquipmentEntry(accessToken, input);
}

export async function removeEquipmentEntry(
  repo: SiteRepository,
  accessToken: string,
  dprId: string,
  entryId: string,
): Promise<void> {
  const dpr = await getDpr(repo, accessToken, dprId);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot remove equipment from an approved DPR");
  }
  const removed = await repo.removeEquipmentEntry(accessToken, entryId);
  if (!removed) throw new NotFoundError("DprEquipmentEntry", entryId);
}

export async function addWorkProgressEntry(
  repo: SiteRepository,
  accessToken: string,
  input: AddWorkProgressEntryInput,
): Promise<DprWorkProgressEntry> {
  const dpr = await getDpr(repo, accessToken, input.dpr_id);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot add work progress to an approved DPR");
  }
  if (!input.description || !input.description.trim()) {
    throw new ValidationError("Description is required");
  }
  return repo.addWorkProgressEntry(accessToken, input);
}

export async function removeWorkProgressEntry(
  repo: SiteRepository,
  accessToken: string,
  dprId: string,
  entryId: string,
): Promise<void> {
  const dpr = await getDpr(repo, accessToken, dprId);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot remove work progress from an approved DPR");
  }
  const removed = await repo.removeWorkProgressEntry(accessToken, entryId);
  if (!removed) throw new NotFoundError("DprWorkProgressEntry", entryId);
}

export async function addBlocker(
  repo: SiteRepository,
  accessToken: string,
  input: AddBlockerInput,
): Promise<DprBlocker> {
  const dpr = await getDpr(repo, accessToken, input.dpr_id);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot add blocker to an approved DPR");
  }
  if (!input.category || !input.description || !input.description.trim()) {
    throw new ValidationError("Category and description are required");
  }
  return repo.addBlocker(accessToken, input);
}

export async function updateBlocker(
  repo: SiteRepository,
  accessToken: string,
  id: string,
  input: UpdateBlockerInput,
): Promise<DprBlocker> {
  const updated = await repo.updateBlocker(accessToken, id, input);
  if (!updated) throw new NotFoundError("DprBlocker", id);
  return updated;
}

export async function removeBlocker(
  repo: SiteRepository,
  accessToken: string,
  dprId: string,
  blockerId: string,
): Promise<void> {
  const dpr = await getDpr(repo, accessToken, dprId);
  if (dpr.status === "approved") {
    throw new InvalidStateError("Cannot remove blocker from an approved DPR");
  }
  const removed = await repo.removeBlocker(accessToken, blockerId);
  if (!removed) throw new NotFoundError("DprBlocker", blockerId);
}

// ---- Site Instructions ----------------------------------------------------

export async function createSiteInstruction(
  repo: SiteRepository,
  accessToken: string,
  input: CreateSiteInstructionInput,
): Promise<DprSiteInstruction> {
  if (!input.project_id || !input.instruction_number || !input.issued_by || !input.recipient || !input.instruction_text) {
    throw new ValidationError("project_id, instruction_number, issued_by, recipient, and instruction_text are required");
  }
  return repo.createSiteInstruction(accessToken, input);
}

export async function getSiteInstruction(
  repo: SiteRepository,
  accessToken: string,
  id: string,
): Promise<DprSiteInstruction> {
  const instruction = await repo.getSiteInstruction(accessToken, id);
  if (!instruction) throw new NotFoundError("DprSiteInstruction", id);
  return instruction;
}

export async function listSiteInstructions(
  repo: SiteRepository,
  accessToken: string,
  projectId: string,
  filters?: { status?: SiteInstructionStatus; priority?: SiteInstructionPriority },
): Promise<DprSiteInstruction[]> {
  return repo.listSiteInstructions(accessToken, projectId, filters);
}

export async function updateSiteInstruction(
  repo: SiteRepository,
  accessToken: string,
  id: string,
  input: UpdateSiteInstructionInput,
): Promise<DprSiteInstruction> {
  const updated = await repo.updateSiteInstruction(accessToken, id, input);
  if (!updated) throw new NotFoundError("DprSiteInstruction", id);
  return updated;
}
