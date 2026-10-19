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
} from "./types.js";

export class PlatformAdminService {
  constructor(private readonly repo: PlatformAdminRepository) {}

  async getTenantSettings(accessToken: string): Promise<TenantSettings> {
    return this.repo.getTenantSettings(accessToken);
  }

  async updateTenantSettings(
    accessToken: string,
    input: UpdateTenantSettingsInput
  ): Promise<TenantSettings> {
    if (input.organization_name !== undefined && input.organization_name.trim().length === 0) {
      throw new Error("Organization name cannot be empty");
    }
    if (input.session_timeout_minutes !== undefined && input.session_timeout_minutes < 5) {
      throw new Error("Session timeout must be at least 5 minutes");
    }
    return this.repo.updateTenantSettings(accessToken, input);
  }

  async listFeatureFlags(accessToken: string): Promise<TenantFeatureFlag[]> {
    return this.repo.listFeatureFlags(accessToken);
  }

  async toggleFeatureFlag(
    accessToken: string,
    flagKey: string,
    isEnabled: boolean,
    updatedBy?: string
  ): Promise<TenantFeatureFlag> {
    if (!flagKey || flagKey.trim().length === 0) {
      throw new Error("Feature flag key is required");
    }
    return this.repo.toggleFeatureFlag(accessToken, flagKey.trim(), isEnabled, updatedBy);
  }

  async listMaintenanceWindows(accessToken: string): Promise<SystemMaintenanceWindow[]> {
    return this.repo.listMaintenanceWindows(accessToken);
  }

  async createMaintenanceWindow(
    accessToken: string,
    input: CreateMaintenanceWindowInput,
    createdBy?: string
  ): Promise<SystemMaintenanceWindow> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error("Maintenance title is required");
    }
    if (!input.message || input.message.trim().length === 0) {
      throw new Error("Maintenance message is required");
    }
    if (!input.starts_at || !input.ends_at) {
      throw new Error("Maintenance start and end timestamps are required");
    }
    return this.repo.createMaintenanceWindow(accessToken, input, createdBy);
  }

  async toggleMaintenanceWindow(
    accessToken: string,
    id: string,
    isActive: boolean
  ): Promise<SystemMaintenanceWindow> {
    return this.repo.toggleMaintenanceWindow(accessToken, id, isActive);
  }

  async listSupportTickets(accessToken: string): Promise<PlatformSupportTicket[]> {
    return this.repo.listSupportTickets(accessToken);
  }

  async createSupportTicket(
    accessToken: string,
    input: CreateSupportTicketInput,
    reportedBy: string
  ): Promise<PlatformSupportTicket> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error("Support ticket title is required");
    }
    if (!input.description || input.description.trim().length === 0) {
      throw new Error("Support ticket description is required");
    }
    return this.repo.createSupportTicket(accessToken, input, reportedBy);
  }

  async resolveSupportTicket(
    accessToken: string,
    id: string,
    input: ResolveSupportTicketInput
  ): Promise<PlatformSupportTicket> {
    if (!input.resolution_notes || input.resolution_notes.trim().length === 0) {
      throw new Error("Resolution notes are required when updating ticket status");
    }
    return this.repo.resolveSupportTicket(accessToken, id, input);
  }

  async getSystemHealth(accessToken: string): Promise<SystemHealthProbe> {
    return this.repo.getSystemHealth(accessToken);
  }
}
