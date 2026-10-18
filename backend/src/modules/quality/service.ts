import type { QualityRepository } from "./repository.js";
import type {
  ChecklistResult,
  CloseNCRInput,
  CreateITPInput,
  CreateNCRInput,
  CreateWIRInput,
  ITPStatus,
  NCRStatus,
  NonConformanceReport,
  QualityInspectionPlan,
  SignOffWIRInput,
  UpdateNCRCAPAInput,
  WIRStatus,
  WorkInspectionRequest,
} from "./types.js";

export class QualityService {
  constructor(private repo: QualityRepository) {}

  // ITP Plans
  async createPlan(token: string, input: CreateITPInput): Promise<QualityInspectionPlan> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.plan_number?.trim()) throw new Error("plan_number is required");
    if (!input.title?.trim()) throw new Error("title is required");
    if (!input.trade_discipline) throw new Error("trade_discipline is required");

    return this.repo.createPlan(token, input);
  }

  async getPlan(token: string, id: string): Promise<QualityInspectionPlan> {
    const plan = await this.repo.getPlanById(token, id);
    if (!plan) throw new Error("Quality inspection plan not found");
    return plan;
  }

  async listPlans(token: string, projectId: string): Promise<QualityInspectionPlan[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listPlans(token, projectId);
  }

  async updatePlanStatus(token: string, id: string, status: ITPStatus): Promise<QualityInspectionPlan> {
    await this.getPlan(token, id);
    return this.repo.updatePlanStatus(token, id, status);
  }

  // WIR Requests
  async createWIR(token: string, input: CreateWIRInput): Promise<WorkInspectionRequest> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.wir_number?.trim()) throw new Error("wir_number is required");
    if (!input.title?.trim()) throw new Error("title is required");
    if (!input.location_or_grid?.trim()) throw new Error("location_or_grid is required");
    if (!input.trade_discipline) throw new Error("trade_discipline is required");

    if (input.plan_id) {
      await this.getPlan(token, input.plan_id);
    }

    return this.repo.createWIR(token, input);
  }

  async getWIR(token: string, id: string): Promise<WorkInspectionRequest> {
    const wir = await this.repo.getWIRById(token, id);
    if (!wir) throw new Error("Work inspection request not found");
    return wir;
  }

  async listWIRs(token: string, projectId: string): Promise<WorkInspectionRequest[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listWIRs(token, projectId);
  }

  async signOffWIR(
    token: string,
    id: string,
    input: SignOffWIRInput
  ): Promise<{ wir: WorkInspectionRequest; created_ncr?: NonConformanceReport }> {
    const existing = await this.getWIR(token, id);

    if (!input.inspector_name?.trim()) {
      throw new Error("inspector_name is required for sign-off");
    }

    const wir = await this.repo.signOffWIR(
      token,
      id,
      input.status,
      input.inspector_name,
      input.inspector_remarks,
      input.checklist_updates
    );

    let created_ncr: NonConformanceReport | undefined;

    // If rejected and auto_create_ncr requested, create an automatic linked NCR
    if (input.status === "rejected" && input.auto_create_ncr) {
      const ncrNumber = `NCR-${wir.wir_number}-${Date.now().toString().slice(-4)}`;
      created_ncr = await this.repo.createNCR(token, {
        project_id: wir.project_id,
        wir_id: wir.id,
        ncr_number: ncrNumber,
        title: `Defect identified in ${wir.wir_number}: ${wir.title}`,
        trade_discipline: wir.trade_discipline,
        location_or_grid: wir.location_or_grid,
        severity: "major",
        issue_description: input.inspector_remarks || "Inspection failed quality requirements",
        root_cause_category: "workmanship",
        issued_by: input.inspector_name,
        issued_to: wir.contractor_representative || "Site Contractor",
        containment_action: "Work stopped at inspection location pending corrective action plan",
      });
    }

    return { wir, created_ncr };
  }

  // NCR Reports
  async createNCR(token: string, input: CreateNCRInput): Promise<NonConformanceReport> {
    if (!input.project_id) throw new Error("project_id is required");
    if (!input.ncr_number?.trim()) throw new Error("ncr_number is required");
    if (!input.title?.trim()) throw new Error("title is required");
    if (!input.location_or_grid?.trim()) throw new Error("location_or_grid is required");
    if (!input.issue_description?.trim()) throw new Error("issue_description is required");
    if (!input.issued_by?.trim()) throw new Error("issued_by is required");
    if (!input.issued_to?.trim()) throw new Error("issued_to is required");

    if (input.wir_id) {
      await this.getWIR(token, input.wir_id);
    }

    return this.repo.createNCR(token, input);
  }

  async getNCR(token: string, id: string): Promise<NonConformanceReport> {
    const ncr = await this.repo.getNCRById(token, id);
    if (!ncr) throw new Error("Non-conformance report not found");
    return ncr;
  }

  async listNCRs(token: string, projectId: string): Promise<NonConformanceReport[]> {
    if (!projectId) throw new Error("project_id is required");
    return this.repo.listNCRs(token, projectId);
  }

  async submitCAPA(token: string, id: string, input: UpdateNCRCAPAInput): Promise<NonConformanceReport> {
    const ncr = await this.getNCR(token, id);
    if (ncr.status === "verified_closed" || ncr.status === "voided") {
      throw new Error(`Cannot submit CAPA for NCR in status ${ncr.status}`);
    }
    if (!input.corrective_action_plan?.trim()) {
      throw new Error("corrective_action_plan is required");
    }
    if (!input.preventive_action_plan?.trim()) {
      throw new Error("preventive_action_plan is required");
    }

    return this.repo.updateNCRStatus(token, id, "capa_submitted", {
      containment_action: input.containment_action ?? ncr.containment_action ?? undefined,
      corrective_action_plan: input.corrective_action_plan,
      preventive_action_plan: input.preventive_action_plan,
    });
  }

  async closeNCR(token: string, id: string, input: CloseNCRInput): Promise<NonConformanceReport> {
    const ncr = await this.getNCR(token, id);
    if (ncr.status === "verified_closed") {
      throw new Error("NCR is already verified and closed");
    }
    if (!input.closed_by?.trim()) throw new Error("closed_by is required");
    if (!input.closure_remarks?.trim()) throw new Error("closure_remarks is required");

    return this.repo.updateNCRStatus(token, id, "verified_closed", {
      closed_by: input.closed_by,
      closed_at: new Date().toISOString(),
      closure_remarks: input.closure_remarks,
    });
  }
}
