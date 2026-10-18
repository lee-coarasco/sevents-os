import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClaimStatus,
  CreateAttendanceLogInput,
  CreateMeasuredWorkInput,
  CreateMilestoneInput,
  CreatePaymentClaimInput,
  CreateWorkOrderInput,
  MeasuredWorkStatus,
  MilestoneStatus,
  SubcontractorAttendanceLog,
  SubcontractorMeasuredWork,
  SubcontractorPaymentClaim,
  SubcontractorWorkOrder,
  TradeDiscipline,
  WorkOrderMilestone,
  WorkOrderStatus,
} from "./types.js";

export interface SubcontractorRepository {
  // Work Orders
  createWorkOrder(token: string, input: CreateWorkOrderInput): Promise<SubcontractorWorkOrder>;
  getWorkOrderById(token: string, id: string): Promise<SubcontractorWorkOrder | null>;
  listWorkOrders(token: string, projectId: string): Promise<SubcontractorWorkOrder[]>;
  updateWorkOrderStatus(token: string, id: string, status: WorkOrderStatus): Promise<SubcontractorWorkOrder>;

  // Milestones
  createMilestone(token: string, input: CreateMilestoneInput): Promise<WorkOrderMilestone>;
  listMilestones(token: string, workOrderId: string): Promise<WorkOrderMilestone[]>;
  updateMilestoneStatus(token: string, id: string, status: MilestoneStatus): Promise<WorkOrderMilestone>;

  // Attendance Logs
  createAttendanceLog(token: string, input: CreateAttendanceLogInput): Promise<SubcontractorAttendanceLog>;
  listAttendanceLogs(token: string, projectId: string, date?: string): Promise<SubcontractorAttendanceLog[]>;

  // Measured Works
  createMeasuredWork(token: string, input: CreateMeasuredWorkInput): Promise<SubcontractorMeasuredWork>;
  listMeasuredWorks(token: string, workOrderId: string): Promise<SubcontractorMeasuredWork[]>;
  updateMeasuredWorkStatus(token: string, id: string, status: MeasuredWorkStatus): Promise<SubcontractorMeasuredWork>;

  // Payment Claims
  createPaymentClaim(
    token: string,
    input: CreatePaymentClaimInput & { retentionDeducted: number; netPayableAmount: number }
  ): Promise<SubcontractorPaymentClaim>;
  getPaymentClaimById(token: string, id: string): Promise<SubcontractorPaymentClaim | null>;
  listPaymentClaims(token: string, projectId: string): Promise<SubcontractorPaymentClaim[]>;
  certifyPaymentClaim(
    token: string,
    id: string,
    certifiedAmount: number,
    retentionDeducted: number,
    netPayableAmount: number,
    notes?: string | null
  ): Promise<SubcontractorPaymentClaim>;
}

