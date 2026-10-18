import type {
  AddBlockerInput,
  AddEquipmentEntryInput,
  AddManpowerEntryInput,
  AddWorkProgressEntryInput,
  CreateDprInput,
  CreateSiteInstructionInput,
  SiteRepository,
  UpdateBlockerInput,
  UpdateDprInput,
  UpdateSiteInstructionInput,
} from "../modules/site/repository.js";
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
} from "../modules/site/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeSiteRepository implements SiteRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  dprs = new Map<string, DailyProgressReport>();
  manpowerEntries = new Map<string, DprManpowerEntry>();
  equipmentEntries = new Map<string, DprEquipmentEntry>();
  workProgressEntries = new Map<string, DprWorkProgressEntry>();
  blockers = new Map<string, DprBlocker>();
  siteInstructions = new Map<string, DprSiteInstruction>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  async createDpr(accessToken: string, input: CreateDprInput): Promise<DailyProgressReport> {
    const tenantId = this.tenantOf(accessToken);
    // Check unique constraint (project_id, report_date)
    for (const dpr of this.dprs.values()) {
      if (dpr.tenant_id === tenantId && dpr.project_id === input.project_id && dpr.report_date === input.report_date) {
        throw new Error("DPR already exists for this project and date");
      }
    }
    const now = new Date().toISOString();
    const dpr: DailyProgressReport = {
      id: nextId("dpr"),
      tenant_id: tenantId,
      project_id: input.project_id,
      report_date: input.report_date,
      status: "draft",
      weather_condition: input.weather_condition ?? "clear",
      temperature_celsius: input.temperature_celsius ?? null,
      weather_impact: input.weather_impact ?? null,
      general_notes: input.general_notes ?? null,
      site_engineer_id: input.site_engineer_id ?? null,
      supervisor_id: input.supervisor_id ?? null,
      approved_at: null,
      approved_by: null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
    };
    this.dprs.set(dpr.id, dpr);
    return dpr;
  }

  async getDpr(accessToken: string, id: string): Promise<DailyProgressReport | null> {
    const tenantId = this.tenantOf(accessToken);
    const dpr = this.dprs.get(id);
    if (!dpr || dpr.tenant_id !== tenantId) return null;
    return dpr;
  }

  async listDprs(
    accessToken: string,
    projectId: string,
    filters?: { status?: DprStatus; fromDate?: string; toDate?: string },
  ): Promise<DailyProgressReport[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: DailyProgressReport[] = [];
    for (const dpr of this.dprs.values()) {
      if (dpr.tenant_id !== tenantId || dpr.project_id !== projectId) continue;
      if (filters?.status && dpr.status !== filters.status) continue;
      if (filters?.fromDate && dpr.report_date < filters.fromDate) continue;
      if (filters?.toDate && dpr.report_date > filters.toDate) continue;
      results.push(dpr);
    }
    return results.sort((a, b) => b.report_date.localeCompare(a.report_date));
  }

  async updateDpr(accessToken: string, id: string, input: UpdateDprInput): Promise<DailyProgressReport | null> {
    const dpr = await this.getDpr(accessToken, id);
    if (!dpr) return null;
    const updated: DailyProgressReport = {
      ...dpr,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.dprs.set(id, updated);
    return updated;
  }

  async deleteDpr(accessToken: string, id: string): Promise<boolean> {
    const dpr = await this.getDpr(accessToken, id);
    if (!dpr) return false;
    this.dprs.delete(id);
    // cascade delete child items
    for (const [key, m] of this.manpowerEntries.entries()) {
      if (m.dpr_id === id) this.manpowerEntries.delete(key);
    }
    for (const [key, e] of this.equipmentEntries.entries()) {
      if (e.dpr_id === id) this.equipmentEntries.delete(key);
    }
    for (const [key, w] of this.workProgressEntries.entries()) {
      if (w.dpr_id === id) this.workProgressEntries.delete(key);
    }
    for (const [key, b] of this.blockers.entries()) {
      if (b.dpr_id === id) this.blockers.delete(key);
    }
    return true;
  }

  async addManpowerEntry(accessToken: string, input: AddManpowerEntryInput): Promise<DprManpowerEntry> {
    const tenantId = this.tenantOf(accessToken);
    const entry: DprManpowerEntry = {
      id: nextId("manpower"),
      tenant_id: tenantId,
      dpr_id: input.dpr_id,
      trade: input.trade,
      headcount: input.headcount,
      hours_worked: input.hours_worked ?? 8.0,
      subcontractor_name: input.subcontractor_name ?? null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.manpowerEntries.set(entry.id, entry);
    return entry;
  }

  async listManpowerEntries(accessToken: string, dprId: string): Promise<DprManpowerEntry[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: DprManpowerEntry[] = [];
    for (const entry of this.manpowerEntries.values()) {
      if (entry.tenant_id === tenantId && entry.dpr_id === dprId) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async removeManpowerEntry(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.tenantOf(accessToken);
    const entry = this.manpowerEntries.get(id);
    if (!entry || entry.tenant_id !== tenantId) return false;
    this.manpowerEntries.delete(id);
    return true;
  }

  async addEquipmentEntry(accessToken: string, input: AddEquipmentEntryInput): Promise<DprEquipmentEntry> {
    const tenantId = this.tenantOf(accessToken);
    const entry: DprEquipmentEntry = {
      id: nextId("equipment"),
      tenant_id: tenantId,
      dpr_id: input.dpr_id,
      equipment_type: input.equipment_type,
      quantity: input.quantity ?? 1,
      operating_hours: input.operating_hours ?? 8.0,
      idle_hours: input.idle_hours ?? 0,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.equipmentEntries.set(entry.id, entry);
    return entry;
  }

  async listEquipmentEntries(accessToken: string, dprId: string): Promise<DprEquipmentEntry[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: DprEquipmentEntry[] = [];
    for (const entry of this.equipmentEntries.values()) {
      if (entry.tenant_id === tenantId && entry.dpr_id === dprId) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async removeEquipmentEntry(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.tenantOf(accessToken);
    const entry = this.equipmentEntries.get(id);
    if (!entry || entry.tenant_id !== tenantId) return false;
    this.equipmentEntries.delete(id);
    return true;
  }

  async addWorkProgressEntry(accessToken: string, input: AddWorkProgressEntryInput): Promise<DprWorkProgressEntry> {
    const tenantId = this.tenantOf(accessToken);
    const entry: DprWorkProgressEntry = {
      id: nextId("work-progress"),
      tenant_id: tenantId,
      dpr_id: input.dpr_id,
      schedule_activity_id: input.schedule_activity_id ?? null,
      location_or_grid: input.location_or_grid ?? null,
      description: input.description,
      quantity_executed: input.quantity_executed ?? null,
      uom: input.uom ?? null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.workProgressEntries.set(entry.id, entry);
    return entry;
  }

  async listWorkProgressEntries(accessToken: string, dprId: string): Promise<DprWorkProgressEntry[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: DprWorkProgressEntry[] = [];
    for (const entry of this.workProgressEntries.values()) {
      if (entry.tenant_id === tenantId && entry.dpr_id === dprId) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async removeWorkProgressEntry(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.tenantOf(accessToken);
    const entry = this.workProgressEntries.get(id);
    if (!entry || entry.tenant_id !== tenantId) return false;
    this.workProgressEntries.delete(id);
    return true;
  }

  async addBlocker(accessToken: string, input: AddBlockerInput): Promise<DprBlocker> {
    const tenantId = this.tenantOf(accessToken);
    const entry: DprBlocker = {
      id: nextId("blocker"),
      tenant_id: tenantId,
      dpr_id: input.dpr_id,
      category: input.category,
      description: input.description,
      impact_hours: input.impact_hours ?? 0,
      resolution_action: input.resolution_action ?? null,
      status: input.status ?? "open",
      created_at: new Date().toISOString(),
    };
    this.blockers.set(entry.id, entry);
    return entry;
  }

  async listBlockers(accessToken: string, dprId: string): Promise<DprBlocker[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: DprBlocker[] = [];
    for (const entry of this.blockers.values()) {
      if (entry.tenant_id === tenantId && entry.dpr_id === dprId) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async updateBlocker(accessToken: string, id: string, input: UpdateBlockerInput): Promise<DprBlocker | null> {
    const tenantId = this.tenantOf(accessToken);
    const entry = this.blockers.get(id);
    if (!entry || entry.tenant_id !== tenantId) return null;
    const updated: DprBlocker = {
      ...entry,
      ...input,
    };
    this.blockers.set(id, updated);
    return updated;
  }

  async removeBlocker(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.tenantOf(accessToken);
    const entry = this.blockers.get(id);
    if (!entry || entry.tenant_id !== tenantId) return false;
    this.blockers.delete(id);
    return true;
  }

  async createSiteInstruction(accessToken: string, input: CreateSiteInstructionInput): Promise<DprSiteInstruction> {
    const tenantId = this.tenantOf(accessToken);
    const instruction: DprSiteInstruction = {
      id: nextId("si"),
      tenant_id: tenantId,
      project_id: input.project_id,
      dpr_id: input.dpr_id ?? null,
      instruction_number: input.instruction_number,
      issued_by: input.issued_by,
      recipient: input.recipient,
      instruction_text: input.instruction_text,
      priority: input.priority ?? "normal",
      status: input.status ?? "open",
      target_completion_date: input.target_completion_date ?? null,
      issued_at: new Date().toISOString(),
    };
    this.siteInstructions.set(instruction.id, instruction);
    return instruction;
  }

  async getSiteInstruction(accessToken: string, id: string): Promise<DprSiteInstruction | null> {
    const tenantId = this.tenantOf(accessToken);
    const item = this.siteInstructions.get(id);
    if (!item || item.tenant_id !== tenantId) return null;
    return item;
  }

  async listSiteInstructions(
    accessToken: string,
    projectId: string,
    filters?: { status?: SiteInstructionStatus; priority?: SiteInstructionPriority },
  ): Promise<DprSiteInstruction[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: DprSiteInstruction[] = [];
    for (const item of this.siteInstructions.values()) {
      if (item.tenant_id !== tenantId || item.project_id !== projectId) continue;
      if (filters?.status && item.status !== filters.status) continue;
      if (filters?.priority && item.priority !== filters.priority) continue;
      results.push(item);
    }
    return results.sort((a, b) => b.issued_at.localeCompare(a.issued_at));
  }

  async updateSiteInstruction(
    accessToken: string,
    id: string,
    input: UpdateSiteInstructionInput,
  ): Promise<DprSiteInstruction | null> {
    const item = await this.getSiteInstruction(accessToken, id);
    if (!item) return null;
    const updated: DprSiteInstruction = {
      ...item,
      ...input,
    };
    this.siteInstructions.set(id, updated);
    return updated;
  }
}
