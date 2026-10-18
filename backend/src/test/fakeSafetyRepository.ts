import type { SafetyRepository } from "../modules/safety/repository.js";
import type {
  CloseIncidentInput,
  CreateHazardInput,
  CreateIncidentInput,
  CreatePermitInput,
  CreateToolboxTalkInput,
  InvestigateIncidentInput,
  PermitStatus,
  RectifyHazardInput,
  SafetyHazardObservation,
  SafetyIncident,
  SafetyPermitToWork,
  SafetyToolboxTalk,
} from "../modules/safety/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeSafetyRepository implements SafetyRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  permits = new Map<string, SafetyPermitToWork>();
  incidents = new Map<string, SafetyIncident>();
  hazards = new Map<string, SafetyHazardObservation>();
  tbts = new Map<string, SafetyToolboxTalk>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  // 1. PTW
  async createPermit(accessToken: string, input: CreatePermitInput): Promise<SafetyPermitToWork> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("ptw");
    const ptw: SafetyPermitToWork = {
      id,
      tenant_id: tenantId,
      project_id: input.project_id,
      permit_number: input.permit_number,
      permit_type: input.permit_type,
      title: input.title,
      location_or_grid: input.location_or_grid,
      start_time: input.start_time,
      expiry_time: input.expiry_time,
      status: "pending_approval",
      contractor_name: input.contractor_name,
      supervisor_name: input.supervisor_name,
      safety_officer_name: null,
      precautions_taken: input.precautions_taken ?? null,
      gas_test_required: input.gas_test_required ?? false,
      gas_test_results: input.gas_test_results ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.permits.set(id, ptw);
    return ptw;
  }

  async getPermitById(accessToken: string, id: string): Promise<SafetyPermitToWork | null> {
    const tenantId = this.tenantOf(accessToken);
    const ptw = this.permits.get(id);
    if (!ptw || ptw.tenant_id !== tenantId) return null;
    return ptw;
  }

  async listPermits(accessToken: string, projectId: string): Promise<SafetyPermitToWork[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.permits.values()).filter(
      (p) => p.tenant_id === tenantId && p.project_id === projectId
    );
  }

  async updatePermitStatus(
    accessToken: string,
    id: string,
    status: PermitStatus,
    safetyOfficerName?: string,
    precautions?: string
  ): Promise<SafetyPermitToWork> {
    const tenantId = this.tenantOf(accessToken);
    const ptw = this.permits.get(id);
    if (!ptw || ptw.tenant_id !== tenantId) throw new Error("PTW not found");

    const updated: SafetyPermitToWork = {
      ...ptw,
      status,
      safety_officer_name: safetyOfficerName ?? ptw.safety_officer_name,
      precautions_taken: precautions ?? ptw.precautions_taken,
      updated_at: new Date().toISOString(),
    };
    this.permits.set(id, updated);
    return updated;
  }

  // 2. Incidents
  async createIncident(accessToken: string, input: CreateIncidentInput): Promise<SafetyIncident> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("inc");
    const incident: SafetyIncident = {
      id,
      tenant_id: tenantId,
      project_id: input.project_id,
      incident_number: input.incident_number,
      incident_date: input.incident_date ?? new Date().toISOString(),
      incident_type: input.incident_type,
      severity: input.severity,
      status: "reported",
      location_or_grid: input.location_or_grid,
      description: input.description,
      injured_person_name: input.injured_person_name ?? null,
      injury_details: input.injury_details ?? null,
      lost_workdays: input.lost_workdays ?? 0,
      immediate_action_taken: input.immediate_action_taken ?? null,
      root_cause_analysis: null,
      corrective_preventive_action: null,
      reported_by: input.reported_by,
      investigated_by: null,
      closed_by: null,
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.incidents.set(id, incident);
    return incident;
  }

  async getIncidentById(accessToken: string, id: string): Promise<SafetyIncident | null> {
    const tenantId = this.tenantOf(accessToken);
    const inc = this.incidents.get(id);
    if (!inc || inc.tenant_id !== tenantId) return null;
    return inc;
  }

  async listIncidents(accessToken: string, projectId: string): Promise<SafetyIncident[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.incidents.values()).filter(
      (i) => i.tenant_id === tenantId && i.project_id === projectId
    );
  }

  async updateIncidentInvestigation(
    accessToken: string,
    id: string,
    input: InvestigateIncidentInput
  ): Promise<SafetyIncident> {
    const tenantId = this.tenantOf(accessToken);
    const inc = this.incidents.get(id);
    if (!inc || inc.tenant_id !== tenantId) throw new Error("Incident not found");

    const updated: SafetyIncident = {
      ...inc,
      investigated_by: input.investigated_by,
      root_cause_analysis: input.root_cause_analysis,
      corrective_preventive_action: input.corrective_preventive_action,
      lost_workdays: input.lost_workdays !== undefined ? input.lost_workdays : inc.lost_workdays,
      status: input.status ?? "capa_assigned",
      updated_at: new Date().toISOString(),
    };
    this.incidents.set(id, updated);
    return updated;
  }

  async closeIncident(accessToken: string, id: string, input: CloseIncidentInput): Promise<SafetyIncident> {
    const tenantId = this.tenantOf(accessToken);
    const inc = this.incidents.get(id);
    if (!inc || inc.tenant_id !== tenantId) throw new Error("Incident not found");

    const updated: SafetyIncident = {
      ...inc,
      status: "closed",
      closed_by: input.closed_by,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.incidents.set(id, updated);
    return updated;
  }

  // 3. Hazards
  async createHazard(accessToken: string, input: CreateHazardInput): Promise<SafetyHazardObservation> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("haz");
    const hazard: SafetyHazardObservation = {
      id,
      tenant_id: tenantId,
      project_id: input.project_id,
      observation_number: input.observation_number,
      observation_type: input.observation_type,
      risk_level: input.risk_level,
      stop_work_issued: input.stop_work_issued ?? false,
      location_or_grid: input.location_or_grid,
      description: input.description,
      action_required: input.action_required,
      status: "open",
      reported_by: input.reported_by,
      assigned_to: input.assigned_to ?? null,
      rectification_evidence: null,
      target_rectification_date: input.target_rectification_date ?? null,
      rectified_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.hazards.set(id, hazard);
    return hazard;
  }

  async getHazardById(accessToken: string, id: string): Promise<SafetyHazardObservation | null> {
    const tenantId = this.tenantOf(accessToken);
    const haz = this.hazards.get(id);
    if (!haz || haz.tenant_id !== tenantId) return null;
    return haz;
  }

  async listHazards(accessToken: string, projectId: string): Promise<SafetyHazardObservation[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.hazards.values()).filter(
      (h) => h.tenant_id === tenantId && h.project_id === projectId
    );
  }

  async rectifyHazard(accessToken: string, id: string, input: RectifyHazardInput): Promise<SafetyHazardObservation> {
    const tenantId = this.tenantOf(accessToken);
    const haz = this.hazards.get(id);
    if (!haz || haz.tenant_id !== tenantId) throw new Error("Hazard not found");

    const updated: SafetyHazardObservation = {
      ...haz,
      status: input.status,
      rectification_evidence: input.rectification_evidence,
      rectified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.hazards.set(id, updated);
    return updated;
  }

  // 4. Toolbox Talks
  async createToolboxTalk(accessToken: string, input: CreateToolboxTalkInput): Promise<SafetyToolboxTalk> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("tbt");
    const tbt: SafetyToolboxTalk = {
      id,
      tenant_id: tenantId,
      project_id: input.project_id,
      tbt_number: input.tbt_number,
      talk_date: input.talk_date || new Date().toISOString().split("T")[0]!,
      topic: input.topic,
      conducted_by: input.conducted_by,
      trade_discipline: input.trade_discipline,
      attendee_count: input.attendee_count,
      key_points_discussed: input.key_points_discussed ?? null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tbts.set(id, tbt);
    return tbt;
  }

  async listToolboxTalks(accessToken: string, projectId: string): Promise<SafetyToolboxTalk[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.tbts.values()).filter(
      (t) => t.tenant_id === tenantId && t.project_id === projectId
    );
  }
}
