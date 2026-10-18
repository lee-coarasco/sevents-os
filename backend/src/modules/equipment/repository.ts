import type { SupabaseClient } from "@supabase/supabase-js";
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

export interface EquipmentRepository {
  // Assets
  listAssets(accessToken: string, category?: string, status?: string): Promise<EquipmentAsset[]>;
  getAssetById(accessToken: string, id: string): Promise<EquipmentAsset | null>;
  createAsset(accessToken: string, input: CreateEquipmentAssetInput): Promise<EquipmentAsset>;
  updateAssetStatus(accessToken: string, id: string, input: UpdateEquipmentStatusInput): Promise<EquipmentAsset>;

  // Allocations
  listAllocations(accessToken: string, projectId?: string, equipmentId?: string): Promise<EquipmentAllocation[]>;
  getAllocationById(accessToken: string, id: string): Promise<EquipmentAllocation | null>;
  createAllocation(accessToken: string, input: CreateAllocationInput): Promise<EquipmentAllocation>;
  authorizeAllocation(accessToken: string, id: string, input: AuthorizeAllocationInput): Promise<EquipmentAllocation>;

  // Daily Logs
  listDailyLogs(accessToken: string, projectId?: string, equipmentId?: string): Promise<EquipmentDailyLog[]>;
  createDailyLog(accessToken: string, input: CreateDailyLogInput): Promise<EquipmentDailyLog>;

  // Maintenance
  listMaintenanceRecords(accessToken: string, equipmentId?: string): Promise<EquipmentMaintenanceRecord[]>;
  createMaintenanceRecord(accessToken: string, input: CreateMaintenanceInput): Promise<EquipmentMaintenanceRecord>;

  // Certificates
  listCertificates(accessToken: string, equipmentId?: string): Promise<EquipmentStatutoryCertificate[]>;
  createCertificate(accessToken: string, input: CreateCertificateInput): Promise<EquipmentStatutoryCertificate>;
}

