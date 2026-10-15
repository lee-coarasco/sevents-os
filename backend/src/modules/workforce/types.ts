export type EmploymentStatus = "active" | "on_leave" | "suspended" | "offboarded";

export interface EmployeeRecord {
  id: string;
  tenant_id: string;
  company_id: string;
  app_user_id: string | null;
  employee_code: string;
  full_name: string;
  department_id: string | null;
  reporting_role_id: string | null;
  employment_status: EmploymentStatus;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  onboarded_at: string | null;
  offboarded_at: string | null;
}

export interface Skill {
  id: string;
  tenant_id: string;
  name: string;
}

export interface EmployeeSkill {
  employee_id: string;
  skill_id: string;
  tenant_id: string;
  proficiency_note: string | null;
}

export interface Certification {
  id: string;
  tenant_id: string;
  name: string;
  issuing_body: string | null;
}

export interface EmployeeCertification {
  id: string;
  tenant_id: string;
  employee_id: string;
  certification_id: string;
  issued_at: string;
  expires_at: string | null;
}

export interface TrainingRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  course_name: string;
  completed_at: string;
  result: string | null;
}

export interface EmployeeProjectAllocation {
  id: string;
  tenant_id: string;
  employee_id: string;
  project_id: string;
  site_assignment: string | null;
  valid_from: string;
  valid_to: string | null;
}
