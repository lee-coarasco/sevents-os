import type { SafetyRepository } from "./repository.js";
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

export class SafetyService {
  constructor(private repo: SafetyRepository) {}

  // 1. PTW
  async createPermit(token: string, input: CreatePermitInput): Promise<SafetyPermitToWork> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.permit_number?.trim()) throw new Error("permit_number is required");
    if (!input.title?.trim()) throw new Error("title is required");
    if (!input.location_or_grid?.trim()) throw new Error("location_or_grid is required");
    if (!input.contractor_name?.trim()) throw new Error("contractor_name is required");
    if (!input.supervisor_name?.trim()) throw new Error("supervisor_name is required");
    if (!input.start_time) throw new Error("start_time is required");
    if (!input.expiry_time) throw new Error("expiry_time is required");

    return this.repo.createPermit(token, input);
  }

  async getPermit(token: string, id: string): Promise<SafetyPermitToWork> {
    const ptw = await this.repo.getPermitById(token, id);
    if (!ptw) throw new Error("Permit to Work not found");
    return ptw;
  }

  async listPermits(token: string, projectId: string): Promise<SafetyPermitToWork[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listPermits(token, projectId);
  }

  async authorizePermit(token: string, id: string, input: AuthorizePermitInput): Promise<SafetyPermitToWork> {
    await this.getPermit(token, id);
    if (!input.safety_officer_name?.trim()) {
      throw new Error("safety_officer_name is required for permit authorization");
    }
    return this.repo.updatePermitStatus(token, id, input.status, input.safety_officer_name, input.precautions_taken);
  }

  // 2. Incidents
  async createIncident(token: string, input: CreateIncidentInput): Promise<SafetyIncident> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.incident_number?.trim()) throw new Error("incident_number is required");
    if (!input.description?.trim()) throw new Error("description is required");
    if (!input.location_or_grid?.trim()) throw new Error("location_or_grid is required");
    if (!input.reported_by?.trim()) throw new Error("reported_by is required");

    return this.repo.createIncident(token, input);
  }

  async getIncident(token: string, id: string): Promise<SafetyIncident> {
    const inc = await this.repo.getIncidentById(token, id);
    if (!inc) throw new Error("Safety incident not found");
    return inc;
  }

  async listIncidents(token: string, projectId: string): Promise<SafetyIncident[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listIncidents(token, projectId);
  }

  async investigateIncident(token: string, id: string, input: InvestigateIncidentInput): Promise<SafetyIncident> {
    await this.getIncident(token, id);
    if (!input.investigated_by?.trim()) throw new Error("investigated_by is required");
    if (!input.root_cause_analysis?.trim()) throw new Error("root_cause_analysis is required");
    if (!input.corrective_preventive_action?.trim()) {
      throw new Error("corrective_preventive_action is required");
    }
    return this.repo.updateIncidentInvestigation(token, id, input);
  }

  async closeIncident(token: string, id: string, input: CloseIncidentInput): Promise<SafetyIncident> {
    const inc = await this.getIncident(token, id);
    if (inc.status === "closed") throw new Error("Incident is already closed");
    if (!input.closed_by?.trim()) throw new Error("closed_by is required");

    return this.repo.closeIncident(token, id, input);
  }

  // 3. Hazards & Stop-Work
  async createHazard(token: string, input: CreateHazardInput): Promise<SafetyHazardObservation> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.observation_number?.trim()) throw new Error("observation_number is required");
    if (!input.description?.trim()) throw new Error("description is required");
    if (!input.action_required?.trim()) throw new Error("action_required is required");
    if (!input.reported_by?.trim()) throw new Error("reported_by is required");

    // If imminent danger, automatically issue Stop-Work directive
    if (input.risk_level === "imminent_danger") {
      input.stop_work_issued = true;
    }

    return this.repo.createHazard(token, input);
  }

  async getHazard(token: string, id: string): Promise<SafetyHazardObservation> {
    const haz = await this.repo.getHazardById(token, id);
    if (!haz) throw new Error("Hazard observation not found");
    return haz;
  }

  async listHazards(token: string, projectId: string): Promise<SafetyHazardObservation[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listHazards(token, projectId);
  }

  async rectifyHazard(token: string, id: string, input: RectifyHazardInput): Promise<SafetyHazardObservation> {
    await this.getHazard(token, id);
    if (!input.rectification_evidence?.trim()) {
      throw new Error("rectification_evidence is required");
    }
    return this.repo.rectifyHazard(token, id, input);
  }

  // 4. Toolbox Talks
  async createToolboxTalk(token: string, input: CreateToolboxTalkInput): Promise<SafetyToolboxTalk> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.tbt_number?.trim()) throw new Error("tbt_number is required");
    if (!input.topic?.trim()) throw new Error("topic is required");
    if (!input.conducted_by?.trim()) throw new Error("conducted_by is required");
    if (input.attendee_count < 0) throw new Error("attendee_count cannot be negative");

    return this.repo.createToolboxTalk(token, input);
  }

  async listToolboxTalks(token: string, projectId: string): Promise<SafetyToolboxTalk[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listToolboxTalks(token, projectId);
  }
}
