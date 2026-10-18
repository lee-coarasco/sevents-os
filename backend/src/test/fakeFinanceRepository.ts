import type { FinanceRepository } from "../modules/finance/repository.js";
import type {
  CostCode,
  CostCodeCategory,
  CreateCostCodeInput,
  ProjectBudget,
  CreateProjectBudgetInput,
  ProjectBudgetLine,
  UpsertBudgetLineInput,
  BudgetRevision,
  CreateBudgetRevisionInput,
  ExpenseClaim,
  CreateExpenseClaimInput,
  FinancialPeriod,
  CreateFinancialPeriodInput,
} from "../modules/finance/types.js";

export class FakeFinanceRepository implements FinanceRepository {
  private sessions = new Map<string, { userId: string; tenantId: string }>();

  public costCodes: CostCode[] = [];
  public projectBudgets: ProjectBudget[] = [];
  public budgetLines: ProjectBudgetLine[] = [];
  public budgetRevisions: BudgetRevision[] = [];
  public expenseClaims: ExpenseClaim[] = [];
  public financialPeriods: FinancialPeriod[] = [];

  addSession(token: string, userId: string, tenantId: string) {
    this.sessions.set(token, { userId, tenantId });
  }

  private tenantOf(token: string): string {
    const s = this.sessions.get(token);
    if (!s) throw new Error("Invalid session token in FakeFinanceRepository");
    return s.tenantId;
  }

  async getCostCodes(accessToken: string, category?: CostCodeCategory): Promise<CostCode[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.costCodes.filter(
      (c) => c.tenant_id === tenantId && c.is_active && (!category || c.category === category)
    );
  }

