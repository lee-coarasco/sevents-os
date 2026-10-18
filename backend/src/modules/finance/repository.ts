import type { SupabaseClient } from "@supabase/supabase-js";
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
  BudgetStatus,
  BudgetRevisionStatus,
  ExpenseClaimStatus,
  FinancialPeriodStatus,
} from "./types.js";

export interface FinanceRepository {
  getCostCodes(accessToken: string, category?: CostCodeCategory): Promise<CostCode[]>;
  createCostCode(accessToken: string, input: CreateCostCodeInput): Promise<CostCode>;

  getProjectBudgets(accessToken: string, projectId: string): Promise<ProjectBudget[]>;
  getProjectBudgetById(accessToken: string, budgetId: string): Promise<ProjectBudget | null>;
  createProjectBudget(accessToken: string, input: CreateProjectBudgetInput): Promise<ProjectBudget>;
  updateProjectBudget(
    accessToken: string,
    budgetId: string,
    updates: {
      status?: BudgetStatus;
      totalOriginalBudget?: number;
      totalRevisedBudget?: number;
      approvedBy?: string;
      approvedAt?: string;
      notes?: string;
    }
  ): Promise<ProjectBudget | null>;

  getBudgetLines(accessToken: string, budgetId: string): Promise<ProjectBudgetLine[]>;
  upsertBudgetLine(accessToken: string, budgetId: string, input: UpsertBudgetLineInput): Promise<ProjectBudgetLine>;

  getBudgetRevisions(accessToken: string, projectId: string): Promise<BudgetRevision[]>;
  createBudgetRevision(accessToken: string, input: CreateBudgetRevisionInput): Promise<BudgetRevision>;
  updateBudgetRevision(
    accessToken: string,
    revisionId: string,
    updates: {
      status: BudgetRevisionStatus;
      approvedBy?: string;
      approvedAt?: string;
    }
  ): Promise<BudgetRevision | null>;

  getExpenseClaims(accessToken: string, projectId?: string): Promise<ExpenseClaim[]>;
  createExpenseClaim(accessToken: string, input: CreateExpenseClaimInput): Promise<ExpenseClaim>;
  updateExpenseClaim(
    accessToken: string,
    claimId: string,
    updates: {
      status: ExpenseClaimStatus;
      approvedBy?: string;
      approvedAt?: string;
      paidAt?: string;
    }
  ): Promise<ExpenseClaim | null>;

  getFinancialPeriods(accessToken: string): Promise<FinancialPeriod[]>;
  createFinancialPeriod(accessToken: string, input: CreateFinancialPeriodInput): Promise<FinancialPeriod>;
  updateFinancialPeriod(
    accessToken: string,
    periodId: string,
    updates: {
      status: FinancialPeriodStatus;
      closedBy?: string;
      closedAt?: string;
    }
  ): Promise<FinancialPeriod | null>;
}

