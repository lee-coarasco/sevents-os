import type { FinanceRepository } from "./repository.js";
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
} from "./types.js";

export class FinanceService {
  constructor(private repo: FinanceRepository) {}

  async listCostCodes(accessToken: string, category?: CostCodeCategory): Promise<CostCode[]> {
    return this.repo.getCostCodes(accessToken, category);
  }

  async createCostCode(accessToken: string, input: CreateCostCodeInput): Promise<CostCode> {
    if (!input.code || !input.name || !input.category) {
      throw new Error("code, name, and category are required");
    }
    return this.repo.createCostCode(accessToken, input);
  }

  async listProjectBudgets(accessToken: string, projectId: string): Promise<ProjectBudget[]> {
    return this.repo.getProjectBudgets(accessToken, projectId);
  }

  async getBudgetDetail(
    accessToken: string,
    budgetId: string
  ): Promise<{
    budget: ProjectBudget;
    lines: ProjectBudgetLine[];
    summary: {
      totalOriginal: number;
      totalRevised: number;
      totalCommitted: number;
      totalActual: number;
      totalAccrued: number;
      totalEstimateAtCompletion: number;
      totalVariance: number;
    };
  }> {
    const budget = await this.repo.getProjectBudgetById(accessToken, budgetId);
    if (!budget) throw new Error("Project budget not found");

    const lines = await this.repo.getBudgetLines(accessToken, budgetId);

    const summary = lines.reduce(
      (acc, cur) => {
        const eac = cur.estimate_at_completion || (Number(cur.actual_amount) + Number(cur.estimate_to_complete));
        const variance = cur.variance !== undefined ? cur.variance : (Number(cur.revised_amount) - eac);
        return {
          totalOriginal: acc.totalOriginal + Number(cur.original_amount),
          totalRevised: acc.totalRevised + Number(cur.revised_amount),
          totalCommitted: acc.totalCommitted + Number(cur.committed_amount),
          totalActual: acc.totalActual + Number(cur.actual_amount),
          totalAccrued: acc.totalAccrued + Number(cur.accrued_amount),
          totalEstimateAtCompletion: acc.totalEstimateAtCompletion + eac,
          totalVariance: acc.totalVariance + variance,
        };
      },
      {
        totalOriginal: 0,
        totalRevised: 0,
        totalCommitted: 0,
        totalActual: 0,
        totalAccrued: 0,
        totalEstimateAtCompletion: 0,
        totalVariance: 0,
      }
    );

    return { budget, lines, summary };
  }

  async createProjectBudget(accessToken: string, input: CreateProjectBudgetInput): Promise<ProjectBudget> {
    if (!input.projectId) throw new Error("projectId is required");
    return this.repo.createProjectBudget(accessToken, input);
  }

  async upsertBudgetLine(
    accessToken: string,
    budgetId: string,
    input: UpsertBudgetLineInput
  ): Promise<ProjectBudgetLine> {
    const budget = await this.repo.getProjectBudgetById(accessToken, budgetId);
    if (!budget) throw new Error("Project budget not found");
    if (budget.status === "locked_baseline") {
      throw new Error("Cannot modify lines on a locked baseline budget. Create a revision or new version.");
    }

    const line = await this.repo.upsertBudgetLine(accessToken, budgetId, input);

    // Recalculate parent budget totals
    const lines = await this.repo.getBudgetLines(accessToken, budgetId);
    const totalOriginal = lines.reduce((sum, l) => sum + Number(l.original_amount), 0);
    const totalRevised = lines.reduce((sum, l) => sum + Number(l.revised_amount), 0);
    await this.repo.updateProjectBudget(accessToken, budgetId, {
      totalOriginalBudget: totalOriginal,
      totalRevisedBudget: totalRevised,
    });

    return line;
  }

  async submitBudget(accessToken: string, budgetId: string): Promise<ProjectBudget> {
    const budget = await this.repo.getProjectBudgetById(accessToken, budgetId);
    if (!budget) throw new Error("Project budget not found");
    if (budget.status !== "draft") throw new Error(`Budget cannot be submitted from status ${budget.status}`);

    const updated = await this.repo.updateProjectBudget(accessToken, budgetId, { status: "submitted" });
    if (!updated) throw new Error("Failed to submit budget");
    return updated;
  }

