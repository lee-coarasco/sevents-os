import type { EquipmentRepository } from "../modules/equipment/repository.js";
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
} from "../modules/equipment/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeEquipmentRepository implements EquipmentRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  assets = new Map<string, EquipmentAsset>();
  allocations = new Map<string, EquipmentAllocation>();
  dailyLogs = new Map<string, EquipmentDailyLog>();
  maintenanceRecords = new Map<string, EquipmentMaintenanceRecord>();
  certificates = new Map<string, EquipmentStatutoryCertificate>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  // Assets
  async listAssets(accessToken: string, category?: string, status?: string): Promise<EquipmentAsset[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.assets.values()).filter((a) => {
      if (a.tenant_id !== tenantId) return false;
      if (category && a.category !== category) return false;
      if (status && a.status !== status) return false;
      return true;
    });
  }

  async getAssetById(accessToken: string, id: string): Promise<EquipmentAsset | null> {
    const tenantId = this.tenantOf(accessToken);
    const asset = this.assets.get(id);
    if (!asset || asset.tenant_id !== tenantId) return null;
    return asset;
  }

  async createAsset(accessToken: string, input: CreateEquipmentAssetInput): Promise<EquipmentAsset> {
    const tenantId = this.tenantOf(accessToken);
    for (const a of this.assets.values()) {
      if (a.tenant_id === tenantId && a.asset_code === input.asset_code) {
        throw new Error(`Asset code ${input.asset_code} already exists for this tenant`);
      }
    }

    const id = nextId("asset");
    const asset: EquipmentAsset = {
      id,
      tenant_id: tenantId,
      asset_code: input.asset_code,
      name: input.name,
      category: input.category,
      make: input.make,
      model: input.model,
      year_of_manufacture: input.year_of_manufacture || null,
      serial_or_vin: input.serial_or_vin || null,
      ownership_type: input.ownership_type,
      hire_vendor_name: input.hire_vendor_name || null,
      daily_rate: input.daily_rate,
      status: input.current_project_id ? "mobilized_on_site" : "available",
      current_meter_hours: input.current_meter_hours || 0,
      current_project_id: input.current_project_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.assets.set(id, asset);
    return asset;
  }

  async updateAssetStatus(
    accessToken: string,
    id: string,
    input: UpdateEquipmentStatusInput
  ): Promise<EquipmentAsset> {
    const tenantId = this.tenantOf(accessToken);
    const asset = this.assets.get(id);
    if (!asset || asset.tenant_id !== tenantId) throw new Error("Equipment asset not found");

    asset.status = input.status;
    if (input.current_project_id !== undefined) {
      asset.current_project_id = input.current_project_id;
    }
    if (input.current_meter_hours !== undefined) {
      asset.current_meter_hours = input.current_meter_hours;
    }
    asset.updated_at = new Date().toISOString();
    return asset;
  }

  // Allocations
  async listAllocations(accessToken: string, projectId?: string, equipmentId?: string): Promise<EquipmentAllocation[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.allocations.values())
      .filter((al) => {
        if (al.tenant_id !== tenantId) return false;
        if (projectId && al.project_id !== projectId) return false;
        if (equipmentId && al.equipment_id !== equipmentId) return false;
        return true;
      })
      .map((al) => ({
        ...al,
        equipment: this.assets.get(al.equipment_id),
      }));
  }

  async getAllocationById(accessToken: string, id: string): Promise<EquipmentAllocation | null> {
    const tenantId = this.tenantOf(accessToken);
    const al = this.allocations.get(id);
    if (!al || al.tenant_id !== tenantId) return null;
    return {
      ...al,
      equipment: this.assets.get(al.equipment_id),
    };
  }

  async createAllocation(accessToken: string, input: CreateAllocationInput): Promise<EquipmentAllocation> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("alloc");
    const allocation: EquipmentAllocation = {
      id,
      tenant_id: tenantId,
      equipment_id: input.equipment_id,
      project_id: input.project_id,
      allocation_number: input.allocation_number,
      mobilization_date: input.mobilization_date,
      expected_demobilization_date: input.expected_demobilization_date || null,
      actual_demobilization_date: null,
      grid_location: input.grid_location || null,
      status: "requested",
      requested_by: input.requested_by,
      approved_by: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      equipment: this.assets.get(input.equipment_id),
    };
    this.allocations.set(id, allocation);
    return allocation;
  }

  async authorizeAllocation(
    accessToken: string,
    id: string,
    input: AuthorizeAllocationInput
  ): Promise<EquipmentAllocation> {
    const tenantId = this.tenantOf(accessToken);
    const alloc = this.allocations.get(id);
    if (!alloc || alloc.tenant_id !== tenantId) throw new Error("Equipment allocation not found");

    alloc.status = input.status;
    alloc.approved_by = input.approved_by;
    if (input.actual_demobilization_date) {
      alloc.actual_demobilization_date = input.actual_demobilization_date;
    }
    alloc.updated_at = new Date().toISOString();

    // Auto-update asset status
    const asset = this.assets.get(alloc.equipment_id);
    if (asset && asset.tenant_id === tenantId) {
      if (input.status === "mobilized") {
        asset.status = "mobilized_on_site";
        asset.current_project_id = alloc.project_id;
      } else if (input.status === "demobilized") {
        asset.status = "available";
        asset.current_project_id = null;
      }
    }

    return {
      ...alloc,
      equipment: asset,
    };
  }

  // Daily Logs
  async listDailyLogs(accessToken: string, projectId?: string, equipmentId?: string): Promise<EquipmentDailyLog[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.dailyLogs.values()).filter((log) => {
      if (log.tenant_id !== tenantId) return false;
      if (projectId && log.project_id !== projectId) return false;
      if (equipmentId && log.equipment_id !== equipmentId) return false;
      return true;
    });
  }

  async createDailyLog(accessToken: string, input: CreateDailyLogInput): Promise<EquipmentDailyLog> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("log");
    const log: EquipmentDailyLog = {
      id,
      tenant_id: tenantId,
      equipment_id: input.equipment_id,
      project_id: input.project_id,
      log_date: input.log_date,
      operating_hours: input.operating_hours,
      idle_hours: input.idle_hours || 0,
      breakdown_hours: input.breakdown_hours || 0,
      start_meter_reading: input.start_meter_reading,
      end_meter_reading: input.end_meter_reading,
      fuel_added_litres: input.fuel_added_litres || 0,
      operator_name: input.operator_name,
      work_description: input.work_description,
      supervisor_signoff: input.supervisor_signoff || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.dailyLogs.set(id, log);

    // Update asset running meter reading
    const asset = this.assets.get(input.equipment_id);
    if (asset && asset.tenant_id === tenantId && input.end_meter_reading > asset.current_meter_hours) {
      asset.current_meter_hours = input.end_meter_reading;
    }

    return log;
  }

  // Maintenance
  async listMaintenanceRecords(accessToken: string, equipmentId?: string): Promise<EquipmentMaintenanceRecord[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.maintenanceRecords.values()).filter((m) => {
      if (m.tenant_id !== tenantId) return false;
      if (equipmentId && m.equipment_id !== equipmentId) return false;
      return true;
    });
  }

  async createMaintenanceRecord(
    accessToken: string,
    input: CreateMaintenanceInput
  ): Promise<EquipmentMaintenanceRecord> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("maint");
    const record: EquipmentMaintenanceRecord = {
      id,
      tenant_id: tenantId,
      equipment_id: input.equipment_id,
      maintenance_type: input.maintenance_type,
      maintenance_date: input.maintenance_date,
      meter_hours_at_service: input.meter_hours_at_service,
      cost: input.cost,
      performed_by: input.performed_by,
      description: input.description,
      next_due_date: input.next_due_date || null,
      next_due_meter_hours: input.next_due_meter_hours || null,
      status: input.status || "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.maintenanceRecords.set(id, record);
    return record;
  }

  // Certificates
  async listCertificates(accessToken: string, equipmentId?: string): Promise<EquipmentStatutoryCertificate[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.certificates.values()).filter((c) => {
      if (c.tenant_id !== tenantId) return false;
      if (equipmentId && c.equipment_id !== equipmentId) return false;
      return true;
    });
  }

  async createCertificate(
    accessToken: string,
    input: CreateCertificateInput
  ): Promise<EquipmentStatutoryCertificate> {
    const tenantId = this.tenantOf(accessToken);
    const today = new Date().toISOString().slice(0, 10);
    const status = input.expiry_date < today ? "expired" : "valid";

    const id = nextId("cert");
    const cert: EquipmentStatutoryCertificate = {
      id,
      tenant_id: tenantId,
      equipment_id: input.equipment_id,
      certificate_type: input.certificate_type,
      certificate_number: input.certificate_number,
      issuing_authority: input.issuing_authority,
      issue_date: input.issue_date,
      expiry_date: input.expiry_date,
      attachment_url: input.attachment_url || null,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.certificates.set(id, cert);
    return cert;
  }
}
