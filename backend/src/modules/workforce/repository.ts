import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Certification,
  EmployeeCertification,
  EmployeeProjectAllocation,
  EmployeeRecord,
  EmployeeSkill,
  EmploymentStatus,
  Skill,
  TrainingRecord,
} from "./types.js";

export interface CreateEmployeeRecordInput {
  company_id: string;
  employee_code: string;
  full_name: string;
  app_user_id?: string | null;
  department_id?: string | null;
  reporting_role_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  onboarded_at?: string | null;
}

export interface UpdateEmployeeRecordInput {
  full_name?: string;
  department_id?: string | null;
  reporting_role_id?: string | null;
  employment_status?: EmploymentStatus;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

export interface AddEmployeeSkillInput {
  employeeId: string;
  skillName: string;
  proficiencyNote?: string | null;
}

export interface AddEmployeeCertificationInput {
  employeeId: string;
  certificationName: string;
  issuingBody?: string | null;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface AddTrainingRecordInput {
  employeeId: string;
  courseName: string;
  completedAt: string;
  result?: string | null;
}

export interface CreateProjectAllocationInput {
  employeeId: string;
  projectId: string;
  siteAssignment?: string | null;
  validFrom?: string;
  validTo?: string | null;
  createdBy: string | null;
}

/**
 * Everything the workforce service needs. Mutating/read-your-own-tenant
 * methods take the caller's own access token and go through the
 * user-scoped client, same convention as every other module's
 * Supabase-backed repository — RLS (tenant_id = current_tenant_id()) is
 * the real isolation mechanism, this adapter just has to not bypass it.
 * `listActiveProjectAllocations` takes an explicit tenantId because it
 * needs to answer "is this employee allocated at time T" independent of
 * who is asking, same reasoning as authority's listActiveRoleIds.
 */
export interface WorkforceRepository {
  createEmployeeRecord(accessToken: string, input: CreateEmployeeRecordInput): Promise<EmployeeRecord>;
  updateEmployeeRecord(
    accessToken: string,
    employeeId: string,
    input: UpdateEmployeeRecordInput,
  ): Promise<EmployeeRecord | null>;
  deactivateEmployeeRecord(accessToken: string, employeeId: string): Promise<EmployeeRecord | null>;
  getEmployeeRecord(accessToken: string, employeeId: string): Promise<EmployeeRecord | null>;
  getOwnEmployeeRecord(accessToken: string): Promise<EmployeeRecord | null>;
  addEmployeeSkill(accessToken: string, input: AddEmployeeSkillInput): Promise<EmployeeSkill>;
  addEmployeeCertification(
    accessToken: string,
    input: AddEmployeeCertificationInput,
  ): Promise<EmployeeCertification>;
  addTrainingRecord(accessToken: string, input: AddTrainingRecordInput): Promise<TrainingRecord>;
  createProjectAllocation(
    accessToken: string,
    input: CreateProjectAllocationInput,
  ): Promise<EmployeeProjectAllocation>;
  /** Allocations whose [valid_from, valid_to) window covers `atIso`. */
  listActiveProjectAllocations(
    tenantId: string,
    employeeId: string,
    atIso: string,
  ): Promise<EmployeeProjectAllocation[]>;
}

/**
 * Supabase-backed implementation. Not exercised against a live Supabase
 * project in this session (no reachable credentials in this sandbox,
 * same gap flagged in every prior ticket) — service.test.ts/routes.test.ts
 * cover all business logic through the interface above via
 * FakeWorkforceRepository instead.
 */
export function createSupabaseWorkforceRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): WorkforceRepository {
  async function findOrCreateSkill(client: SupabaseClient, name: string): Promise<Skill> {
    const { data: existing, error: selectError } = await client
      .from("skills")
      .select("*")
      .eq("name", name)
      .maybeSingle();
    if (selectError) throw new Error(`findOrCreateSkill (select): ${selectError.message}`);
    if (existing) return existing as Skill;

    const { data: created, error: insertError } = await client
      .from("skills")
      .insert({ name })
      .select("*")
      .single();
    if (insertError || !created) {
      throw new Error(`findOrCreateSkill (insert): ${insertError?.message ?? "no row returned"}`);
    }
    return created as Skill;
  }

  async function findOrCreateCertification(
    client: SupabaseClient,
    name: string,
    issuingBody: string | null,
  ): Promise<Certification> {
    const { data: existing, error: selectError } = await client
      .from("certifications")
      .select("*")
      .eq("name", name)
      .maybeSingle();
    if (selectError) throw new Error(`findOrCreateCertification (select): ${selectError.message}`);
    if (existing) return existing as Certification;

    const { data: created, error: insertError } = await client
      .from("certifications")
      .insert({ name, issuing_body: issuingBody })
      .select("*")
      .single();
    if (insertError || !created) {
      throw new Error(`findOrCreateCertification (insert): ${insertError?.message ?? "no row returned"}`);
    }
    return created as Certification;
  }

  return {
    async createEmployeeRecord(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("employee_records")
        .insert({
          app_user_id: null,
          department_id: null,
          reporting_role_id: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          onboarded_at: null,
          ...input,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createEmployeeRecord: ${error?.message ?? "no row returned"}`);
      return data as EmployeeRecord;
    },

    async updateEmployeeRecord(accessToken, employeeId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("employee_records")
        .update(input)
        .eq("id", employeeId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateEmployeeRecord: ${error.message}`);
      return (data as EmployeeRecord | null) ?? null;
    },

    async deactivateEmployeeRecord(accessToken, employeeId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("employee_records")
        .update({ employment_status: "offboarded", offboarded_at: new Date().toISOString().slice(0, 10) })
        .eq("id", employeeId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`deactivateEmployeeRecord: ${error.message}`);
      return (data as EmployeeRecord | null) ?? null;
    },

    async getEmployeeRecord(accessToken, employeeId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("employee_records")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw new Error(`getEmployeeRecord: ${error.message}`);
      return (data as EmployeeRecord | null) ?? null;
    },

    async getOwnEmployeeRecord(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData?.user) return null;
      const { data, error } = await client
        .from("employee_records")
        .select("*")
        .eq("app_user_id", authData.user.id)
        .maybeSingle();
      if (error) throw new Error(`getOwnEmployeeRecord: ${error.message}`);
      return (data as EmployeeRecord | null) ?? null;
    },

    async addEmployeeSkill(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const skill = await findOrCreateSkill(client, input.skillName);
      const { data, error } = await client
        .from("employee_skills")
        .insert({
          employee_id: input.employeeId,
          skill_id: skill.id,
          proficiency_note: input.proficiencyNote ?? null,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addEmployeeSkill: ${error?.message ?? "no row returned"}`);
      return data as EmployeeSkill;
    },

    async addEmployeeCertification(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const certification = await findOrCreateCertification(
        client,
        input.certificationName,
        input.issuingBody ?? null,
      );
      const { data, error } = await client
        .from("employee_certifications")
        .insert({
          employee_id: input.employeeId,
          certification_id: certification.id,
          issued_at: input.issuedAt,
          expires_at: input.expiresAt ?? null,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`addEmployeeCertification: ${error?.message ?? "no row returned"}`);
      }
      return data as EmployeeCertification;
    },

    async addTrainingRecord(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("training_records")
        .insert({
          employee_id: input.employeeId,
          course_name: input.courseName,
          completed_at: input.completedAt,
          result: input.result ?? null,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addTrainingRecord: ${error?.message ?? "no row returned"}`);
      return data as TrainingRecord;
    },

    async createProjectAllocation(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("employee_project_allocations")
        .insert({
          employee_id: input.employeeId,
          project_id: input.projectId,
          site_assignment: input.siteAssignment ?? null,
          valid_to: input.validTo ?? null,
          created_by: input.createdBy,
          ...(input.validFrom ? { valid_from: input.validFrom } : {}),
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createProjectAllocation: ${error?.message ?? "no row returned"}`);
      }
      return data as EmployeeProjectAllocation;
    },

    async listActiveProjectAllocations(tenantId, employeeId, atIso) {
      const { data, error } = await serviceClient
        .from("employee_project_allocations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("employee_id", employeeId)
        .lte("valid_from", atIso)
        .or(`valid_to.is.null,valid_to.gt.${atIso}`);
      if (error) throw new Error(`listActiveProjectAllocations: ${error.message}`);
      return (data as EmployeeProjectAllocation[]) ?? [];
    },
  };
}