  async approveBudget(
    accessToken: string,
    budgetId: string,
    approvedBy: string,
    lockBaseline = false
  ): Promise<ProjectBudget> {
    const budget = await this.repo.getProjectBudgetById(accessToken, budgetId);
    if (!budget) throw new Error("Project budget not found");

    const status = lockBaseline ? "locked_baseline" : "approved";
    const updated = await this.repo.updateProjectBudget(accessToken, budgetId, {
      status,
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error("Failed to approve budget");
    return updated;
  }

  async listBudgetRevisions(accessToken: string, projectId: string): Promise<BudgetRevision[]> {
    return this.repo.getBudgetRevisions(accessToken, projectId);
  }

  async createBudgetRevision(accessToken: string, input: CreateBudgetRevisionInput): Promise<BudgetRevision> {
    if (!input.projectId || !input.toCostCodeId || !input.amount || !input.reason) {
      throw new Error("projectId, toCostCodeId, amount, and reason are required");
    }
    if (input.amount <= 0) throw new Error("Revision amount must be positive");
    return this.repo.createBudgetRevision(accessToken, input);
  }

  async authorizeBudgetRevision(
    accessToken: string,
    revisionId: string,
    status: "approved" | "rejected",
    approvedBy: string
  ): Promise<BudgetRevision> {
    const revs = await this.repo.getBudgetRevisions(accessToken, ""); // repo will filter or we update
    const updated = await this.repo.updateBudgetRevision(accessToken, revisionId, {
      status,
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error("Budget revision not found");
    return updated;
  }

  async listExpenseClaims(accessToken: string, projectId?: string): Promise<ExpenseClaim[]> {
    return this.repo.getExpenseClaims(accessToken, projectId);
  }

  async createExpenseClaim(accessToken: string, input: CreateExpenseClaimInput): Promise<ExpenseClaim> {
    if (!input.projectId || !input.costCodeId || !input.claimantName || !input.amount || !input.description) {
      throw new Error("projectId, costCodeId, claimantName, amount, and description are required");
    }
    if (input.amount <= 0) throw new Error("Amount must be positive");

    // Check financial periods: ensure date is not in a closed period
    const claimDate = input.claimDate ? new Date(input.claimDate) : new Date();
    const periods = await this.repo.getFinancialPeriods(accessToken);
    const isClosed = periods.some((p) => {
      if (p.status !== "closed") return false;
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      return claimDate >= start && claimDate <= end;
    });

    if (isClosed) {
      throw new Error("Cannot submit expense claim in a closed financial period (FR-FIN-003).");
    }

    return this.repo.createExpenseClaim(accessToken, input);
  }

  async authorizeExpenseClaim(
    accessToken: string,
    claimId: string,
    status: "approved" | "paid" | "rejected",
    approvedBy: string
  ): Promise<ExpenseClaim> {
    const updates: {
      status: "approved" | "paid" | "rejected";
      approvedBy?: string;
      approvedAt?: string;
      paidAt?: string;
    } = { status };

    if (status === "approved") {
      updates.approvedBy = approvedBy;
      updates.approvedAt = new Date().toISOString();
    } else if (status === "paid") {
      updates.paidAt = new Date().toISOString();
    }

    const updated = await this.repo.updateExpenseClaim(accessToken, claimId, updates);
    if (!updated) throw new Error("Expense claim not found");
    return updated;
  }

  async listFinancialPeriods(accessToken: string): Promise<FinancialPeriod[]> {
    return this.repo.getFinancialPeriods(accessToken);
  }

  async createFinancialPeriod(accessToken: string, input: CreateFinancialPeriodInput): Promise<FinancialPeriod> {
    if (!input.periodName || !input.startDate || !input.endDate) {
      throw new Error("periodName, startDate, and endDate are required");
    }
    return this.repo.createFinancialPeriod(accessToken, input);
  }

  async closeFinancialPeriod(accessToken: string, periodId: string, closedBy: string): Promise<FinancialPeriod> {
    const updated = await this.repo.updateFinancialPeriod(accessToken, periodId, {
      status: "closed",
      closedBy,
      closedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error("Financial period not found");
    return updated;
  }
}
