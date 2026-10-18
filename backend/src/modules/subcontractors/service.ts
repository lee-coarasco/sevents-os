import type { SubcontractorRepository } from "./repository.js";
import type {
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
} from "./types.js";

export class SubcontractorService {
  constructor(private repo: SubcontractorRepository) {}

  // Work Orders
  async createWorkOrder(token: string, input: CreateWorkOrderInput): Promise<SubcontractorWorkOrder> {
    if (!input.projectId) throw new Error("projectId is required");
    if (!input.workOrderNumber?.trim()) throw new Error("workOrderNumber is required");
    if (!input.title?.trim()) throw new Error("title is required");
    if (input.contractValue < 0) throw new Error("contractValue cannot be negative");

    return this.repo.createWorkOrder(token, input);
  }

  async getWorkOrder(token: string, id: string): Promise<SubcontractorWorkOrder> {
    const wo = await this.repo.getWorkOrderById(token, id);
    if (!wo) throw new Error("Subcontractor work order not found");
    return wo;
  }

  async listWorkOrders(token: string, projectId: string): Promise<SubcontractorWorkOrder[]> {
    if (!projectId) throw new Error("projectId is required");
    return this.repo.listWorkOrders(token, projectId);
  }

  async updateWorkOrderStatus(token: string, id: string, status: WorkOrderStatus): Promise<SubcontractorWorkOrder> {
    await this.getWorkOrder(token, id);
    return this.repo.updateWorkOrderStatus(token, id, status);
  }

  // Milestones
  async createMilestone(token: string, input: CreateMilestoneInput): Promise<WorkOrderMilestone> {
    if (!input.workOrderId) throw new Error("workOrderId is required");
    if (!input.milestoneName?.trim()) throw new Error("milestoneName is required");
    if (input.amount < 0) throw new Error("amount cannot be negative");

    await this.getWorkOrder(token, input.workOrderId);
    return this.repo.createMilestone(token, input);
  }

  async listMilestones(token: string, workOrderId: string): Promise<WorkOrderMilestone[]> {
    await this.getWorkOrder(token, workOrderId);
    return this.repo.listMilestones(token, workOrderId);
  }

  async updateMilestoneStatus(token: string, id: string, status: MilestoneStatus): Promise<WorkOrderMilestone> {
    return this.repo.updateMilestoneStatus(token, id, status);
  }

  // Attendance Logs
  async createAttendanceLog(token: string, input: CreateAttendanceLogInput): Promise<SubcontractorAttendanceLog> {
    if (!input.projectId) throw new Error("projectId is required");
    if (!input.workOrderId) throw new Error("workOrderId is required");
    if (!input.trade?.trim()) throw new Error("trade is required");
    if (input.skilledCount < 0 || input.unskilledCount < 0) throw new Error("headcounts cannot be negative");
    if (input.totalHours < 0) throw new Error("totalHours cannot be negative");

    await this.getWorkOrder(token, input.workOrderId);
    return this.repo.createAttendanceLog(token, input);
  }

  async listAttendanceLogs(token: string, projectId: string, date?: string): Promise<SubcontractorAttendanceLog[]> {
    if (!projectId) throw new Error("projectId is required");
    return this.repo.listAttendanceLogs(token, projectId, date);
  }

  // Measured Works
  async createMeasuredWork(token: string, input: CreateMeasuredWorkInput): Promise<SubcontractorMeasuredWork> {
    if (!input.workOrderId) throw new Error("workOrderId is required");
    if (!input.description?.trim()) throw new Error("description is required");
    if (input.quantityMeasured < 0) throw new Error("quantityMeasured cannot be negative");
    if (input.unitRate < 0) throw new Error("unitRate cannot be negative");

    await this.getWorkOrder(token, input.workOrderId);
    return this.repo.createMeasuredWork(token, input);
  }

  async listMeasuredWorks(token: string, workOrderId: string): Promise<SubcontractorMeasuredWork[]> {
    await this.getWorkOrder(token, workOrderId);
    return this.repo.listMeasuredWorks(token, workOrderId);
  }

  async updateMeasuredWorkStatus(token: string, id: string, status: MeasuredWorkStatus): Promise<SubcontractorMeasuredWork> {
    return this.repo.updateMeasuredWorkStatus(token, id, status);
  }

  // Payment Claims
  async createPaymentClaim(token: string, input: CreatePaymentClaimInput): Promise<SubcontractorPaymentClaim> {
    if (!input.projectId) throw new Error("projectId is required");
    if (!input.workOrderId) throw new Error("workOrderId is required");
    if (!input.claimNumber?.trim()) throw new Error("claimNumber is required");
    if (input.claimedAmount <= 0) throw new Error("claimedAmount must be greater than zero");

    const wo = await this.getWorkOrder(token, input.workOrderId);

    // Calculate retention deduction based on work order retention percentage (e.g. 10%)
    const retentionRate = (wo.retention_rate_pct || 10.0) / 100.0;
    const retentionDeducted = Number((input.claimedAmount * retentionRate).toFixed(2));
    const netPayableAmount = Number((input.claimedAmount - retentionDeducted).toFixed(2));

    return this.repo.createPaymentClaim(token, {
      ...input,
      retentionDeducted,
      netPayableAmount,
    });
  }

  async getPaymentClaim(token: string, id: string): Promise<SubcontractorPaymentClaim> {
    const claim = await this.repo.getPaymentClaimById(token, id);
    if (!claim) throw new Error("Subcontractor payment claim not found");
    return claim;
  }

  async listPaymentClaims(token: string, projectId: string): Promise<SubcontractorPaymentClaim[]> {
    if (!projectId) throw new Error("projectId is required");
    return this.repo.listPaymentClaims(token, projectId);
  }

  async certifyPaymentClaim(
    token: string,
    id: string,
    certifiedAmount: number,
    notes?: string | null
  ): Promise<SubcontractorPaymentClaim> {
    const claim = await this.getPaymentClaim(token, id);
    const wo = await this.getWorkOrder(token, claim.work_order_id);

    if (certifiedAmount < 0) throw new Error("certifiedAmount cannot be negative");

    const retentionRate = (wo.retention_rate_pct || 10.0) / 100.0;
    const retentionDeducted = Number((certifiedAmount * retentionRate).toFixed(2));
    const netPayableAmount = Number((certifiedAmount - retentionDeducted).toFixed(2));

    return this.repo.certifyPaymentClaim(
      token,
      id,
      certifiedAmount,
      retentionDeducted,
      netPayableAmount,
      notes
    );
  }
}
