export type EquipmentCategory =
  | "heavy_plant"
  | "earthmoving"
  | "lifting_rigging"
  | "power_generation"
  | "fleet_vehicle"
  | "small_tools";

export type OwnershipType = "owned" | "leased" | "hired";

export type EquipmentStatus =
  | "available"
  | "mobilized_on_site"
  | "under_maintenance"
  | "breakdown"
  | "decommissioned";

export type AllocationStatus = "requested" | "approved" | "mobilized" | "demobilized";

export type MaintenanceType =
  | "preventive_service"
  | "breakdown_repair"
  | "safety_inspection"
  | "statutory_certification";

export type MaintenanceStatus = "scheduled" | "completed" | "cancelled";

export type CertificateType =
  | "safe_working_load_3rd_party"
  | "lifting_tackle_inspection"
  | "registration_mulkiya"
  | "insurance_policy"
  | "emission_test";

export type CertificateStatus = "valid" | "expired" | "pending_renewal";

export interface EquipmentAsset {
  id: string;
  tenant_id: string;
  asset_code: string;
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
  year_of_manufacture: number | null;
  serial_or_vin: string | null;
  ownership_type: OwnershipType;
  hire_vendor_name: string | null;
  daily_rate: number;
  status: EquipmentStatus;
  current_meter_hours: number;
  current_project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentAllocation {
  id: string;
  tenant_id: string;
  equipment_id: string;
  project_id: string;
  allocation_number: string;
  mobilization_date: string;
  expected_demobilization_date: string | null;
  actual_demobilization_date: string | null;
  grid_location: string | null;
  status: AllocationStatus;
  requested_by: string;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  equipment?: EquipmentAsset;
}

export interface EquipmentDailyLog {
  id: string;
  tenant_id: string;
  equipment_id: string;
  project_id: string;
  log_date: string;
  operating_hours: number;
  idle_hours: number;
  breakdown_hours: number;
  start_meter_reading: number;
  end_meter_reading: number;
  fuel_added_litres: number;
  operator_name: string;
  work_description: string;
  supervisor_signoff: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentMaintenanceRecord {
  id: string;
  tenant_id: string;
  equipment_id: string;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  meter_hours_at_service: number;
  cost: number;
  performed_by: string;
  description: string;
  next_due_date: string | null;
  next_due_meter_hours: number | null;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
}

export interface EquipmentStatutoryCertificate {
  id: string;
  tenant_id: string;
  equipment_id: string;
  certificate_type: CertificateType;
  certificate_number: string;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  attachment_url: string | null;
  status: CertificateStatus;
  created_at: string;
  updated_at: string;
}

// Input DTOs
export interface CreateEquipmentAssetInput {
  asset_code: string;
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
  year_of_manufacture?: number;
  serial_or_vin?: string;
  ownership_type: OwnershipType;
  hire_vendor_name?: string;
  daily_rate: number;
  current_meter_hours?: number;
  current_project_id?: string;
}

export interface UpdateEquipmentStatusInput {
  status: EquipmentStatus;
  current_project_id?: string | null;
  current_meter_hours?: number;
}

export interface CreateAllocationInput {
  equipment_id: string;
  project_id: string;
  allocation_number: string;
  mobilization_date: string;
  expected_demobilization_date?: string;
  grid_location?: string;
  requested_by: string;
  notes?: string;
}

export interface AuthorizeAllocationInput {
  status: "approved" | "mobilized" | "demobilized";
  approved_by: string;
  actual_demobilization_date?: string;
}

export interface CreateDailyLogInput {
  equipment_id: string;
  project_id: string;
  log_date: string;
  operating_hours: number;
  idle_hours?: number;
  breakdown_hours?: number;
  start_meter_reading: number;
  end_meter_reading: number;
  fuel_added_litres?: number;
  operator_name: string;
  work_description: string;
  supervisor_signoff?: string;
}

export interface CreateMaintenanceInput {
  equipment_id: string;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  meter_hours_at_service: number;
  cost: number;
  performed_by: string;
  description: string;
  next_due_date?: string;
  next_due_meter_hours?: number;
  status?: MaintenanceStatus;
}

export interface CreateCertificateInput {
  equipment_id: string;
  certificate_type: CertificateType;
  certificate_number: string;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  attachment_url?: string;
}
