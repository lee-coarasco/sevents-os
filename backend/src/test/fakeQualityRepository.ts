import type { QualityRepository } from "../modules/quality/repository.js";
import type {
  ChecklistResult,
  CreateITPInput,
  CreateNCRInput,
  CreateWIRInput,
  ITPInspectionItem,
  ITPStatus,
  NCRStatus,
  NonConformanceReport,
  QualityInspectionPlan,
  WIRChecklistItem,
  WIRStatus,
  WorkInspectionRequest,
} from "../modules/quality/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeQualityRepository implements QualityRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  plans = new Map<string, QualityInspectionPlan>();
  itpItems = new Map<string, ITPInspectionItem>();
  wirs = new Map<string, WorkInspectionRequest>();
  wirChecklists = new Map<string, WIRChecklistItem>();
  ncrs = new Map<string, NonConformanceReport>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  // Plans
  async createPlan(accessToken: string, input: CreateITPInput): Promise<QualityInspectionPlan> {
    const tenantId = this.tenantOf(accessToken);
    const planId = nextId("plan");
    const items: ITPInspectionItem[] = (input.items || []).map((it, idx) => {
      const itemId = nextId("itp-item");
      const item: ITPInspectionItem = {
        id: itemId,
        tenant_id: tenantId,
        plan_id: planId,
        item_sequence: it.item_sequence ?? idx + 1,
        activity_name: it.activity_name,
        acceptance_criteria: it.acceptance_criteria,
        point_type: it.point_type,
        reference_standard: it.reference_standard ?? null,
        verifying_document: it.verifying_document ?? null,
        created_at: new Date().toISOString(),
      };
      this.itpItems.set(itemId, item);
      return item;
    });

    const plan: QualityInspectionPlan = {
      id: planId,
      tenant_id: tenantId,
      project_id: input.project_id,
      plan_number: input.plan_number,
      title: input.title,
      trade_discipline: input.trade_discipline,
      version: input.version ?? "v1.0",
      status: "draft",
      applicable_specifications: input.applicable_specifications ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items,
    };
    this.plans.set(planId, plan);
    return plan;
  }

  async getPlanById(accessToken: string, id: string): Promise<QualityInspectionPlan | null> {
    const tenantId = this.tenantOf(accessToken);
    const plan = this.plans.get(id);
    if (!plan || plan.tenant_id !== tenantId) return null;
    const items = Array.from(this.itpItems.values()).filter(
      (it) => it.plan_id === id && it.tenant_id === tenantId
    );
    return { ...plan, items };
  }

  async listPlans(accessToken: string, projectId: string): Promise<QualityInspectionPlan[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.plans.values())
      .filter((p) => p.tenant_id === tenantId && p.project_id === projectId)
      .map((p) => {
        const items = Array.from(this.itpItems.values()).filter(
          (it) => it.plan_id === p.id && it.tenant_id === tenantId
        );
        return { ...p, items };
      });
  }

  async updatePlanStatus(accessToken: string, id: string, status: ITPStatus): Promise<QualityInspectionPlan> {
    const tenantId = this.tenantOf(accessToken);
    const plan = this.plans.get(id);
    if (!plan || plan.tenant_id !== tenantId) {
      throw new Error("Plan not found");
    }
    const updated = { ...plan, status, updated_at: new Date().toISOString() };
    this.plans.set(id, updated);
    return this.getPlanById(accessToken, id) as Promise<QualityInspectionPlan>;
  }

  // WIR
  async createWIR(accessToken: string, input: CreateWIRInput): Promise<WorkInspectionRequest> {
    const tenantId = this.tenantOf(accessToken);
    const wirId = nextId("wir");
    const checklist: WIRChecklistItem[] = (input.checklist || []).map((it, idx) => {
      const cId = nextId("wir-chk");
      const chk: WIRChecklistItem = {
        id: cId,
        tenant_id: tenantId,
        wir_id: wirId,
        item_sequence: it.item_sequence ?? idx + 1,
        checkpoint_description: it.checkpoint_description,
        result: it.result ?? "pending",
        comments: it.comments ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.wirChecklists.set(cId, chk);
      return chk;
    });

    const plan = input.plan_id ? this.plans.get(input.plan_id) : undefined;

    const wir: WorkInspectionRequest = {
      id: wirId,
      tenant_id: tenantId,
      project_id: input.project_id,
      plan_id: input.plan_id ?? null,
      plan_title: plan?.title,
      wir_number: input.wir_number,
      title: input.title,
      trade_discipline: input.trade_discipline,
      location_or_grid: input.location_or_grid,
      inspection_date: input.inspection_date || new Date().toISOString().split("T")[0]!,
      status: "draft",
      contractor_representative: input.contractor_representative ?? null,
      inspector_name: null,
      inspector_remarks: null,
      signed_off_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      checklist,
    };
    this.wirs.set(wirId, wir);
    return wir;
  }

  async getWIRById(accessToken: string, id: string): Promise<WorkInspectionRequest | null> {
    const tenantId = this.tenantOf(accessToken);
    const wir = this.wirs.get(id);
    if (!wir || wir.tenant_id !== tenantId) return null;
    const checklist = Array.from(this.wirChecklists.values()).filter(
      (it) => it.wir_id === id && it.tenant_id === tenantId
    );
    return { ...wir, checklist };
  }

  async listWIRs(accessToken: string, projectId: string): Promise<WorkInspectionRequest[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.wirs.values())
      .filter((w) => w.tenant_id === tenantId && w.project_id === projectId)
      .map((w) => {
        const checklist = Array.from(this.wirChecklists.values()).filter(
          (it) => it.wir_id === w.id && it.tenant_id === tenantId
        );
        return { ...w, checklist };
      });
  }

  async signOffWIR(
    accessToken: string,
    id: string,
    status: WIRStatus,
    inspectorName: string,
    inspectorRemarks?: string,
    checklistUpdates?: Array<{ id: string; result: ChecklistResult; comments?: string }>
  ): Promise<WorkInspectionRequest> {
    const tenantId = this.tenantOf(accessToken);
    const wir = this.wirs.get(id);
    if (!wir || wir.tenant_id !== tenantId) {
      throw new Error("WIR not found");
    }

    if (checklistUpdates) {
      for (const upd of checklistUpdates) {
        const item = this.wirChecklists.get(upd.id);
        if (item && item.tenant_id === tenantId) {
          this.wirChecklists.set(upd.id, {
            ...item,
            result: upd.result,
            comments: upd.comments ?? item.comments,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    const updated: WorkInspectionRequest = {
      ...wir,
      status,
      inspector_name: inspectorName,
      inspector_remarks: inspectorRemarks ?? null,
      signed_off_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.wirs.set(id, updated);
    return this.getWIRById(accessToken, id) as Promise<WorkInspectionRequest>;
  }

  // NCR
  async createNCR(accessToken: string, input: CreateNCRInput): Promise<NonConformanceReport> {
    const tenantId = this.tenantOf(accessToken);
    const id = nextId("ncr");
    const wir = input.wir_id ? this.wirs.get(input.wir_id) : undefined;

    const ncr: NonConformanceReport = {
      id,
      tenant_id: tenantId,
      project_id: input.project_id,
      wir_id: input.wir_id ?? null,
      wir_number: wir?.wir_number,
      ncr_number: input.ncr_number,
      title: input.title,
      trade_discipline: input.trade_discipline,
      location_or_grid: input.location_or_grid,
      severity: input.severity,
      status: "open",
      issue_description: input.issue_description,
      root_cause_category: input.root_cause_category,
      issued_by: input.issued_by,
      issued_to: input.issued_to,
      target_closure_date: input.target_closure_date ?? null,
      containment_action: input.containment_action ?? null,
      corrective_action_plan: null,
      preventive_action_plan: null,
      closed_by: null,
      closed_at: null,
      closure_remarks: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.ncrs.set(id, ncr);
    return ncr;
  }

  async getNCRById(accessToken: string, id: string): Promise<NonConformanceReport | null> {
    const tenantId = this.tenantOf(accessToken);
    const ncr = this.ncrs.get(id);
    if (!ncr || ncr.tenant_id !== tenantId) return null;
    return ncr;
  }

  async listNCRs(accessToken: string, projectId: string): Promise<NonConformanceReport[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.ncrs.values()).filter(
      (n) => n.tenant_id === tenantId && n.project_id === projectId
    );
  }

  async updateNCRStatus(
    accessToken: string,
    id: string,
    status: NCRStatus,
    patch?: Partial<{
      containment_action: string;
      corrective_action_plan: string;
      preventive_action_plan: string;
      closed_by: string;
      closed_at: string;
      closure_remarks: string;
    }>
  ): Promise<NonConformanceReport> {
    const tenantId = this.tenantOf(accessToken);
    const ncr = this.ncrs.get(id);
    if (!ncr || ncr.tenant_id !== tenantId) {
      throw new Error("NCR not found");
    }
    const updated: NonConformanceReport = {
      ...ncr,
      ...patch,
      status,
      updated_at: new Date().toISOString(),
    };
    this.ncrs.set(id, updated);
    return updated;
  }
}
