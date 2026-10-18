import type {
  SubcontractorRepository,
} from "../modules/subcontractors/repository.js";
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
  WorkOrderMilestone,
  WorkOrderStatus,
} from "../modules/subcontractors/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeSubcontractorRepository implements SubcontractorRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  workOrders = new Map<string, SubcontractorWorkOrder>();
  milestones = new Map<string, WorkOrderMilestone>();
  attendanceLogs = new Map<string, SubcontractorAttendanceLog>();
  measuredWorks = new Map<string, SubcontractorMeasuredWork>();
  paymentClaims = new Map<string, SubcontractorPaymentClaim>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  // Work Orders
  async createWorkOrder(accessToken: string, input: CreateWorkOrderInput): Promise<SubcontractorWorkOrder> {
    const tenantId = this.tenantOf(accessToken);
    const wo: SubcontractorWorkOrder = {
      id: nextId("wo"),
      tenant_id: tenantId,
      project_id: input.projectId,
      vendor_id: input.vendorId || null,
      vendor_name: input.vendorId ? "Specialist Subcontractor" : undefined,
      work_order_number: input.workOrderNumber,
      title: input.title,
      trade_discipline: input.tradeDiscipline,
      contract_value: input.contractValue,
      retention_rate_pct: input.retentionRatePct !== undefined ? input.retentionRatePct : 10.0,
      start_date: input.startDate || null,
      completion_date: input.completionDate || null,
      status: "draft",
      scope_of_work: input.scopeOfWork || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.workOrders.set(wo.id, wo);
    return wo;
  }

  async getWorkOrderById(accessToken: string, id: string): Promise<SubcontractorWorkOrder | null> {
    const tenantId = this.tenantOf(accessToken);
    const wo = this.workOrders.get(id);
    if (!wo || wo.tenant_id !== tenantId) return null;
    return wo;
  }

  async listWorkOrders(accessToken: string, projectId: string): Promise<SubcontractorWorkOrder[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.workOrders.values()).filter(
      (wo) => wo.tenant_id === tenantId && wo.project_id === projectId
    );
  }

  async updateWorkOrderStatus(accessToken: string, id: string, status: WorkOrderStatus): Promise<SubcontractorWorkOrder> {
    const tenantId = this.tenantOf(accessToken);
    const wo = this.workOrders.get(id);
    if (!wo || wo.tenant_id !== tenantId) throw new Error("Work order not found");
    const updated: SubcontractorWorkOrder = {
      ...wo,
      status,
      updated_at: new Date().toISOString(),
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  // Milestones
  async createMilestone(accessToken: string, input: CreateMilestoneInput): Promise<WorkOrderMilestone> {
    const tenantId = this.tenantOf(accessToken);
    const ms: WorkOrderMilestone = {
      id: nextId("ms"),
      tenant_id: tenantId,
      work_order_id: input.workOrderId,
      milestone_name: input.milestoneName,
      description: input.description || null,
      amount: input.amount,
      planned_date: input.plannedDate || null,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.milestones.set(ms.id, ms);
    return ms;
  }

  async listMilestones(accessToken: string, workOrderId: string): Promise<WorkOrderMilestone[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.milestones.values()).filter(
      (ms) => ms.tenant_id === tenantId && ms.work_order_id === workOrderId
    );
  }

  async updateMilestoneStatus(accessToken: string, id: string, status: MilestoneStatus): Promise<WorkOrderMilestone> {
    const tenantId = this.tenantOf(accessToken);
    const ms = this.milestones.get(id);
    if (!ms || ms.tenant_id !== tenantId) throw new Error("Milestone not found");
    const updated: WorkOrderMilestone = {
      ...ms,
      status,
      updated_at: new Date().toISOString(),
    };
    this.milestones.set(id, updated);
    return updated;
  }

  // Attendance Logs
  async createAttendanceLog(accessToken: string, input: CreateAttendanceLogInput): Promise<SubcontractorAttendanceLog> {
    const tenantId = this.tenantOf(accessToken);
    const wo = this.workOrders.get(input.workOrderId);
    const log: SubcontractorAttendanceLog = {
      id: nextId("att"),
      tenant_id: tenantId,
      project_id: input.projectId,
      work_order_id: input.workOrderId,
      work_order_title: wo?.title,
      date: input.date,
      trade: input.trade,
      skilled_count: input.skilledCount,
      unskilled_count: input.unskilledCount,
      total_hours: input.totalHours,
      supervisor_name: input.supervisorName || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.attendanceLogs.set(log.id, log);
    return log;
  }

  async listAttendanceLogs(accessToken: string, projectId: string, date?: string): Promise<SubcontractorAttendanceLog[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.attendanceLogs.values()).filter((l) => {
      if (l.tenant_id !== tenantId || l.project_id !== projectId) return false;
      if (date && l.date !== date) return false;
      return true;
    });
  }

  // Measured Works
  async createMeasuredWork(accessToken: string, input: CreateMeasuredWorkInput): Promise<SubcontractorMeasuredWork> {
    const tenantId = this.tenantOf(accessToken);
    const wo = this.workOrders.get(input.workOrderId);
    const certifiedAmount = Number((input.quantityMeasured * input.unitRate).toFixed(2));
    const mw: SubcontractorMeasuredWork = {
      id: nextId("mw"),
      tenant_id: tenantId,
      work_order_id: input.workOrderId,
      work_order_title: wo?.title,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.measuredWorks.set(mw.id, mw);
    return mw;
  }

  async listMeasuredWorks(accessToken: string, workOrderId: string): Promise<SubcontractorMeasuredWork[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.measuredWorks.values()).filter(
      (mw) => mw.tenant_id === tenantId && mw.work_order_id === workOrderId
    );
  }

  async updateMeasuredWorkStatus(accessToken: string, id: string, status: MeasuredWorkStatus): Promise<SubcontractorMeasuredWork> {
    const tenantId = this.tenantOf(accessToken);
    const mw = this.measuredWorks.get(id);
    if (!mw || mw.tenant_id !== tenantId) throw new Error("Measured work not found");
    const updated: SubcontractorMeasuredWork = {
      ...mw,
      status,
      updated_at: new Date().toISOString(),
    };
    this.measuredWorks.set(id, updated);
    return updated;
  }

  // Payment Claims
  async createPaymentClaim(
    accessToken: string,
    input: CreatePaymentClaimInput & { retentionDeducted: number; netPayableAmount: number }
  ): Promise<SubcontractorPaymentClaim> {
    const tenantId = this.tenantOf(accessToken);
    const wo = this.workOrders.get(input.workOrderId);
    const claim: SubcontractorPaymentClaim = {
      id: nextId("claim"),
      tenant_id: tenantId,
      project_id: input.projectId,
      work_order_id: input.workOrderId,
      work_order_title: wo?.title,
      claim_number: input.claimNumber,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      claimed_amount: input.claimedAmount,
      certified_amount: input.claimedAmount,
      retention_deducted: input.retentionDeducted,
      net_payable_amount: input.netPayableAmount,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      certified_at: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.paymentClaims.set(claim.id, claim);
    return claim;
  }

  async getPaymentClaimById(accessToken: string, id: string): Promise<SubcontractorPaymentClaim | null> {
    const tenantId = this.tenantOf(accessToken);
    const claim = this.paymentClaims.get(id);
    if (!claim || claim.tenant_id !== tenantId) return null;
    return claim;
  }

  async listPaymentClaims(accessToken: string, projectId: string): Promise<SubcontractorPaymentClaim[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.paymentClaims.values()).filter(
      (c) => c.tenant_id === tenantId && c.project_id === projectId
    );
  }

  async certifyPaymentClaim(
    accessToken: string,
    id: string,
    certifiedAmount: number,
    retentionDeducted: number,
    netPayableAmount: number,
    notes?: string | null
  ): Promise<SubcontractorPaymentClaim> {
    const tenantId = this.tenantOf(accessToken);
    const claim = this.paymentClaims.get(id);
    if (!claim || claim.tenant_id !== tenantId) throw new Error("Payment claim not found");
    const updated: SubcontractorPaymentClaim = {
      ...claim,
      certified_amount: certifiedAmount,
      retention_deducted: retentionDeducted,
      net_payable_amount: netPayableAmount,
      status: "certified",
      certified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: notes !== undefined ? notes : claim.notes,
    };
    this.paymentClaims.set(id, updated);
    return updated;
  }
}
