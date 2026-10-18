export type CostCodeCategory = 'materials' | 'labour' | 'subcontractor' | 'equipment' | 'overhead';

export interface CostCode {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: CostCodeCategory;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BudgetStatus = 'draft' | 'submitted' | 'approved' | 'locked_baseline';

export interface ProjectBudget {
  id: string;
  tenant_id: string;
  project_id: string;
  version_number: number;
  status: BudgetStatus;
  total_original_budget: number;
  total_revised_budget: number;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectBudgetLine {
  id: string;
  tenant_id: string;
  budget_id: string;
  cost_code_id: string;
  original_amount: number;
  revised_amount: number;
  committed_amount: number;
  actual_amount: number;
  accrued_amount: number;
  estimate_to_complete: number;
  created_at: string;
  updated_at: string;
  // Computed helpers in API responses
  cost_code?: CostCode;
  estimate_at_completion?: number; // actual_amount + estimate_to_complete
  variance?: number; // revised_amount - estimate_at_completion
}

export type BudgetRevisionStatus = 'draft' | 'approved' | 'rejected';

export interface BudgetRevision {
  id: string;
  tenant_id: string;
  project_id: string;
  revision_number: string;
  from_cost_code_id: string | null;
  to_cost_code_id: string;
  amount: number;
  reason: string;
  status: BudgetRevisionStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseClaimStatus = 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected';

export interface ExpenseClaim {
  id: string;
  tenant_id: string;
  project_id: string;
  cost_code_id: string;
  claim_number: string;
  claimant_name: string;
  claim_date: string;
  amount: number;
  currency: string;
  description: string;
  receipt_reference: string | null;
  status: ExpenseClaimStatus;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type FinancialPeriodStatus = 'open' | 'closing_in_progress' | 'closed';

export interface FinancialPeriod {
  id: string;
  tenant_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: FinancialPeriodStatus;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

// DTOs
export interface CreateCostCodeInput {
  code: string;
  name: string;
  category: CostCodeCategory;
  description?: string;
}

export interface CreateProjectBudgetInput {
  projectId: string;
  notes?: string;
}

export interface UpsertBudgetLineInput {
  costCodeId: string;
  originalAmount: number;
  revisedAmount?: number;
  committedAmount?: number;
  actualAmount?: number;
  accruedAmount?: number;
  estimateToComplete?: number;
}

export interface CreateBudgetRevisionInput {
  projectId: string;
  fromCostCodeId?: string;
  toCostCodeId: string;
  amount: number;
  reason: string;
  requestedBy: string;
}

export interface CreateExpenseClaimInput {
  projectId: string;
  costCodeId: string;
  claimantName: string;
  claimDate?: string;
  amount: number;
  currency?: string;
  description: string;
  receiptReference?: string;
}

export interface CreateFinancialPeriodInput {
  periodName: string;
  startDate: string;
  endDate: string;
}
