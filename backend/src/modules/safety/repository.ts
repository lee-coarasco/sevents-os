import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthorizePermitInput,
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
} from "./types.js";

export interface SafetyRepository {
  // PTW
  createPermit(token: string, input: CreatePermitInput): Promise<SafetyPermitToWork>;
  getPermitById(token: string, id: string): Promise<SafetyPermitToWork | null>;
  listPermits(token: string, projectId: string): Promise<SafetyPermitToWork[]>;
  updatePermitStatus(token: string, id: string, status: PermitStatus, safetyOfficerName?: string, precautions?: string): Promise<SafetyPermitToWork>;

  // Incidents
  createIncident(token: string, input: CreateIncidentInput): Promise<SafetyIncident>;
  getIncidentById(token: string, id: string): Promise<SafetyIncident | null>;
  listIncidents(token: string, projectId: string): Promise<SafetyIncident[]>;
  updateIncidentInvestigation(token: string, id: string, input: InvestigateIncidentInput): Promise<SafetyIncident>;
  closeIncident(token: string, id: string, input: CloseIncidentInput): Promise<SafetyIncident>;

  // Hazards
  createHazard(token: string, input: CreateHazardInput): Promise<SafetyHazardObservation>;
  getHazardById(token: string, id: string): Promise<SafetyHazardObservation | null>;
  listHazards(token: string, projectId: string): Promise<SafetyHazardObservation[]>;
  rectifyHazard(token: string, id: string, input: RectifyHazardInput): Promise<SafetyHazardObservation>;

  // Toolbox Talks
  createToolboxTalk(token: string, input: CreateToolboxTalkInput): Promise<SafetyToolboxTalk>;
  listToolboxTalks(token: string, projectId: string): Promise<SafetyToolboxTalk[]>;
}

export function createSupabaseSafetyRepository(
  getClient: (token: string) => SupabaseClient
): SafetyRepository {
  return {
    // 1. PTW
    async createPermit(token: string, input: CreatePermitInput): Promise<SafetyPermitToWork> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("safety_permits_to_work")
        .insert({
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
          precautions_taken: input.precautions_taken ?? null,
          gas_test_required: input.gas_test_required ?? false,
          gas_test_results: input.gas_test_results ?? null,
        })
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to create PTW: ${error?.message}`);
      return data as SafetyPermitToWork;
    },

    async getPermitById(token: string, id: string): Promise<SafetyPermitToWork | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_permits_to_work")
        .select()
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(`Failed to get PTW: ${error.message}`);
      return data as SafetyPermitToWork | null;
    },

    async listPermits(token: string, projectId: string): Promise<SafetyPermitToWork[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_permits_to_work")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`Failed to list PTWs: ${error.message}`);
      return (data || []) as SafetyPermitToWork[];
    },

    async updatePermitStatus(
      token: string,
      id: string,
      status: PermitStatus,
      safetyOfficerName?: string,
      precautions?: string
    ): Promise<SafetyPermitToWork> {
      const client = getClient(token);
      const patch: any = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (safetyOfficerName) patch.safety_officer_name = safetyOfficerName;
      if (precautions) patch.precautions_taken = precautions;

      const { data, error } = await client
        .from("safety_permits_to_work")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to update PTW status: ${error?.message}`);
      return data as SafetyPermitToWork;
    },

    // 2. Incidents
    async createIncident(token: string, input: CreateIncidentInput): Promise<SafetyIncident> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("safety_incidents")
        .insert({
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
          reported_by: input.reported_by,
        })
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to report safety incident: ${error?.message}`);
      return data as SafetyIncident;
    },

    async getIncidentById(token: string, id: string): Promise<SafetyIncident | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_incidents")
        .select()
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(`Failed to get incident: ${error.message}`);
      return data as SafetyIncident | null;
    },

    async listIncidents(token: string, projectId: string): Promise<SafetyIncident[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_incidents")
        .select()
        .eq("project_id", projectId)
        .order("incident_date", { ascending: false });

      if (error) throw new Error(`Failed to list incidents: ${error.message}`);
      return (data || []) as SafetyIncident[];
    },

    async updateIncidentInvestigation(
      token: string,
      id: string,
      input: InvestigateIncidentInput
    ): Promise<SafetyIncident> {
      const client = getClient(token);
      const patch: any = {
        investigated_by: input.investigated_by,
        root_cause_analysis: input.root_cause_analysis,
        corrective_preventive_action: input.corrective_preventive_action,
        status: input.status ?? "capa_assigned",
        updated_at: new Date().toISOString(),
      };
      if (input.lost_workdays !== undefined) patch.lost_workdays = input.lost_workdays;

      const { data, error } = await client
        .from("safety_incidents")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to update incident investigation: ${error?.message}`);
      return data as SafetyIncident;
    },

    async closeIncident(token: string, id: string, input: CloseIncidentInput): Promise<SafetyIncident> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_incidents")
        .update({
          status: "closed",
          closed_by: input.closed_by,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to close incident: ${error?.message}`);
      return data as SafetyIncident;
    },

    // 3. Hazards
    async createHazard(token: string, input: CreateHazardInput): Promise<SafetyHazardObservation> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("safety_hazard_observations")
        .insert({
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
          target_rectification_date: input.target_rectification_date ?? null,
        })
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to create hazard observation: ${error?.message}`);
      return data as SafetyHazardObservation;
    },

    async getHazardById(token: string, id: string): Promise<SafetyHazardObservation | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_hazard_observations")
        .select()
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(`Failed to get hazard: ${error.message}`);
      return data as SafetyHazardObservation | null;
    },

    async listHazards(token: string, projectId: string): Promise<SafetyHazardObservation[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_hazard_observations")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`Failed to list hazards: ${error.message}`);
      return (data || []) as SafetyHazardObservation[];
    },

    async rectifyHazard(token: string, id: string, input: RectifyHazardInput): Promise<SafetyHazardObservation> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_hazard_observations")
        .update({
          status: input.status,
          rectification_evidence: input.rectification_evidence,
          rectified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to update hazard rectification: ${error?.message}`);
      return data as SafetyHazardObservation;
    },

    // 4. Toolbox Talks
    async createToolboxTalk(token: string, input: CreateToolboxTalkInput): Promise<SafetyToolboxTalk> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) throw new Error("Unable to resolve tenant context");

      const { data, error } = await client
        .from("safety_toolbox_talks")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          tbt_number: input.tbt_number,
          talk_date: input.talk_date ?? new Date().toISOString().split("T")[0],
          topic: input.topic,
          conducted_by: input.conducted_by,
          trade_discipline: input.trade_discipline,
          attendee_count: input.attendee_count,
          key_points_discussed: input.key_points_discussed ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error || !data) throw new Error(`Failed to log toolbox talk: ${error?.message}`);
      return data as SafetyToolboxTalk;
    },

    async listToolboxTalks(token: string, projectId: string): Promise<SafetyToolboxTalk[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("safety_toolbox_talks")
        .select()
        .eq("project_id", projectId)
        .order("talk_date", { ascending: false });

      if (error) throw new Error(`Failed to list toolbox talks: ${error.message}`);
      return (data || []) as SafetyToolboxTalk[];
    },
  };
}