export function createSupabaseFinanceRepository(
  createUserScopedClient: (token: string) => SupabaseClient
): FinanceRepository {
  async function resolveTenant(client: SupabaseClient): Promise<string> {
    const { data: tenantId, error } = await client.rpc("current_tenant_id");
    if (error || !tenantId) {
      throw new Error("Unable to resolve tenant id for caller");
    }
    return tenantId as string;
  }

  return {
    async getCostCodes(accessToken, category) {
      const client = createUserScopedClient(accessToken);
      let query = client.from("cost_codes").select("*").eq("is_active", true).order("code", { ascending: true });
      if (category) {
        query = query.eq("category", category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CostCode[];
    },

    async createCostCode(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("cost_codes")
        .insert({
          tenant_id: tenantId,
          code: input.code,
          name: input.name,
          category: input.category,
          description: input.description || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CostCode;
    },

    async getProjectBudgets(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("project_budgets")
        .select("*")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectBudget[];
    },

    async getProjectBudgetById(accessToken, budgetId) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("project_budgets")
        .select("*")
        .eq("id", budgetId)
        .maybeSingle();
      if (error) throw error;
      return data as ProjectBudget | null;
    },

    async createProjectBudget(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      // Find latest version
      const { data: latest } = await client
        .from("project_budgets")
        .select("version_number")
        .eq("project_id", input.projectId)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = latest && latest.length > 0 && latest[0] ? (latest[0].version_number as number) + 1 : 1;

      const { data, error } = await client
        .from("project_budgets")
        .insert({
          tenant_id: tenantId,
          project_id: input.projectId,
          version_number: nextVersion,
          status: "draft",
          total_original_budget: 0,
          total_revised_budget: 0,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProjectBudget;
    },

    async updateProjectBudget(accessToken, budgetId, updates) {
      const client = createUserScopedClient(accessToken);
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.totalOriginalBudget !== undefined) payload.total_original_budget = updates.totalOriginalBudget;
      if (updates.totalRevisedBudget !== undefined) payload.total_revised_budget = updates.totalRevisedBudget;
      if (updates.approvedBy !== undefined) payload.approved_by = updates.approvedBy;
      if (updates.approvedAt !== undefined) payload.approved_at = updates.approvedAt;
      if (updates.notes !== undefined) payload.notes = updates.notes;

      const { data, error } = await client
        .from("project_budgets")
        .update(payload)
        .eq("id", budgetId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as ProjectBudget | null;
    },

    async getBudgetLines(accessToken, budgetId) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("project_budget_lines")
        .select("*, cost_code:cost_codes(*)")
        .eq("budget_id", budgetId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        estimate_at_completion: Number(row.actual_amount) + Number(row.estimate_to_complete),
        variance: Number(row.revised_amount) - (Number(row.actual_amount) + Number(row.estimate_to_complete)),
      })) as ProjectBudgetLine[];
    },

    async upsertBudgetLine(accessToken, budgetId, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const original = input.originalAmount;
      const revised = input.revisedAmount !== undefined ? input.revisedAmount : original;

      const { data, error } = await client
        .from("project_budget_lines")
        .upsert(
          {
            tenant_id: tenantId,
            budget_id: budgetId,
            cost_code_id: input.costCodeId,
            original_amount: original,
            revised_amount: revised,
            committed_amount: input.committedAmount || 0,
            actual_amount: input.actualAmount || 0,
            accrued_amount: input.accruedAmount || 0,
            estimate_to_complete: input.estimateToComplete !== undefined ? input.estimateToComplete : (revised - (input.actualAmount || 0)),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,budget_id,cost_code_id" }
        )
        .select("*, cost_code:cost_codes(*)")
        .single();
      if (error) throw error;
      return {
        ...data,
        estimate_at_completion: Number(data.actual_amount) + Number(data.estimate_to_complete),
        variance: Number(data.revised_amount) - (Number(data.actual_amount) + Number(data.estimate_to_complete)),
      } as ProjectBudgetLine;
    },

    async getBudgetRevisions(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("budget_revisions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BudgetRevision[];
    },

    async createBudgetRevision(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const revisionNumber = `REV-${Date.now().toString().slice(-6)}`;
      const { data, error } = await client
        .from("budget_revisions")
        .insert({
          tenant_id: tenantId,
          project_id: input.projectId,
          revision_number: revisionNumber,
          from_cost_code_id: input.fromCostCodeId || null,
          to_cost_code_id: input.toCostCodeId,
          amount: input.amount,
          reason: input.reason,
          status: "draft",
          requested_by: input.requestedBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BudgetRevision;
    },

    async updateBudgetRevision(accessToken, revisionId, updates) {
      const client = createUserScopedClient(accessToken);
      const payload: Record<string, unknown> = {
        status: updates.status,
        updated_at: new Date().toISOString(),
      };
      if (updates.approvedBy !== undefined) payload.approved_by = updates.approvedBy;
      if (updates.approvedAt !== undefined) payload.approved_at = updates.approvedAt;

      const { data, error } = await client
        .from("budget_revisions")
        .update(payload)
        .eq("id", revisionId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as BudgetRevision | null;
    },

    async getExpenseClaims(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      let query = client.from("expense_claims").select("*").order("created_at", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ExpenseClaim[];
    },

    async createExpenseClaim(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const claimNumber = `EXP-${Date.now().toString().slice(-6)}`;
      const { data, error } = await client
        .from("expense_claims")
        .insert({
          tenant_id: tenantId,
          project_id: input.projectId,
          cost_code_id: input.costCodeId,
          claim_number: claimNumber,
          claimant_name: input.claimantName,
          claim_date: input.claimDate || new Date().toISOString(),
          amount: input.amount,
          currency: input.currency || "AED",
          description: input.description,
          receipt_reference: input.receiptReference || null,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as ExpenseClaim;
    },

    async updateExpenseClaim(accessToken, claimId, updates) {
      const client = createUserScopedClient(accessToken);
      const payload: Record<string, unknown> = {
        status: updates.status,
        updated_at: new Date().toISOString(),
      };
      if (updates.approvedBy !== undefined) payload.approved_by = updates.approvedBy;
      if (updates.approvedAt !== undefined) payload.approved_at = updates.approvedAt;
      if (updates.paidAt !== undefined) payload.paid_at = updates.paidAt;

      const { data, error } = await client
        .from("expense_claims")
        .update(payload)
        .eq("id", claimId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as ExpenseClaim | null;
    },

    async getFinancialPeriods(accessToken) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("financial_periods")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data || []) as FinancialPeriod[];
    },

    async createFinancialPeriod(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("financial_periods")
        .insert({
          tenant_id: tenantId,
          period_name: input.periodName,
          start_date: input.startDate,
          end_date: input.endDate,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data as FinancialPeriod;
    },

    async updateFinancialPeriod(accessToken, periodId, updates) {
      const client = createUserScopedClient(accessToken);
      const payload: Record<string, unknown> = {
        status: updates.status,
        updated_at: new Date().toISOString(),
      };
      if (updates.closedBy !== undefined) payload.closed_by = updates.closedBy;
      if (updates.closedAt !== undefined) payload.closed_at = updates.closedAt;

      const { data, error } = await client
        .from("financial_periods")
        .update(payload)
        .eq("id", periodId)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as FinancialPeriod | null;
    },
  };
}