export function createSupabaseEquipmentRepository(
  getClient: (token: string) => SupabaseClient
): EquipmentRepository {
  return {
    async listAssets(accessToken: string, category?: string, status?: string): Promise<EquipmentAsset[]> {
      const client = getClient(accessToken);
      let query = client.from("equipment_assets").select("*").order("asset_code", { ascending: true });
      if (category) query = query.eq("category", category);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    async getAssetById(accessToken: string, id: string): Promise<EquipmentAsset | null> {
      const client = getClient(accessToken);
      const { data, error } = await client.from("equipment_assets").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },

    async createAsset(accessToken: string, input: CreateEquipmentAssetInput): Promise<EquipmentAsset> {
      const client = getClient(accessToken);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("equipment_assets")
        .insert({
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
          current_meter_hours: input.current_meter_hours || 0,
          current_project_id: input.current_project_id || null,
          status: input.current_project_id ? "mobilized_on_site" : "available",
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    async updateAssetStatus(
      accessToken: string,
      id: string,
      input: UpdateEquipmentStatusInput
    ): Promise<EquipmentAsset> {
      const client = getClient(accessToken);
      const updatePayload: any = {
        status: input.status,
        updated_at: new Date().toISOString(),
      };
      if (input.current_project_id !== undefined) {
        updatePayload.current_project_id = input.current_project_id;
      }
      if (input.current_meter_hours !== undefined) {
        updatePayload.current_meter_hours = input.current_meter_hours;
      }

      const { data, error } = await client
        .from("equipment_assets")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    async listAllocations(
      accessToken: string,
      projectId?: string,
      equipmentId?: string
    ): Promise<EquipmentAllocation[]> {
      const client = getClient(accessToken);
      let query = client
        .from("equipment_allocations")
        .select("*, equipment:equipment_assets(*)")
        .order("mobilization_date", { ascending: false });

      if (projectId) query = query.eq("project_id", projectId);
      if (equipmentId) query = query.eq("equipment_id", equipmentId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    async getAllocationById(accessToken: string, id: string): Promise<EquipmentAllocation | null> {
      const client = getClient(accessToken);
      const { data, error } = await client
        .from("equipment_allocations")
        .select("*, equipment:equipment_assets(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    },

    async createAllocation(accessToken: string, input: CreateAllocationInput): Promise<EquipmentAllocation> {
      const client = getClient(accessToken);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("equipment_allocations")
        .insert({
          tenant_id: tenantId,
          equipment_id: input.equipment_id,
          project_id: input.project_id,
          allocation_number: input.allocation_number,
          mobilization_date: input.mobilization_date,
          expected_demobilization_date: input.expected_demobilization_date || null,
          grid_location: input.grid_location || null,
          status: "requested",
          requested_by: input.requested_by,
          notes: input.notes || null,
        })
        .select("*, equipment:equipment_assets(*)")
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    async authorizeAllocation(
      accessToken: string,
      id: string,
      input: AuthorizeAllocationInput
    ): Promise<EquipmentAllocation> {
      const client = getClient(accessToken);
      const updatePayload: any = {
        status: input.status,
        approved_by: input.approved_by,
        updated_at: new Date().toISOString(),
      };
      if (input.actual_demobilization_date) {
        updatePayload.actual_demobilization_date = input.actual_demobilization_date;
      }

      const { data, error } = await client
        .from("equipment_allocations")
        .update(updatePayload)
        .eq("id", id)
        .select("*, equipment:equipment_assets(*)")
        .single();

      if (error) throw new Error(error.message);

      // Auto update asset status
      if (input.status === "mobilized" && data.equipment_id) {
        await client
          .from("equipment_assets")
          .update({
            status: "mobilized_on_site",
            current_project_id: data.project_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.equipment_id);
      } else if (input.status === "demobilized" && data.equipment_id) {
        await client
          .from("equipment_assets")
          .update({
            status: "available",
            current_project_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.equipment_id);
      }

      return data;
    },

    async listDailyLogs(
      accessToken: string,
      projectId?: string,
      equipmentId?: string
    ): Promise<EquipmentDailyLog[]> {
      const client = getClient(accessToken);
      let query = client.from("equipment_daily_logs").select("*").order("log_date", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      if (equipmentId) query = query.eq("equipment_id", equipmentId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    async createDailyLog(accessToken: string, input: CreateDailyLogInput): Promise<EquipmentDailyLog> {
      const client = getClient(accessToken);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("equipment_daily_logs")
        .insert({
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
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Advance meter reading on asset
      await client
        .from("equipment_assets")
        .update({
          current_meter_hours: input.end_meter_reading,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.equipment_id);

      return data;
    },

    async listMaintenanceRecords(accessToken: string, equipmentId?: string): Promise<EquipmentMaintenanceRecord[]> {
      const client = getClient(accessToken);
      let query = client
        .from("equipment_maintenance_records")
        .select("*")
        .order("maintenance_date", { ascending: false });
      if (equipmentId) query = query.eq("equipment_id", equipmentId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    async createMaintenanceRecord(
      accessToken: string,
      input: CreateMaintenanceInput
    ): Promise<EquipmentMaintenanceRecord> {
      const client = getClient(accessToken);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("equipment_maintenance_records")
        .insert({
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
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    async listCertificates(accessToken: string, equipmentId?: string): Promise<EquipmentStatutoryCertificate[]> {
      const client = getClient(accessToken);
      let query = client
        .from("equipment_statutory_certificates")
        .select("*")
        .order("expiry_date", { ascending: true });
      if (equipmentId) query = query.eq("equipment_id", equipmentId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data || [];
    },

    async createCertificate(
      accessToken: string,
      input: CreateCertificateInput
    ): Promise<EquipmentStatutoryCertificate> {
      const client = getClient(accessToken);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const today = new Date().toISOString().slice(0, 10);
      const status = input.expiry_date < today ? "expired" : "valid";

      const { data, error } = await client
        .from("equipment_statutory_certificates")
        .insert({
          tenant_id: tenantId,
          equipment_id: input.equipment_id,
          certificate_type: input.certificate_type,
          certificate_number: input.certificate_number,
          issuing_authority: input.issuing_authority,
          issue_date: input.issue_date,
          expiry_date: input.expiry_date,
          attachment_url: input.attachment_url || null,
          status,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
  };
}
