import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChecklistResult,
  CloseNCRInput,
  CreateITPInput,
  CreateNCRInput,
  CreateWIRInput,
  ITPInspectionItem,
  ITPStatus,
  NCRSeverity,
  NCRStatus,
  NonConformanceReport,
  QualityInspectionPlan,
  RootCauseCategory,
  SignOffWIRInput,
  TradeDiscipline,
  WIRChecklistItem,
  WIRStatus,
  WorkInspectionRequest,
} from "./types.js";

export interface QualityRepository {
  // ITP Plans
  createPlan(token: string, input: CreateITPInput): Promise<QualityInspectionPlan>;
  getPlanById(token: string, id: string): Promise<QualityInspectionPlan | null>;
  listPlans(token: string, projectId: string): Promise<QualityInspectionPlan[]>;
  updatePlanStatus(token: string, id: string, status: ITPStatus): Promise<QualityInspectionPlan>;

  // WIR Requests
  createWIR(token: string, input: CreateWIRInput): Promise<WorkInspectionRequest>;
  getWIRById(token: string, id: string): Promise<WorkInspectionRequest | null>;
  listWIRs(token: string, projectId: string): Promise<WorkInspectionRequest[]>;
  signOffWIR(
    token: string,
    id: string,
    status: WIRStatus,
    inspectorName: string,
    inspectorRemarks?: string,
    checklistUpdates?: Array<{ id: string; result: ChecklistResult; comments?: string }>
  ): Promise<WorkInspectionRequest>;

  // NCR Reports
  createNCR(token: string, input: CreateNCRInput): Promise<NonConformanceReport>;
  getNCRById(token: string, id: string): Promise<NonConformanceReport | null>;
  listNCRs(token: string, projectId: string): Promise<NonConformanceReport[]>;
  updateNCRStatus(
    token: string,
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
  ): Promise<NonConformanceReport>;
}

