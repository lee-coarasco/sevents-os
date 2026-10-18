export type TradeDiscipline = "civil" | "mep" | "structural" | "finishes" | "piling" | "facade" | "landscape";
export type WorkOrderStatus = "draft" | "approved" | "active" | "completed" | "terminated";
export type MilestoneStatus = "pending" | "completed" | "certified";
export type MeasuredWorkStatus = "draft" | "verified" | "certified";
export type ClaimStatus = "submitted" | "under_review" | "certified" | "paid";

export interface SubcontractorWorkOrder {
  id: string;
  tenant_id: string;
  project_id: string;
  vendor_id: string | null;
  vendor_name?: string;
  work_order_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  contract_value: number;
  retention_rate_pct: number;
  start_date: string | null;
  completion_date: string | null;
  status: WorkOrderStatus;
  scope_of_work: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderMilestone {
  id: string;
  tenant_id: string;
  work_order_id: string;
  milestone_name: string;
  description: string | null;
  amount: number;
  planned_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorAttendanceLog {
  id: string;
  tenant_id: string;
  project_id: string;
  work_order_id: string;
  work_order_title?: string;
  date: string;
  trade: string;
  skilled_count: number;
  unskilled_count: number;
  total_hours: number;
  supervisor_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorMeasuredWork {
  id: string;
  tenant_id: string;
  work_order_id: string;
  work_order_title?: string;
  measurement_date: string;
  wbs_code: string | null;
  boq_item_reference: string | null;
  description: string;
  uom: string;
  quantity_measured: number;
  unit_rate: number;
  certified_amount: number;
  measured_by: string | null;
  status: MeasuredWorkStatus;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorPaymentClaim {
  id: string;
  tenant_id: string;
  project_id: string;
  work_order_id: string;
  work_order_title?: string;
  claim_number: string;
  period_start: string;
  period_end: string;
  claimed_amount: number;
  certified_amount: number;
  retention_deducted: number;
  net_payable_amount: number;
  status: ClaimStatus;
  submitted_at: string;
  certified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkOrderInput {
  projectId: string;
  vendorId?: string | null;
  workOrderNumber: string;
  title: string;
  tradeDiscipline: TradeDiscipline;
  contractValue: number;
  retentionRatePct?: number;
  startDate?: string | null;
  completionDate?: string | null;
  scopeOfWork?: string | null;
}

export interface CreateMilestoneInput {
  workOrderId: string;
  milestoneName: string;
  description?: string | null;
  amount: number;
  plannedDate?: string | null;
}

export interface CreateAttendanceLogInput {
  projectId: string;
  workOrderId: string;
  date: string;
  trade: string;
  skilledCount: number;
  unskilledCount: number;
  totalHours: number;
  supervisorName?: string | null;
  notes?: string | null;
}

export interface CreateMeasuredWorkInput {
  workOrderId: string;
  measurementDate: string;
  wbsCode?: string | null;
  boqItemReference?: string | null;
  description: string;
  uom: string;
  quantityMeasured: number;
  unitRate: number;
  measuredBy?: string | null;
}

export interface CreatePaymentClaimInput {
  projectId: string;
  workOrderId: string;
  claimNumber: string;
  periodStart: string;
  periodEnd: string;
  claimedAmount: number;
  notes?: string | null;
}
