import type {
  TenantSettings,
  UpdateTenantSettingsInput,
  TenantFeatureFlag,
  SystemMaintenanceWindow,
  CreateMaintenanceWindowInput,
  PlatformSupportTicket,
  CreateSupportTicketInput,
  ResolveSupportTicketInput,
  SystemHealthProbe,
  PlatformAdminRepository,
} from "../modules/platform-admin/types.js";

export class FakePlatformAdminRepository implements PlatformAdminRepository {
  private settings: TenantSettings = {
    id: "settings-1",
    tenant_id: "tenant-1",
    organization_name: "SEVENTS Contracting LLC",
    default_timezone: "Asia/Dubai",
    default_currency: "AED",
    fiscal_year_start_month: 1,
    storage_quota_gb: 100,
    session_timeout_minutes: 60,
    mfa_enforced: false,
    support_email: "support@sevents.ae",
    support_phone: "+971 4 000 0000",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  private flags: TenantFeatureFlag[] = [
    {
      id: "flag-1",
      tenant_id: "tenant-1",
      flag_key: "ai_copilot_enabled",
      name: "AI Copilot & Document Assistant",
      category: "ai",
      description: "Enables conversational AI queries over documents and workflows.",
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "flag-2",
      tenant_id: "tenant-1",
      flag_key: "wps_banking_export",
      name: "WPS Payroll Bank File Export",
      category: "finance",
      description: "Direct generation of UAE SIF bank transfer files.",
      is_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  private maintenanceWindows: SystemMaintenanceWindow[] = [
    {
      id: "maint-1",
      tenant_id: "tenant-1",
      title: "Scheduled Database Maintenance",
      message: "Routine index optimization scheduled for midnight UTC.",
      severity: "info",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: new Date(Date.now() + 90000000).toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  private tickets: PlatformSupportTicket[] = [
    {
      id: "tkt-1",
      tenant_id: "tenant-1",
      ticket_number: "SUP-001001",
      title: "Cannot download certified payment cert PDF",
      description: "Error 500 thrown when generating PDF on IPC-2026-004.",
      category: "bug",
      priority: "high",
      status: "open",
      reported_by: "eng@sevents.ae",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  async getTenantSettings(_accessToken: string): Promise<TenantSettings> {
    return { ...this.settings };
  }

  async updateTenantSettings(_accessToken: string, input: UpdateTenantSettingsInput): Promise<TenantSettings> {
    this.settings = {
      ...this.settings,
      ...input,
      updated_at: new Date().toISOString(),
    };
    return { ...this.settings };
  }

  async listFeatureFlags(_accessToken: string): Promise<TenantFeatureFlag[]> {
    return [...this.flags];
  }

  async toggleFeatureFlag(
    _accessToken: string,
    flagKey: string,
    isEnabled: boolean,
    updatedBy?: string
  ): Promise<TenantFeatureFlag> {
    let flag = this.flags.find((f) => f.flag_key === flagKey);
    if (!flag) {
      flag = {
        id: `flag-${Date.now()}`,
        tenant_id: "tenant-1",
        flag_key: flagKey,
        name: flagKey,
        category: "general",
        is_enabled: isEnabled,
        updated_by: updatedBy || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.flags.push(flag);
    } else {
      flag.is_enabled = isEnabled;
      flag.updated_by = updatedBy || null;
      flag.updated_at = new Date().toISOString();
    }
    return { ...flag };
  }

  async listMaintenanceWindows(_accessToken: string): Promise<SystemMaintenanceWindow[]> {
    return [...this.maintenanceWindows];
  }

  async createMaintenanceWindow(
    _accessToken: string,
    input: CreateMaintenanceWindowInput,
    createdBy?: string
  ): Promise<SystemMaintenanceWindow> {
    const newWin: SystemMaintenanceWindow = {
      id: `maint-${Date.now()}`,
      tenant_id: "tenant-1",
      title: input.title,
      message: input.message,
      severity: input.severity || "info",
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      is_active: input.is_active ?? true,
      created_by: createdBy || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.maintenanceWindows.unshift(newWin);
    return newWin;
  }

  async toggleMaintenanceWindow(
    _accessToken: string,
    id: string,
    isActive: boolean
  ): Promise<SystemMaintenanceWindow> {
    const win = this.maintenanceWindows.find((m) => m.id === id);
    if (!win) throw new Error("Maintenance window not found");
    win.is_active = isActive;
    win.updated_at = new Date().toISOString();
    return { ...win };
  }

  async listSupportTickets(_accessToken: string): Promise<PlatformSupportTicket[]> {
    return [...this.tickets];
  }

  async createSupportTicket(
    _accessToken: string,
    input: CreateSupportTicketInput,
    reportedBy: string
  ): Promise<PlatformSupportTicket> {
    const newTkt: PlatformSupportTicket = {
      id: `tkt-${Date.now()}`,
      tenant_id: "tenant-1",
      ticket_number: `SUP-${Math.floor(100000 + Math.random() * 900000)}`,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "open",
      reported_by: reportedBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tickets.unshift(newTkt);
    return newTkt;
  }

  async resolveSupportTicket(
    _accessToken: string,
    id: string,
    input: ResolveSupportTicketInput
  ): Promise<PlatformSupportTicket> {
    const tkt = this.tickets.find((t) => t.id === id);
    if (!tkt) throw new Error("Support ticket not found");
    tkt.status = input.status;
    tkt.resolution_notes = input.resolution_notes;
    tkt.assigned_to = input.assigned_to || tkt.assigned_to;
    if (input.status === "resolved" || input.status === "closed") {
      tkt.resolved_at = new Date().toISOString();
    }
    tkt.updated_at = new Date().toISOString();
    return { ...tkt };
  }

  async getSystemHealth(_accessToken: string): Promise<SystemHealthProbe> {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      components: {
        database: { status: "up", latency_ms: 10 },
        storage: { status: "up", quota_used_gb: 12.5, quota_total_gb: 100 },
        auth_service: { status: "up", mfa_enforced: false },
        job_queues: { active_jobs: 2, failed_jobs: 0, delayed_jobs: 0 },
      },
    };
  }
}
