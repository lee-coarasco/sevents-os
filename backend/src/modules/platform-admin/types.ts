export interface TenantSettings {
  id: string;
  tenant_id: string;
  organization_name: string;
  default_timezone: string;
  default_currency: string;
  fiscal_year_start_month: number;
  storage_quota_gb: number;
  session_timeout_minutes: number;
  mfa_enforced: boolean;
  support_email?: string | null;
  support_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateTenantSettingsInput {
  organization_name?: string;
  default_timezone?: string;
  default_currency?: string;
  fiscal_year_start_month?: number;
  storage_quota_gb?: number;
  session_timeout_minutes?: number;
  mfa_enforced?: boolean;
  support_email?: string;
  support_phone?: string;
}

export interface TenantFeatureFlag {
  id: string;
  tenant_id: string;
  flag_key: string;
  name: string;
  description?: string | null;
  category: string;
  is_enabled: boolean;
  updated_by?: string | null;
  updated_at: string;
  created_at: string;
}

export interface SystemMaintenanceWindow {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaintenanceWindowInput {
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  starts_at: string;
  ends_at: string;
  is_active?: boolean;
}

export type TicketCategory = "bug" | "access" | "data" | "performance" | "general";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface PlatformSupportTicket {
  id: string;
  tenant_id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  reported_by: string;
  assigned_to?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupportTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

export interface ResolveSupportTicketInput {
  status: TicketStatus;
  resolution_notes: string;
  assigned_to?: string;
}

export interface SystemHealthProbe {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  components: {
    database: { status: "up" | "down"; latency_ms: number };
    storage: { status: "up" | "down"; quota_used_gb: number; quota_total_gb: number };
    auth_service: { status: "up" | "down"; mfa_enforced: boolean };
    job_queues: { active_jobs: number; failed_jobs: number; delayed_jobs: number };
  };
}

export interface PlatformAdminRepository {
  getTenantSettings(accessToken: string): Promise<TenantSettings>;
  updateTenantSettings(accessToken: string, input: UpdateTenantSettingsInput): Promise<TenantSettings>;

  listFeatureFlags(accessToken: string): Promise<TenantFeatureFlag[]>;
  toggleFeatureFlag(accessToken: string, flagKey: string, isEnabled: boolean, updatedBy?: string): Promise<TenantFeatureFlag>;

  listMaintenanceWindows(accessToken: string): Promise<SystemMaintenanceWindow[]>;
  createMaintenanceWindow(accessToken: string, input: CreateMaintenanceWindowInput, createdBy?: string): Promise<SystemMaintenanceWindow>;
  toggleMaintenanceWindow(accessToken: string, id: string, isActive: boolean): Promise<SystemMaintenanceWindow>;

  listSupportTickets(accessToken: string): Promise<PlatformSupportTicket[]>;
  createSupportTicket(accessToken: string, input: CreateSupportTicketInput, reportedBy: string): Promise<PlatformSupportTicket>;
  resolveSupportTicket(accessToken: string, id: string, input: ResolveSupportTicketInput): Promise<PlatformSupportTicket>;

  getSystemHealth(accessToken: string): Promise<SystemHealthProbe>;
}
