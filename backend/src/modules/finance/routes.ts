import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { FinanceRepository } from "./repository.js";
import { FinanceService } from "./service.js";
import type { CostCodeCategory } from "./types.js";

export interface FinanceRoutesOptions {
  getRepository: () => FinanceRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerFinanceRoutes(options: FinanceRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new FinanceService(options.getRepository());

    const budgetManageGuard = { preHandler: [options.permissionGuard("finance.budget.manage")] };
    const budgetApproveGuard = { preHandler: [options.permissionGuard("finance.budget.approve")] };
    const forecastManageGuard = { preHandler: [options.permissionGuard("finance.forecast.manage")] };
    const expenseManageGuard = { preHandler: [options.permissionGuard("finance.expense.manage")] };
    const expenseApproveGuard = { preHandler: [options.permissionGuard("finance.expense.approve")] };
    const periodManageGuard = { preHandler: [options.permissionGuard("finance.period.manage")] };

    // =======================================================================
    // 1. COST CODES
    // =======================================================================

    app.get<{ Querystring: { category?: CostCodeCategory } }>(
      "/finance/cost-codes",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const costCodes = await service.listCostCodes(token, req.query.category);
          return reply.send({ costCodes });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Body: {
        code: string;
        name: string;
        category: CostCodeCategory;
        description?: string;
      };
    }>(
      "/finance/cost-codes",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const costCode = await service.createCostCode(token, req.body);
          return reply.status(201).send({ costCode });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. PROJECT BUDGETS & CBS LINES
    // =======================================================================

    app.get<{ Params: { projectId: string } }>(
      "/finance/projects/:projectId/budgets",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const budgets = await service.listProjectBudgets(token, req.params.projectId);
          return reply.send({ budgets });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { projectId: string };
      Body: { notes?: string };
    }>(
      "/finance/projects/:projectId/budgets",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const budget = await service.createProjectBudget(token, {
            projectId: req.params.projectId,
            notes: req.body?.notes,
          });
          return reply.status(201).send({ budget });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.get<{ Params: { budgetId: string } }>(
      "/finance/budgets/:budgetId",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const detail = await service.getBudgetDetail(token, req.params.budgetId);
          return reply.send(detail);
        } catch (err: any) {
          return reply.status(404).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { budgetId: string };
      Body: {
        costCodeId: string;
        originalAmount: number;
        revisedAmount?: number;
        committedAmount?: number;
        actualAmount?: number;
        accruedAmount?: number;
        estimateToComplete?: number;
      };
    }>(
      "/finance/budgets/:budgetId/lines",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const line = await service.upsertBudgetLine(token, req.params.budgetId, req.body);
          return reply.status(200).send({ line });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { budgetId: string } }>(
      "/finance/budgets/:budgetId/submit",
      budgetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const budget = await service.submitBudget(token, req.params.budgetId);
          return reply.send({ budget });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { budgetId: string };
      Body: {
        approvedBy: string;
        lockBaseline?: boolean;
      };
    }>(
      "/finance/budgets/:budgetId/approve",
      budgetApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const budget = await service.approveBudget(
            token,
            req.params.budgetId,
            req.body?.approvedBy || "Finance Approver",
            Boolean(req.body?.lockBaseline)
          );
          return reply.send({ budget });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. BUDGET REVISIONS & REALLOCATIONS
    // =======================================================================

    app.get<{ Params: { projectId: string } }>(
      "/finance/projects/:projectId/revisions",
      forecastManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const revisions = await service.listBudgetRevisions(token, req.params.projectId);
          return reply.send({ revisions });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { projectId: string };
      Body: {
        fromCostCodeId?: string;
        toCostCodeId: string;
        amount: number;
        reason: string;
        requestedBy: string;
      };
    }>(
      "/finance/projects/:projectId/revisions",
      forecastManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const revision = await service.createBudgetRevision(token, {
            ...req.body,
            projectId: req.params.projectId,
          });
          return reply.status(201).send({ revision });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { revisionId: string };
      Body: {
        status: "approved" | "rejected";
        approvedBy?: string;
      };
    }>(
      "/finance/revisions/:revisionId/authorize",
      forecastManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const revision = await service.authorizeBudgetRevision(
            token,
            req.params.revisionId,
            req.body.status,
            req.body?.approvedBy || "Finance Director"
          );
          return reply.send({ revision });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. EXPENSE CLAIMS & PETTY CASH
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/finance/expense-claims",
      expenseManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claims = await service.listExpenseClaims(token, req.query.projectId);
          return reply.send({ claims });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Body: {
        projectId: string;
        costCodeId: string;
        claimantName: string;
        claimDate?: string;
        amount: number;
        currency?: string;
        description: string;
        receiptReference?: string;
      };
    }>(
      "/finance/expense-claims",
      expenseManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claim = await service.createExpenseClaim(token, req.body);
          return reply.status(201).send({ claim });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { claimId: string };
      Body: {
        status: "approved" | "paid" | "rejected";
        approvedBy?: string;
      };
    }>(
      "/finance/expense-claims/:claimId/authorize",
      expenseApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claim = await service.authorizeExpenseClaim(
            token,
            req.params.claimId,
            req.body.status,
            req.body?.approvedBy || "Finance Approver"
          );
          return reply.send({ claim });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 5. FINANCIAL PERIODS
    // =======================================================================

    app.get(
      "/finance/periods",
      periodManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const periods = await service.listFinancialPeriods(token);
          return reply.send({ periods });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Body: {
        periodName: string;
        startDate: string;
        endDate: string;
      };
    }>(
      "/finance/periods",
      periodManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const period = await service.createFinancialPeriod(token, req.body);
          return reply.status(201).send({ period });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{
      Params: { periodId: string };
      Body: { closedBy?: string };
    }>(
      "/finance/periods/:periodId/close",
      periodManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const period = await service.closeFinancialPeriod(
            token,
            req.params.periodId,
            req.body?.closedBy || "Financial Controller"
          );
          return reply.send({ period });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
