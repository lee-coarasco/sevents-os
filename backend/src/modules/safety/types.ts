export type PermitType =
  | "hot_work"
  | "working_at_height"
  | "confined_space"
  | "lifting_operations"
  | "deep_excavation"
  | "electrical_isolation";

export type PermitStatus = "draft" | "pending_approval" | "active" | "suspended" | "closed" | "cancelled";

export type IncidentType =
  | "near_miss"
  | "first_aid"
  | "medical_treatment"
  | "lost_time_injury"
  | "dangerous_occurrence"
  | "environmental_spill";

export type IncidentSeverity = "minor" | "moderate" | "major" | "critical" | "fatal";
export type IncidentStatus = "reported" | "under_investigation" | "capa_assigned" | "closed";

export type ObservationType = "unsafe_condition" | "unsafe_act" | "positive_intervention";
export type RiskLevel = "low" | "medium" | "high" | "imminent_danger";
export type HazardStatus = "open" | "in_progress" | "rectified" | "closed";

export type TradeDiscipline = "civil" | "mep" | "structural" | "finishes" | "piling" | "facade" | "general";

export interface SafetyPermitToWork {
  id: string;
  tenant_id: string;
  project_id: string;
  permit_number: string;
  permit_type: PermitType;
  title: string;
  location_or_grid: string;
  start_time: string;
  expiry_time: string;
  status: PermitStatus;
  contractor_name: string;
  supervisor_name: string;
  safety_officer_name: string | null;
  precautions_taken: string | null;
  gas_test_required: boolean;
  gas_test_results: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyIncident {
  id: string;
  tenant_id: string;
  project_id: string;
  incident_number: string;
  incident_date: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location_or_grid: string;
  description: string;
  injured_person_name: string | null;
  injury_details: string | null;
  lost_workdays: number;
  immediate_action_taken: string | null;
  root_cause_analysis: string | null;
  corrective_preventive_action: string | null;
  reported_by: string;
  investigated_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyHazardObservation {
  id: string;
  tenant_id: string;
  project_id: string;
  observation_number: string;
  observation_type: ObservationType;
  risk_level: RiskLevel;
  stop_work_issued: boolean;
  location_or_grid: string;
  description: string;
  action_required: string;
  status: HazardStatus;
  reported_by: string;
  assigned_to: string | null;
  rectification_evidence: string | null;
  target_rectification_date: string | null;
  rectified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyToolboxTalk {
  id: string;
  tenant_id: string;
  project_id: string;
  tbt_number: string;
  talk_date: string;
  topic: string;
  conducted_by: string;
  trade_discipline: TradeDiscipline;
  attendee_count: number;
  key_points_discussed: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// DTOs / Inputs
export interface CreatePermitInput {
  project_id: string;
  permit_number: string;
  permit_type: PermitType;
  title: string;
  location_or_grid: string;
  start_time: string;
  expiry_time: string;
  contractor_name: string;
  supervisor_name: string;
  precautions_taken?: string;
  gas_test_required?: boolean;
  gas_test_results?: string;
}

export interface AuthorizePermitInput {
  status: "active" | "suspended" | "closed" | "cancelled";
  safety_officer_name: string;
  precautions_taken?: string;
}

export interface CreateIncidentInput {
  project_id: string;
  incident_number: string;
  incident_date?: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  location_or_grid: string;
  description: string;
  injured_person_name?: string;
  injury_details?: string;
  lost_workdays?: number;
  immediate_action_taken?: string;
  reported_by: string;
}

export interface InvestigateIncidentInput {
  investigated_by: string;
  root_cause_analysis: string;
  corrective_preventive_action: string;
  lost_workdays?: number;
  status?: "under_investigation" | "capa_assigned";
}

export interface CloseIncidentInput {
  closed_by: string;
}

export interface CreateHazardInput {
  project_id: string;
  observation_number: string;
  observation_type: ObservationType;
  risk_level: RiskLevel;
  stop_work_issued?: boolean;
  location_or_grid: string;
  description: string;
  action_required: string;
  reported_by: string;
  assigned_to?: string;
  target_rectification_date?: string;
}

export interface RectifyHazardInput {
  rectification_evidence: string;
  status: "rectified" | "closed";
}

export interface CreateToolboxTalkInput {
  project_id: string;
  tbt_number: string;
  talk_date?: string;
  topic: string;
  conducted_by: string;
  trade_discipline: TradeDiscipline;
  attendee_count: number;
  key_points_discussed?: string;
  notes?: string;
}