export function createSupabaseQualityRepository(
  getClient: (token: string) => SupabaseClient
): QualityRepository {
  return {
    async createPlan(token: string, input: CreateITPInput): Promise<QualityInspectionPlan> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) {
        throw new Error("Unable to resolve tenant context");
      }

      const { data: plan, error: planErr } = await client
        .from("quality_inspection_plans")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          plan_number: input.plan_number,
          title: input.title,
          trade_discipline: input.trade_discipline,
          version: input.version ?? "v1.0",
          status: "draft",
          applicable_specifications: input.applicable_specifications ?? null,
        })
        .select()
        .single();

      if (planErr || !plan) {
        throw new Error(`Failed to create quality inspection plan: ${planErr?.message}`);
      }

      let items: ITPInspectionItem[] = [];
      if (input.items && input.items.length > 0) {
        const itemRows = input.items.map((it, idx) => ({
          tenant_id: tenantId,
          plan_id: plan.id,
          item_sequence: it.item_sequence ?? idx + 1,
          activity_name: it.activity_name,
          acceptance_criteria: it.acceptance_criteria,
          point_type: it.point_type,
          reference_standard: it.reference_standard ?? null,
          verifying_document: it.verifying_document ?? null,
        }));

        const { data: insertedItems, error: itemsErr } = await client
          .from("itp_inspection_items")
          .insert(itemRows)
          .select();

        if (itemsErr) {
          throw new Error(`Failed to insert ITP checklist items: ${itemsErr.message}`);
        }
        items = insertedItems as ITPInspectionItem[];
      }

      return {
        ...plan,
        items,
      } as QualityInspectionPlan;
    },

    async getPlanById(token: string, id: string): Promise<QualityInspectionPlan | null> {
      const client = getClient(token);
      const { data: plan, error } = await client
        .from("quality_inspection_plans")
        .select("*, items:itp_inspection_items(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get quality plan: ${error.message}`);
      }
      return plan as QualityInspectionPlan | null;
    },

    async listPlans(token: string, projectId: string): Promise<QualityInspectionPlan[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("quality_inspection_plans")
        .select("*, items:itp_inspection_items(*)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list quality plans: ${error.message}`);
      }
      return (data || []) as QualityInspectionPlan[];
    },

    async updatePlanStatus(token: string, id: string, status: ITPStatus): Promise<QualityInspectionPlan> {
      const client = getClient(token);
      const { data, error } = await client
        .from("quality_inspection_plans")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*, items:itp_inspection_items(*)")
        .single();

      if (error || !data) {
        throw new Error(`Failed to update quality plan status: ${error?.message}`);
      }
      return data as QualityInspectionPlan;
    },

    async createWIR(token: string, input: CreateWIRInput): Promise<WorkInspectionRequest> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) {
        throw new Error("Unable to resolve tenant context");
      }

      const { data: wir, error: wirErr } = await client
        .from("work_inspection_requests")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          plan_id: input.plan_id ?? null,
          wir_number: input.wir_number,
          title: input.title,
          trade_discipline: input.trade_discipline,
          location_or_grid: input.location_or_grid,
          inspection_date: input.inspection_date ?? new Date().toISOString().split("T")[0],
          status: "draft",
          contractor_representative: input.contractor_representative ?? null,
        })
        .select()
        .single();

      if (wirErr || !wir) {
        throw new Error(`Failed to create WIR: ${wirErr?.message}`);
      }

      let checklist: WIRChecklistItem[] = [];
      if (input.checklist && input.checklist.length > 0) {
        const rows = input.checklist.map((it, idx) => ({
          tenant_id: tenantId,
          wir_id: wir.id,
          item_sequence: it.item_sequence ?? idx + 1,
          checkpoint_description: it.checkpoint_description,
          result: it.result ?? "pending",
          comments: it.comments ?? null,
        }));

        const { data: insertedList, error: listErr } = await client
          .from("wir_checklist_items")
          .insert(rows)
          .select();

        if (listErr) {
          throw new Error(`Failed to create WIR checklist: ${listErr.message}`);
        }
        checklist = insertedList as WIRChecklistItem[];
      }

      return {
        ...wir,
        checklist,
      } as WorkInspectionRequest;
    },

    async getWIRById(token: string, id: string): Promise<WorkInspectionRequest | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("work_inspection_requests")
        .select("*, checklist:wir_checklist_items(*), plan:quality_inspection_plans(title)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get WIR: ${error.message}`);
      }
      if (!data) return null;

      return {
        ...data,
        plan_title: (data as any).plan?.title,
      } as WorkInspectionRequest;
    },

    async listWIRs(token: string, projectId: string): Promise<WorkInspectionRequest[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("work_inspection_requests")
        .select("*, checklist:wir_checklist_items(*), plan:quality_inspection_plans(title)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list WIRs: ${error.message}`);
      }
      return (data || []).map((row: any) => ({
        ...row,
        plan_title: row.plan?.title,
      })) as WorkInspectionRequest[];
    },

    async signOffWIR(
      token: string,
      id: string,
      status: WIRStatus,
      inspectorName: string,
      inspectorRemarks?: string,
      checklistUpdates?: Array<{ id: string; result: ChecklistResult; comments?: string }>
    ): Promise<WorkInspectionRequest> {
      const client = getClient(token);

      if (checklistUpdates && checklistUpdates.length > 0) {
        for (const item of checklistUpdates) {
          await client
            .from("wir_checklist_items")
            .update({
              result: item.result,
              comments: item.comments ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }

      const { data, error } = await client
        .from("work_inspection_requests")
        .update({
          status,
          inspector_name: inspectorName,
          inspector_remarks: inspectorRemarks ?? null,
          signed_off_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*, checklist:wir_checklist_items(*)")
        .single();

      if (error || !data) {
        throw new Error(`Failed to sign off WIR: ${error?.message}`);
      }
      return data as WorkInspectionRequest;
    },

    async createNCR(token: string, input: CreateNCRInput): Promise<NonConformanceReport> {
      const client = getClient(token);
      const { data: tenantId, error: tenantErr } = await client.rpc("current_tenant_id");
      if (tenantErr || !tenantId) {
        throw new Error("Unable to resolve tenant context");
      }

      const { data, error } = await client
        .from("non_conformance_reports")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          wir_id: input.wir_id ?? null,
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
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to create NCR: ${error?.message}`);
      }
      return data as NonConformanceReport;
    },

    async getNCRById(token: string, id: string): Promise<NonConformanceReport | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("non_conformance_reports")
        .select("*, wir:work_inspection_requests(wir_number)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get NCR: ${error.message}`);
      }
      if (!data) return null;
      return {
        ...data,
        wir_number: (data as any).wir?.wir_number,
      } as NonConformanceReport;
    },

    async listNCRs(token: string, projectId: string): Promise<NonConformanceReport[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("non_conformance_reports")
        .select("*, wir:work_inspection_requests(wir_number)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list NCRs: ${error.message}`);
      }
      return (data || []).map((row: any) => ({
        ...row,
        wir_number: row.wir?.wir_number,
      })) as NonConformanceReport[];
    },

    async updateNCRStatus(
      token: string,
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
      const client = getClient(token);
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
        ...patch,
      };

      const { data, error } = await client
        .from("non_conformance_reports")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to update NCR status: ${error?.message}`);
      }
      return data as NonConformanceReport;
    },
  };
}