  async createCostCode(accessToken: string, input: CreateCostCodeInput): Promise<CostCode> {
    const tenantId = this.tenantOf(accessToken);
    const existing = this.costCodes.find((c) => c.tenant_id === tenantId && c.code === input.code);
    if (existing) {
      throw new Error(`Cost code ${input.code} already exists for tenant`);
    }
    const item: CostCode = {
      id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      code: input.code,
      name: input.name,
      category: input.category,
      description: input.description || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.costCodes.push(item);
    return item;
  }

  async getProjectBudgets(accessToken: string, projectId: string): Promise<ProjectBudget[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.projectBudgets
      .filter((b) => b.tenant_id === tenantId && b.project_id === projectId)
      .sort((a, b) => b.version_number - a.version_number);
  }

  async getProjectBudgetById(accessToken: string, budgetId: string): Promise<ProjectBudget | null> {
    const tenantId = this.tenantOf(accessToken);
    const b = this.projectBudgets.find((x) => x.id === budgetId && x.tenant_id === tenantId);
    return b || null;
  }

  async createProjectBudget(accessToken: string, input: CreateProjectBudgetInput): Promise<ProjectBudget> {
    const tenantId = this.tenantOf(accessToken);
    const existing = this.projectBudgets
      .filter((b) => b.tenant_id === tenantId && b.project_id === input.projectId)
      .sort((a, b) => b.version_number - a.version_number);
    const nextVersion = existing.length > 0 && existing[0] ? existing[0].version_number + 1 : 1;

    const budget: ProjectBudget = {
      id: `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.projectId,
      version_number: nextVersion,
      status: "draft",
      total_original_budget: 0,
      total_revised_budget: 0,
      approved_by: null,
      approved_at: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.projectBudgets.push(budget);
    return budget;
  }

  async updateProjectBudget(
    accessToken: string,
    budgetId: string,
    updates: {
      status?: ProjectBudget["status"];
      totalOriginalBudget?: number;
      totalRevisedBudget?: number;
      approvedBy?: string;
      approvedAt?: string;
      notes?: string;
    }
  ): Promise<ProjectBudget | null> {
    const tenantId = this.tenantOf(accessToken);
    const b = this.projectBudgets.find((x) => x.id === budgetId && x.tenant_id === tenantId);
    if (!b) return null;
    if (updates.status !== undefined) b.status = updates.status;
    if (updates.totalOriginalBudget !== undefined) b.total_original_budget = updates.totalOriginalBudget;
    if (updates.totalRevisedBudget !== undefined) b.total_revised_budget = updates.totalRevisedBudget;
    if (updates.approvedBy !== undefined) b.approved_by = updates.approvedBy;
    if (updates.approvedAt !== undefined) b.approved_at = updates.approvedAt;
    if (updates.notes !== undefined) b.notes = updates.notes;
    b.updated_at = new Date().toISOString();
    return b;
  }

  async getBudgetLines(accessToken: string, budgetId: string): Promise<ProjectBudgetLine[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.budgetLines
      .filter((l) => l.tenant_id === tenantId && l.budget_id === budgetId)
      .map((row) => {
        const costCode = this.costCodes.find((c) => c.id === row.cost_code_id);
        const eac = Number(row.actual_amount) + Number(row.estimate_to_complete);
        const variance = Number(row.revised_amount) - eac;
        return {
          ...row,
          cost_code: costCode,
          estimate_at_completion: eac,
          variance,
        };
      });
  }

  async upsertBudgetLine(
    accessToken: string,
    budgetId: string,
    input: UpsertBudgetLineInput
  ): Promise<ProjectBudgetLine> {
    const tenantId = this.tenantOf(accessToken);
    let line = this.budgetLines.find(
      (l) => l.tenant_id === tenantId && l.budget_id === budgetId && l.cost_code_id === input.costCodeId
    );

    const original = input.originalAmount;
    const revised = input.revisedAmount !== undefined ? input.revisedAmount : original;
    const actual = input.actualAmount || 0;
    const etc = input.estimateToComplete !== undefined ? input.estimateToComplete : (revised - actual);

    if (line) {
      line.original_amount = original;
      line.revised_amount = revised;
      if (input.committedAmount !== undefined) line.committed_amount = input.committedAmount;
      if (input.actualAmount !== undefined) line.actual_amount = input.actualAmount;
      if (input.accruedAmount !== undefined) line.accrued_amount = input.accruedAmount;
      line.estimate_to_complete = etc;
      line.updated_at = new Date().toISOString();
    } else {
      line = {
        id: `pbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tenant_id: tenantId,
        budget_id: budgetId,
        cost_code_id: input.costCodeId,
        original_amount: original,
        revised_amount: revised,
        committed_amount: input.committedAmount || 0,
        actual_amount: actual,
        accrued_amount: input.accruedAmount || 0,
        estimate_to_complete: etc,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.budgetLines.push(line);
    }

    const costCode = this.costCodes.find((c) => c.id === line.cost_code_id);
    const eac = Number(line.actual_amount) + Number(line.estimate_to_complete);
    const variance = Number(line.revised_amount) - eac;

    return {
      ...line,
      cost_code: costCode,
      estimate_at_completion: eac,
      variance,
    };
  }

  async getBudgetRevisions(accessToken: string, projectId: string): Promise<BudgetRevision[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.budgetRevisions
      .filter((r) => r.tenant_id === tenantId && r.project_id === projectId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createBudgetRevision(accessToken: string, input: CreateBudgetRevisionInput): Promise<BudgetRevision> {
    const tenantId = this.tenantOf(accessToken);
    const rev: BudgetRevision = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.projectId,
      revision_number: `REV-${Date.now().toString().slice(-6)}`,
      from_cost_code_id: input.fromCostCodeId || null,
      to_cost_code_id: input.toCostCodeId,
      amount: input.amount,
      reason: input.reason,
      status: "draft",
      requested_by: input.requestedBy,
      approved_by: null,
      approved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.budgetRevisions.push(rev);
    return rev;
  }

  async updateBudgetRevision(
    accessToken: string,
    revisionId: string,
    updates: {
      status: BudgetRevision["status"];
      approvedBy?: string;
      approvedAt?: string;
    }
  ): Promise<BudgetRevision | null> {
    const tenantId = this.tenantOf(accessToken);
    const r = this.budgetRevisions.find((x) => x.id === revisionId && x.tenant_id === tenantId);
    if (!r) return null;
    r.status = updates.status;
    if (updates.approvedBy !== undefined) r.approved_by = updates.approvedBy;
    if (updates.approvedAt !== undefined) r.approved_at = updates.approvedAt;
    r.updated_at = new Date().toISOString();
    return r;
  }

  async getExpenseClaims(accessToken: string, projectId?: string): Promise<ExpenseClaim[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.expenseClaims
      .filter((e) => e.tenant_id === tenantId && (!projectId || e.project_id === projectId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createExpenseClaim(accessToken: string, input: CreateExpenseClaimInput): Promise<ExpenseClaim> {
    const tenantId = this.tenantOf(accessToken);
    const claim: ExpenseClaim = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.projectId,
      cost_code_id: input.costCodeId,
      claim_number: `EXP-${Date.now().toString().slice(-6)}`,
      claimant_name: input.claimantName,
      claim_date: input.claimDate || new Date().toISOString(),
      amount: input.amount,
      currency: input.currency || "AED",
      description: input.description,
      receipt_reference: input.receiptReference || null,
      status: "draft",
      approved_by: null,
      approved_at: null,
      paid_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.expenseClaims.push(claim);
    return claim;
  }

  async updateExpenseClaim(
    accessToken: string,
    claimId: string,
    updates: {
      status: ExpenseClaim["status"];
      approvedBy?: string;
      approvedAt?: string;
      paidAt?: string;
    }
  ): Promise<ExpenseClaim | null> {
    const tenantId = this.tenantOf(accessToken);
    const c = this.expenseClaims.find((x) => x.id === claimId && x.tenant_id === tenantId);
    if (!c) return null;
    c.status = updates.status;
    if (updates.approvedBy !== undefined) c.approved_by = updates.approvedBy;
    if (updates.approvedAt !== undefined) c.approved_at = updates.approvedAt;
    if (updates.paidAt !== undefined) c.paid_at = updates.paidAt;
    c.updated_at = new Date().toISOString();
    return c;
  }

  async getFinancialPeriods(accessToken: string): Promise<FinancialPeriod[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.financialPeriods
      .filter((p) => p.tenant_id === tenantId)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }

  async createFinancialPeriod(accessToken: string, input: CreateFinancialPeriodInput): Promise<FinancialPeriod> {
    const tenantId = this.tenantOf(accessToken);
    const period: FinancialPeriod = {
      id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      period_name: input.periodName,
      start_date: input.startDate,
      end_date: input.endDate,
      status: "open",
      closed_by: null,
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.financialPeriods.push(period);
    return period;
  }

  async updateFinancialPeriod(
    accessToken: string,
    periodId: string,
    updates: {
      status: FinancialPeriod["status"];
      closedBy?: string;
      closedAt?: string;
    }
  ): Promise<FinancialPeriod | null> {
    const tenantId = this.tenantOf(accessToken);
    const p = this.financialPeriods.find((x) => x.id === periodId && x.tenant_id === tenantId);
    if (!p) return null;
    p.status = updates.status;
    if (updates.closedBy !== undefined) p.closed_by = updates.closedBy;
    if (updates.closedAt !== undefined) p.closed_at = updates.closedAt;
    p.updated_at = new Date().toISOString();
    return p;
  }
}
