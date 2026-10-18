import type { EquipmentRepository } from "./repository.js";
import type {
  EquipmentAsset,
  EquipmentAllocation,
  EquipmentDailyLog,
  EquipmentMaintenanceRecord,
  EquipmentStatutoryCertificate,
  CreateEquipmentAssetInput,
  UpdateEquipmentStatusInput,
  CreateAllocationInput,
  AuthorizeAllocationInput,
  CreateDailyLogInput,
  CreateMaintenanceInput,
  CreateCertificateInput,
} from "./types.js";

export class EquipmentService {
  constructor(private repo: EquipmentRepository) {}

  // Assets
  async listAssets(accessToken: string, category?: string, status?: string): Promise<EquipmentAsset[]> {
    return this.repo.listAssets(accessToken, category, status);
  }

  async getAssetById(accessToken: string, id: string): Promise<EquipmentAsset | null> {
    return this.repo.getAssetById(accessToken, id);
  }

  async createAsset(accessToken: string, input: CreateEquipmentAssetInput): Promise<EquipmentAsset> {
    if (!input.asset_code?.trim()) throw new Error("Asset code is required");
    if (!input.name?.trim()) throw new Error("Asset name is required");
    if (input.daily_rate < 0) throw new Error("Daily rate cannot be negative");

    return this.repo.createAsset(accessToken, input);
  }

  async updateAssetStatus(
    accessToken: string,
    id: string,
    input: UpdateEquipmentStatusInput
  ): Promise<EquipmentAsset> {
    const asset = await this.repo.getAssetById(accessToken, id);
    if (!asset) throw new Error("Asset not found");

    return this.repo.updateAssetStatus(accessToken, id, input);
  }

  // Allocations
  async listAllocations(accessToken: string, projectId?: string, equipmentId?: string): Promise<EquipmentAllocation[]> {
    return this.repo.listAllocations(accessToken, projectId, equipmentId);
  }

  async getAllocationById(accessToken: string, id: string): Promise<EquipmentAllocation | null> {
    return this.repo.getAllocationById(accessToken, id);
  }

  async createAllocation(accessToken: string, input: CreateAllocationInput): Promise<EquipmentAllocation> {
    if (!input.allocation_number?.trim()) throw new Error("Allocation number is required");
    if (!input.equipment_id) throw new Error("Equipment ID is required");
    if (!input.project_id) throw new Error("Project ID is required");

    const asset = await this.repo.getAssetById(accessToken, input.equipment_id);
    if (!asset) throw new Error("Specified equipment does not exist");
    if (asset.status === "breakdown" || asset.status === "decommissioned") {
      throw new Error(`Cannot allocate equipment in '${asset.status}' state`);
    }

    return this.repo.createAllocation(accessToken, input);
  }

  async authorizeAllocation(
    accessToken: string,
    id: string,
    input: AuthorizeAllocationInput
  ): Promise<EquipmentAllocation> {
    const allocation = await this.repo.getAllocationById(accessToken, id);
    if (!allocation) throw new Error("Allocation not found");

    return this.repo.authorizeAllocation(accessToken, id, input);
  }

  // Daily Logs
  async listDailyLogs(accessToken: string, projectId?: string, equipmentId?: string): Promise<EquipmentDailyLog[]> {
    return this.repo.listDailyLogs(accessToken, projectId, equipmentId);
  }

  async createDailyLog(accessToken: string, input: CreateDailyLogInput): Promise<EquipmentDailyLog> {
    if (!input.equipment_id) throw new Error("Equipment ID is required");
    if (!input.operator_name?.trim()) throw new Error("Operator name is required");
    if (!input.work_description?.trim()) throw new Error("Work description is required");
    if (input.end_meter_reading < input.start_meter_reading) {
      throw new Error("End meter reading cannot be lower than start meter reading");
    }

    return this.repo.createDailyLog(accessToken, input);
  }

  // Maintenance
  async listMaintenanceRecords(accessToken: string, equipmentId?: string): Promise<EquipmentMaintenanceRecord[]> {
    return this.repo.listMaintenanceRecords(accessToken, equipmentId);
  }

  async createMaintenanceRecord(
    accessToken: string,
    input: CreateMaintenanceInput
  ): Promise<EquipmentMaintenanceRecord> {
    if (!input.equipment_id) throw new Error("Equipment ID is required");
    if (!input.performed_by?.trim()) throw new Error("Technician or service provider is required");

    const record = await this.repo.createMaintenanceRecord(accessToken, input);

    // If it was a breakdown repair, update asset back to available if ready
    if (input.maintenance_type === "breakdown_repair" && input.status === "completed") {
      await this.repo.updateAssetStatus(accessToken, input.equipment_id, {
        status: "available",
      });
    }

    return record;
  }

  // Statutory Certificates
  async listCertificates(accessToken: string, equipmentId?: string): Promise<EquipmentStatutoryCertificate[]> {
    return this.repo.listCertificates(accessToken, equipmentId);
  }

  async createCertificate(
    accessToken: string,
    input: CreateCertificateInput
  ): Promise<EquipmentStatutoryCertificate> {
    if (!input.equipment_id) throw new Error("Equipment ID is required");
    if (!input.certificate_number?.trim()) throw new Error("Certificate number is required");
    if (!input.issuing_authority?.trim()) throw new Error("Issuing authority is required");
    if (input.expiry_date <= input.issue_date) {
      throw new Error("Certificate expiry date must be after issue date");
    }

    return this.repo.createCertificate(accessToken, input);
  }
}
