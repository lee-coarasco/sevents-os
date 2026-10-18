export type DprStatus = "draft" | "submitted" | "approved" | "rejected";

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "sunny"
  | "rain"
  | "heavy_rain"
  | "dust_storm"
  | "extreme_heat"
  | "other";

export type WeatherImpact = "none" | "minor_delay" | "work_stoppage";

export type BlockerCategory =
  | "material_shortage"
  | "drawing_delay"
  | "inspection_pending"
  | "access_blocked"
  | "weather"
  | "subcontractor_default"
  | "safety_stop"
  | "other";

export type BlockerStatus = "open" | "resolved";

export type SiteInstructionPriority = "low" | "normal" | "urgent";

export type SiteInstructionStatus = "open" | "in_progress" | "completed" | "acknowledged";

export interface DailyProgressReport {
  id: string;
  tenant_id: string;
  project_id: string;
  report_date: string;
  status: DprStatus;
  weather_condition: WeatherCondition;
  temperature_celsius: number | null;
  weather_impact: WeatherImpact | null;
  general_notes: string | null;
  site_engineer_id: string | null;
  supervisor_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DprManpowerEntry {
  id: string;
  tenant_id: string;
  dpr_id: string;
  trade: string;
  headcount: number;
  hours_worked: number;
  subcontractor_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface DprEquipmentEntry {
  id: string;
  tenant_id: string;
  dpr_id: string;
  equipment_type: string;
  quantity: number;
  operating_hours: number;
  idle_hours: number;
  notes: string | null;
  created_at: string;
}

export interface DprWorkProgressEntry {
  id: string;
  tenant_id: string;
  dpr_id: string;
  schedule_activity_id: string | null;
  location_or_grid: string | null;
  description: string;
  quantity_executed: number | null;
  uom: string | null;
  notes: string | null;
  created_at: string;
}

export interface DprBlocker {
  id: string;
  tenant_id: string;
  dpr_id: string;
  category: BlockerCategory;
  description: string;
  impact_hours: number;
  resolution_action: string | null;
  status: BlockerStatus;
  created_at: string;
}

export interface DprSiteInstruction {
  id: string;
  tenant_id: string;
  project_id: string;
  dpr_id: string | null;
  instruction_number: string;
  issued_by: string;
  recipient: string;
  instruction_text: string;
  priority: SiteInstructionPriority;
  status: SiteInstructionStatus;
  target_completion_date: string | null;
  issued_at: string;
}

export interface DprDetail {
  report: DailyProgressReport;
  manpowerEntries: DprManpowerEntry[];
  equipmentEntries: DprEquipmentEntry[];
  workProgressEntries: DprWorkProgressEntry[];
  blockers: DprBlocker[];
}