export function createSupabaseSubcontractorRepository(
  getClient: (token: string) => SupabaseClient
): SubcontractorRepository {
  return {
    async createWorkOrder(token: string, input: CreateWorkOrderInput): Promise<SubcontractorWorkOrder> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_work_orders")
        .insert({
          project_id: input.projectId,
          vendor_id: input.vendorId || null,
          work_order_number: input.workOrderNumber,
          title: input.title,
          trade_discipline: input.tradeDiscipline,
          contract_value: input.contractValue,
          retention_rate_pct: input.retentionRatePct !== undefined ? input.retentionRatePct : 10.0,
          start_date: input.startDate || null,
          completion_date: input.completionDate || null,
          scope_of_work: input.scopeOfWork || null,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorWorkOrder;
    },

    async getWorkOrderById(token: string, id: string): Promise<SubcontractorWorkOrder | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_work_orders")
        .select("*, vendors(name)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        vendor_name: (data as any).vendors?.name || undefined,
      } as SubcontractorWorkOrder;
    },

    async listWorkOrders(token: string, projectId: string): Promise<SubcontractorWorkOrder[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_work_orders")
        .select("*, vendors(name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        vendor_name: row.vendors?.name || undefined,
      })) as SubcontractorWorkOrder[];
    },

    async updateWorkOrderStatus(token: string, id: string, status: WorkOrderStatus): Promise<SubcontractorWorkOrder> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_work_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorWorkOrder;
    },

    async createMilestone(token: string, input: CreateMilestoneInput): Promise<WorkOrderMilestone> {
      const client = getClient(token);
      const { data, error } = await client
        .from("work_order_milestones")
        .insert({
          work_order_id: input.workOrderId,
          milestone_name: input.milestoneName,
          description: input.description || null,
          amount: input.amount,
          planned_date: input.plannedDate || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data as WorkOrderMilestone;
    },

    async listMilestones(token: string, workOrderId: string): Promise<WorkOrderMilestone[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("work_order_milestones")
        .select()
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as WorkOrderMilestone[];
    },

    async updateMilestoneStatus(token: string, id: string, status: MilestoneStatus): Promise<WorkOrderMilestone> {
      const client = getClient(token);
      const { data, error } = await client
        .from("work_order_milestones")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as WorkOrderMilestone;
    },

    async createAttendanceLog(token: string, input: CreateAttendanceLogInput): Promise<SubcontractorAttendanceLog> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_attendance_logs")
        .insert({
          project_id: input.projectId,
          work_order_id: input.workOrderId,
          date: input.date,
          trade: input.trade,
          skilled_count: input.skilledCount,
          unskilled_count: input.unskilledCount,
          total_hours: input.totalHours,
          supervisor_name: input.supervisorName || null,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorAttendanceLog;
    },

    async listAttendanceLogs(token: string, projectId: string, date?: string): Promise<SubcontractorAttendanceLog[]> {
      const client = getClient(token);
      let query = client
        .from("subcontractor_attendance_logs")
        .select("*, subcontractor_work_orders(title)")
        .eq("project_id", projectId)
        .order("date", { ascending: false });

      if (date) {
        query = query.eq("date", date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        work_order_title: row.subcontractor_work_orders?.title || undefined,
      })) as SubcontractorAttendanceLog[];
    },

    async createMeasuredWork(token: string, input: CreateMeasuredWorkInput): Promise<SubcontractorMeasuredWork> {
      const client = getClient(token);
      const certifiedAmount = Number((input.quantityMeasured * input.unitRate).toFixed(2));
      const { data, error } = await client
        .from("subcontractor_measured_works")
        .insert({
          work_order_id: input.workOrderId,
          measurement_date: input.measurementDate,
          wbs_code: input.wbsCode || null,
          boq_item_reference: input.boqItemReference || null,
          description: input.description,
          uom: input.uom,
          quantity_measured: input.quantityMeasured,
          unit_rate: input.unitRate,
          certified_amount: certifiedAmount,
          measured_by: input.measuredBy || null,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorMeasuredWork;
    },

    async listMeasuredWorks(token: string, workOrderId: string): Promise<SubcontractorMeasuredWork[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_measured_works")
        .select("*, subcontractor_work_orders(title)")
        .eq("work_order_id", workOrderId)
        .order("measurement_date", { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        work_order_title: row.subcontractor_work_orders?.title || undefined,
      })) as SubcontractorMeasuredWork[];
    },

    async updateMeasuredWorkStatus(token: string, id: string, status: MeasuredWorkStatus): Promise<SubcontractorMeasuredWork> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_measured_works")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorMeasuredWork;
    },

    async createPaymentClaim(
      token: string,
      input: CreatePaymentClaimInput & { retentionDeducted: number; netPayableAmount: number }
    ): Promise<SubcontractorPaymentClaim> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_payment_claims")
        .insert({
          project_id: input.projectId,
          work_order_id: input.workOrderId,
          claim_number: input.claimNumber,
          period_start: input.periodStart,
          period_end: input.periodEnd,
          claimed_amount: input.claimedAmount,
          certified_amount: input.claimedAmount, // initially equals claimed until certified
          retention_deducted: input.retentionDeducted,
          net_payable_amount: input.netPayableAmount,
          status: "submitted",
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorPaymentClaim;
    },

    async getPaymentClaimById(token: string, id: string): Promise<SubcontractorPaymentClaim | null> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_payment_claims")
        .select("*, subcontractor_work_orders(title)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        work_order_title: (data as any).subcontractor_work_orders?.title || undefined,
      } as SubcontractorPaymentClaim;
    },

    async listPaymentClaims(token: string, projectId: string): Promise<SubcontractorPaymentClaim[]> {
      const client = getClient(token);
      const { data, error } = await client
        .from("subcontractor_payment_claims")
        .select("*, subcontractor_work_orders(title)")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        work_order_title: row.subcontractor_work_orders?.title || undefined,
      })) as SubcontractorPaymentClaim[];
    },

    async certifyPaymentClaim(
      token: string,
      id: string,
      certifiedAmount: number,
      retentionDeducted: number,
      netPayableAmount: number,
      notes?: string | null
    ): Promise<SubcontractorPaymentClaim> {
      const client = getClient(token);
      const updateData: any = {
        certified_amount: certifiedAmount,
        retention_deducted: retentionDeducted,
        net_payable_amount: netPayableAmount,
        status: "certified",
        certified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data, error } = await client
        .from("subcontractor_payment_claims")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as SubcontractorPaymentClaim;
    },
  };
}
