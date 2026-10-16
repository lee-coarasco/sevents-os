import type {
  AddEmployeeCertificationInput,
  AddEmployeeSkillInput,
  AddTrainingRecordInput,
  CreateEmployeeRecordInput,
  CreateProjectAllocationInput,
  UpdateEmployeeRecordInput,
  WorkforceRepository,
} from "../modules/workforce/repository.js";
import type {
  Certification,
  EmployeeCertification,
  EmployeeProjectAllocation,
  EmployeeRecord,
  EmployeeSkill,
  Skill,
  TrainingRecord,
} from "../modules/workforce/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for WorkforceRepository. Mutating/own-tenant reads
 * are keyed off an access token's own session (same convention as
 * FakeAuthorityRepository/FakeTenancyRepository) so "wrong tenant = not
 * found" is actually exercised, not just asserted.
 */
export class FakeWorkforceRepository implements WorkforceRepository {
  sessions = new Map<string, { userId: string; tenantId: string }>();
  employees = new Map<string, EmployeeRecord>();
  skills = new Map<string, Skill>();
  employeeSkills: EmployeeSkill[] = [];
  certifications = new Map<string, Certification>();
  employeeCertifications: EmployeeCertification[] = [];
  trainingRecords: TrainingRecord[] = [];
  allocations = new Map<string, EmployeeProjectAllocation>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private contextOf(accessToken: string) {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context;
  }

  private findOrCreateSkill(tenantId: string, name: string): Skill {
    for (const skill of this.skills.values()) {
      if (skill.tenant_id === tenantId && skill.name === name) return skill;
    }
    const skill: Skill = { id: nextId("skill"), tenant_id: tenantId, name };
    this.skills.set(skill.id, skill);
    return skill;
  }

  private findOrCreateCertification(tenantId: string, name: string, issuingBody: string | null): Certification {
    for (const certification of this.certifications.values()) {
      if (certification.tenant_id === tenantId && certification.name === name) return certification;
    }
    const certification: Certification = { id: nextId("certification"), tenant_id: tenantId, name, issuing_body: issuingBody };
    this.certifications.set(certification.id, certification);
    return certification;
  }

  async createEmployeeRecord(accessToken: string, input: CreateEmployeeRecordInput) {
    const { tenantId } = this.contextOf(accessToken);
    const employee: EmployeeRecord = {
      id: nextId("employee"),
      tenant_id: tenantId,
      company_id: input.company_id,
      app_user_id: input.app_user_id ?? null,
      employee_code: input.employee_code,
      full_name: input.full_name,
      department_id: input.department_id ?? null,
      reporting_role_id: input.reporting_role_id ?? null,
      employment_status: "active",
      emergency_contact_name: input.emergency_contact_name ?? null,
      emergency_contact_phone: input.emergency_contact_phone ?? null,
      onboarded_at: input.onboarded_at ?? null,
      offboarded_at: null,
    };
    this.employees.set(employee.id, employee);
    return employee;
  }

  async updateEmployeeRecord(accessToken: string, employeeId: string, input: UpdateEmployeeRecordInput) {
    const { tenantId } = this.contextOf(accessToken);
    const employee = this.employees.get(employeeId);
    if (!employee || employee.tenant_id !== tenantId) return null;
    const updated: EmployeeRecord = { ...employee, ...input };
    this.employees.set(employeeId, updated);
    return updated;
  }

  async deactivateEmployeeRecord(accessToken: string, employeeId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const employee = this.employees.get(employeeId);
    if (!employee || employee.tenant_id !== tenantId) return null;
    const updated: EmployeeRecord = {
      ...employee,
      employment_status: "offboarded",
      offboarded_at: new Date().toISOString().slice(0, 10),
    };
    this.employees.set(employeeId, updated);
    return updated;
  }

  async getEmployeeRecord(accessToken: string, employeeId: string) {
    const { tenantId } = this.contextOf(accessToken);
    const employee = this.employees.get(employeeId);
    if (!employee || employee.tenant_id !== tenantId) return null;
    return employee;
  }

  async listEmployeeRecords(accessToken: string, filters: { companyId?: string; departmentId?: string }) {
    const { tenantId } = this.contextOf(accessToken);
    const results: EmployeeRecord[] = [];
    for (const employee of this.employees.values()) {
      if (employee.tenant_id !== tenantId) continue;
      if (filters.companyId && employee.company_id !== filters.companyId) continue;
      if (filters.departmentId && employee.department_id !== filters.departmentId) continue;
      results.push(employee);
    }
    return results.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  async getOwnEmployeeRecord(accessToken: string) {
    const { userId, tenantId } = this.contextOf(accessToken);
    for (const employee of this.employees.values()) {
      if (employee.tenant_id === tenantId && employee.app_user_id === userId) return employee;
    }
    return null;
  }

  async addEmployeeSkill(accessToken: string, input: AddEmployeeSkillInput) {
    const { tenantId } = this.contextOf(accessToken);
    const skill = this.findOrCreateSkill(tenantId, input.skillName);
    const employeeSkill: EmployeeSkill = {
      employee_id: input.employeeId,
      skill_id: skill.id,
      tenant_id: tenantId,
      proficiency_note: input.proficiencyNote ?? null,
    };
    this.employeeSkills.push(employeeSkill);
    return employeeSkill;
  }

  async addEmployeeCertification(accessToken: string, input: AddEmployeeCertificationInput) {
    const { tenantId } = this.contextOf(accessToken);
    const certification = this.findOrCreateCertification(tenantId, input.certificationName, input.issuingBody ?? null);
    const employeeCertification: EmployeeCertification = {
      id: nextId("employee-certification"),
      tenant_id: tenantId,
      employee_id: input.employeeId,
      certification_id: certification.id,
      issued_at: input.issuedAt,
      expires_at: input.expiresAt ?? null,
    };
    this.employeeCertifications.push(employeeCertification);
    return employeeCertification;
  }

  async addTrainingRecord(accessToken: string, input: AddTrainingRecordInput) {
    const { tenantId } = this.contextOf(accessToken);
    const trainingRecord: TrainingRecord = {
      id: nextId("training-record"),
      tenant_id: tenantId,
      employee_id: input.employeeId,
      course_name: input.courseName,
      completed_at: input.completedAt,
      result: input.result ?? null,
    };
    this.trainingRecords.push(trainingRecord);
    return trainingRecord;
  }

  async createProjectAllocation(accessToken: string, input: CreateProjectAllocationInput) {
    const { tenantId } = this.contextOf(accessToken);
    const allocation: EmployeeProjectAllocation = {
      id: nextId("allocation"),
      tenant_id: tenantId,
      employee_id: input.employeeId,
      project_id: input.projectId,
      site_assignment: input.siteAssignment ?? null,
      valid_from: input.validFrom ?? new Date().toISOString(),
      valid_to: input.validTo ?? null,
    };
    this.allocations.set(allocation.id, allocation);
    return allocation;
  }

  async listActiveProjectAllocations(tenantId: string, employeeId: string, atIso: string) {
    const results: EmployeeProjectAllocation[] = [];
    for (const allocation of this.allocations.values()) {
      if (
        allocation.tenant_id === tenantId &&
        allocation.employee_id === employeeId &&
        allocation.valid_from <= atIso &&
        (!allocation.valid_to || allocation.valid_to > atIso)
      ) {
        results.push(allocation);
      }
    }
    return results;
  }
}
