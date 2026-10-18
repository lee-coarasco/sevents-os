import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyProgressReport,
  DprBlocker,
  DprEquipmentEntry,
  DprManpowerEntry,
  DprSiteInstruction,
  DprStatus,
  DprWorkProgressEntry,
  SiteInstructionPriority,
  SiteInstructionStatus,
  WeatherCondition,
  WeatherImpact,
  BlockerCategory,
  BlockerStatus,
} from "./types.js";

// ---- DPR Inputs -----------------------------------------------------------

export interface CreateDprInput {
  project_id: string;
  report_date: string;
  weather_condition?: WeatherCondition;
  temperature_celsius?: number | null;
  weather_impact?: WeatherImpact | null;
  general_notes?: string | null;
  site_engineer_id?: string | null;
  supervisor_id?: string | null;
}

export interface UpdateDprInput {
  weather_condition?: WeatherCondition;
  temperature_celsius?: number | null;
  weather_impact?: WeatherImpact | null;
  general_notes?: string | null;
  site_engineer_id?: string | null;
  supervisor_id?: string | null;
  status?: DprStatus;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
}

// ---- DPR Child Inputs -----------------------------------------------------

export interface AddManpowerEntryInput {
  dpr_id: string;
  trade: string;
  headcount: number;
  hours_worked?: number;
  subcontractor_name?: string | null;
  notes?: string | null;
}

export interface AddEquipmentEntryInput {
  dpr_id: string;
  equipment_type: string;
  quantity?: number;
  operating_hours?: number;
  idle_hours?: number;
  notes?: string | null;
}

export interface AddWorkProgressEntryInput {
  dpr_id: string;
  schedule_activity_id?: string | null;
  location_or_grid?: string | null;
  description: string;
  quantity_executed?: number | null;
  uom?: string | null;
  notes?: string | null;
}

export interface AddBlockerInput {
  dpr_id: string;
  category: BlockerCategory;
  description: string;
  impact_hours?: number;
  resolution_action?: string | null;
  status?: BlockerStatus;
}

export interface UpdateBlockerInput {
  category?: BlockerCategory;
  description?: string;
  impact_hours?: number;
  resolution_action?: string | null;
  status?: BlockerStatus;
}

// ---- Site Instruction Inputs ----------------------------------------------

export interface CreateSiteInstructionInput {
  project_id: string;
  dpr_id?: string | null;
  instruction_number: string;
  issued_by: string;
  recipient: string;
  instruction_text: string;
  priority?: SiteInstructionPriority;
  status?: SiteInstructionStatus;
  target_completion_date?: string | null;
}

export interface UpdateSiteInstructionInput {
  instruction_text?: string;
  priority?: SiteInstructionPriority;
  status?: SiteInstructionStatus;
  target_completion_date?: string | null;
}

// ---- Repository Interface -------------------------------------------------

export interface SiteRepository {
  createDpr(accessToken: string, input: CreateDprInput): Promise<DailyProgressReport>;
  getDpr(accessToken: string, id: string): Promise<DailyProgressReport | null>;
  listDprs(
    accessToken: string,
    projectId: string,
    filters?: { status?: DprStatus; fromDate?: string; toDate?: string },
  ): Promise<DailyProgressReport[]>;
  updateDpr(accessToken: string, id: string, input: UpdateDprInput): Promise<DailyProgressReport | null>;
  deleteDpr(accessToken: string, id: string): Promise<boolean>;

  addManpowerEntry(accessToken: string, input: AddManpowerEntryInput): Promise<DprManpowerEntry>;
  listManpowerEntries(accessToken: string, dprId: string): Promise<DprManpowerEntry[]>;
  removeManpowerEntry(accessToken: string, id: string): Promise<boolean>;

  addEquipmentEntry(accessToken: string, input: AddEquipmentEntryInput): Promise<DprEquipmentEntry>;
  listEquipmentEntries(accessToken: string, dprId: string): Promise<DprEquipmentEntry[]>;
  removeEquipmentEntry(accessToken: string, id: string): Promise<boolean>;

  addWorkProgressEntry(accessToken: string, input: AddWorkProgressEntryInput): Promise<DprWorkProgressEntry>;
  listWorkProgressEntries(accessToken: string, dprId: string): Promise<DprWorkProgressEntry[]>;
  removeWorkProgressEntry(accessToken: string, id: string): Promise<boolean>;

  addBlocker(accessToken: string, input: AddBlockerInput): Promise<DprBlocker>;
  listBlockers(accessToken: string, dprId: string): Promise<DprBlocker[]>;
  updateBlocker(accessToken: string, id: string, input: UpdateBlockerInput): Promise<DprBlocker | null>;
  removeBlocker(accessToken: string, id: string): Promise<boolean>;

