import type {
  AddEmployeeCertificationInput,
  AddEmployeeSkillInput,
  AddTrainingRecordInput,
  CreateEmployeeRecordInput,
  CreateProjectAllocationInput,
  UpdateEmployeeRecordInput,
  WorkforceRepository,
} from "./repository.js";
import type {
  EmployeeCertification,
  EmployeeProjectAllocation,
  EmployeeRecord,
  EmployeeSkill,
  TrainingRecord,
} from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createEmployeeRecord(
  repo: WorkforceRepository,
  accessToken: string,
  input: CreateEmployeeRecordInput,
): Promise<EmployeeRecord> {
  return repo.createEmployeeRecord(accessToken, input);
}

export async function updateEmployeeRecord(
  repo: WorkforceRepository,
  accessToken: string,
  employeeId: string,
  input: UpdateEmployeeRecordInput,
): Promise<EmployeeRecord> {
  const updated = await repo.updateEmployeeRecord(accessToken, employeeId, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function deactivateEmployeeRecord(
  repo: WorkforceRepository,
  accessToken: string,
  employeeId: string,
): Promise<EmployeeRecord> {
  const deactivated = await repo.deactivateEmployeeRecord(accessToken, employeeId);
  if (!deactivated) throw new NotFoundError();
  return deactivated;
}

export async function getEmployeeRecord(
  repo: WorkforceRepository,
  accessToken: string,
  employeeId: string,
): Promise<EmployeeRecord> {
  const record = await repo.getEmployeeRecord(accessToken, employeeId);
  if (!record) throw new NotFoundError();
  return record;
}

/** No permission required beyond a valid session — same "is this your own row" exemption as GET /identity/audit-log. */
export async function getOwnEmployeeRecord(
  repo: WorkforceRepository,
  accessToken: string,
): Promise<EmployeeRecord | null> {
  return repo.getOwnEmployeeRecord(accessToken);
}

export async function addEmployeeSkill(
  repo: WorkforceRepository,
  accessToken: string,
  input: AddEmployeeSkillInput,
): Promise<EmployeeSkill> {
  return repo.addEmployeeSkill(accessToken, input);
}

export async function addEmployeeCertification(
  repo: WorkforceRepository,
  accessToken: string,
  input: AddEmployeeCertificationInput,
): Promise<EmployeeCertification> {
  return repo.addEmployeeCertification(accessToken, input);
}

export async function addTrainingRecord(
  repo: WorkforceRepository,
  accessToken: string,
  input: AddTrainingRecordInput,
): Promise<TrainingRecord> {
  return repo.addTrainingRecord(accessToken, input);
}

export async function createProjectAllocation(
  repo: WorkforceRepository,
  accessToken: string,
  input: CreateProjectAllocationInput,
): Promise<EmployeeProjectAllocation> {
  return repo.createProjectAllocation(accessToken, input);
}

export async function listActiveProjectAllocations(
  repo: WorkforceRepository,
  tenantId: string,
  employeeId: string,
  atIso: string = nowIso(),
): Promise<EmployeeProjectAllocation[]> {
  return repo.listActiveProjectAllocations(tenantId, employeeId, atIso);
}

/**
 * The one real business rule this ticket needs (training-validity
 * tracking per the module description). `expiresAt === null` means the
 * certification never expires. Comparison is by calendar date, not
 * time-of-day, since issued_at/expires_at are dates — a certificate
 * expiring "2026-06-01" is no longer valid from the start of that day.
 */
export function isCertificationExpired(expiresAt: string | null, atIso: string = nowIso()): boolean {
  if (expiresAt === null) return false;
  return new Date(atIso).getTime() >= new Date(expiresAt).getTime();
}