  createSiteInstruction(accessToken: string, input: CreateSiteInstructionInput): Promise<DprSiteInstruction>;
  getSiteInstruction(accessToken: string, id: string): Promise<DprSiteInstruction | null>;
  listSiteInstructions(
    accessToken: string,
    projectId: string,
    filters?: { status?: SiteInstructionStatus; priority?: SiteInstructionPriority },
  ): Promise<DprSiteInstruction[]>;
  updateSiteInstruction(accessToken: string, id: string, input: UpdateSiteInstructionInput): Promise<DprSiteInstruction | null>;
}

// ---- Supabase Implementation ----------------------------------------------

export function createSupabaseSiteRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): SiteRepository {
  return {
    async createDpr(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("daily_progress_reports")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createDpr: ${error?.message ?? "no row returned"}`);
      return data as DailyProgressReport;
    },

    async getDpr(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("daily_progress_reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getDpr: ${error.message}`);
      return (data as DailyProgressReport | null) ?? null;
    },

    async listDprs(accessToken, projectId, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client
        .from("daily_progress_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("report_date", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.fromDate) query = query.gte("report_date", filters.fromDate);
      if (filters?.toDate) query = query.lte("report_date", filters.toDate);

      const { data, error } = await query;
      if (error) throw new Error(`listDprs: ${error.message}`);
      return (data as DailyProgressReport[]) ?? [];
    },

    async updateDpr(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("daily_progress_reports")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDpr: ${error.message}`);
      return (data as DailyProgressReport | null) ?? null;
    },

    async deleteDpr(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("daily_progress_reports")
        .delete()
        .eq("id", id);
      if (error) throw new Error(`deleteDpr: ${error.message}`);
      return true;
    },

    async addManpowerEntry(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_manpower_entries")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`addManpowerEntry: ${error?.message ?? "no row returned"}`);
      return data as DprManpowerEntry;
    },

    async listManpowerEntries(accessToken, dprId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_manpower_entries")
        .select("*")
        .eq("dpr_id", dprId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listManpowerEntries: ${error.message}`);
      return (data as DprManpowerEntry[]) ?? [];
    },

    async removeManpowerEntry(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("dpr_manpower_entries")
        .delete()
        .eq("id", id);
      if (error) throw new Error(`removeManpowerEntry: ${error.message}`);
      return true;
    },

    async addEquipmentEntry(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_equipment_entries")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`addEquipmentEntry: ${error?.message ?? "no row returned"}`);
      return data as DprEquipmentEntry;
    },

    async listEquipmentEntries(accessToken, dprId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_equipment_entries")
        .select("*")
        .eq("dpr_id", dprId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listEquipmentEntries: ${error.message}`);
      return (data as DprEquipmentEntry[]) ?? [];
    },

    async removeEquipmentEntry(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("dpr_equipment_entries")
        .delete()
        .eq("id", id);
      if (error) throw new Error(`removeEquipmentEntry: ${error.message}`);
      return true;
    },

    async addWorkProgressEntry(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_work_progress_entries")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`addWorkProgressEntry: ${error?.message ?? "no row returned"}`);
      return data as DprWorkProgressEntry;
    },

    async listWorkProgressEntries(accessToken, dprId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_work_progress_entries")
        .select("*")
        .eq("dpr_id", dprId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listWorkProgressEntries: ${error.message}`);
      return (data as DprWorkProgressEntry[]) ?? [];
    },

    async removeWorkProgressEntry(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("dpr_work_progress_entries")
        .delete()
        .eq("id", id);
      if (error) throw new Error(`removeWorkProgressEntry: ${error.message}`);
      return true;
    },

    async addBlocker(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_blockers")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`addBlocker: ${error?.message ?? "no row returned"}`);
      return data as DprBlocker;
    },

    async listBlockers(accessToken, dprId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_blockers")
        .select("*")
        .eq("dpr_id", dprId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listBlockers: ${error.message}`);
      return (data as DprBlocker[]) ?? [];
    },

    async updateBlocker(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_blockers")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateBlocker: ${error.message}`);
      return (data as DprBlocker | null) ?? null;
    },

    async removeBlocker(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client
        .from("dpr_blockers")
        .delete()
        .eq("id", id);
      if (error) throw new Error(`removeBlocker: ${error.message}`);
      return true;
    },

    async createSiteInstruction(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_site_instructions")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createSiteInstruction: ${error?.message ?? "no row returned"}`);
      return data as DprSiteInstruction;
    },

    async getSiteInstruction(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_site_instructions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getSiteInstruction: ${error.message}`);
      return (data as DprSiteInstruction | null) ?? null;
    },

    async listSiteInstructions(accessToken, projectId, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client
        .from("dpr_site_instructions")
        .select("*")
        .eq("project_id", projectId)
        .order("issued_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.priority) query = query.eq("priority", filters.priority);

      const { data, error } = await query;
      if (error) throw new Error(`listSiteInstructions: ${error.message}`);
      return (data as DprSiteInstruction[]) ?? [];
    },

    async updateSiteInstruction(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("dpr_site_instructions")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateSiteInstruction: ${error.message}`);
      return (data as DprSiteInstruction | null) ?? null;
    },
  };
}
