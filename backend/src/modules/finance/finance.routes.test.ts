import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeFinanceRepository } from "../../test/fakeFinanceRepository.js";

describe("M21: Finance, Budgets & Cost Control routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let financeRepo: FakeFinanceRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "finance.budget.manage",
    "finance.budget.approve",
    "finance.forecast.manage",
    "finance.expense.manage",
    "finance.expense.approve",
    "finance.period.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    financeRepo = new FakeFinanceRepository();

    // Tenant A setup
    authRepo.addSession(tokenA, userA, tenantA);
    authRepo.roleAssignments.set("seed-admin-a", {
      id: "seed-admin-a",
      tenant_id: tenantA,
      user_id: userA,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));
    financeRepo.addSession(tokenA, userA, tenantA);

    // Tenant B setup
    authRepo.addSession(tokenB, userB, tenantB);
    authRepo.roleAssignments.set("seed-admin-b", {
      id: "seed-admin-b",
      tenant_id: tenantB,
      user_id: userB,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));
    financeRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getFinanceRepository: () => financeRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeader = (token: string) => ({
    authorization: `Bearer ${token}`,
  });

  it("manages cost codes register by category", async () => {
    const resCreate = await app.inject({
      method: "POST",
      url: "/finance/cost-codes",
      headers: authHeader(tokenA),
      payload: {
        code: "03-CONCRETE",
        name: "Structural Concrete & Rebar",
        category: "materials",
        description: "Ready-mix concrete C40/50 and high tensile rebar",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const costCode = resCreate.json().costCode;
    expect(costCode.code).toBe("03-CONCRETE");
    expect(costCode.category).toBe("materials");

    const resList = await app.inject({
      method: "GET",
      url: "/finance/cost-codes?category=materials",
      headers: authHeader(tokenA),
    });

    expect(resList.statusCode).toBe(200);
    expect(resList.json().costCodes).toHaveLength(1);
    expect(resList.json().costCodes[0].name).toBe("Structural Concrete & Rebar");
  });

  it("manages project budget lifecycle, line-item CBS, and auto-calculates EAC & variance", async () => {
    // 1. Create a cost code
    const resCc = await app.inject({
      method: "POST",
      url: "/finance/cost-codes",
      headers: authHeader(tokenA),
      payload: {
        code: "02-SUBSTRUCT",
        name: "Substructure & Deep Piling",
        category: "subcontractor",
      },
    });
    const costCodeId = resCc.json().costCode.id;

    // 2. Create a project budget
    const resBudget = await app.inject({
      method: "POST",
      url: "/finance/projects/proj-101/budgets",
      headers: authHeader(tokenA),
      payload: { notes: "Initial baseline budget for Tower Alpha" },
    });
    expect(resBudget.statusCode).toBe(201);
    const budgetId = resBudget.json().budget.id;
    expect(resBudget.json().budget.version_number).toBe(1);
    expect(resBudget.json().budget.status).toBe("draft");

    // 3. Add line item
    const resLine = await app.inject({
      method: "POST",
      url: `/finance/budgets/${budgetId}/lines`,
      headers: authHeader(tokenA),
      payload: {
        costCodeId,
        originalAmount: 500000,
        committedAmount: 200000,
        actualAmount: 150000,
        estimateToComplete: 320000,
      },
    });
    expect(resLine.statusCode).toBe(200);
    const line = resLine.json().line;
    expect(line.estimate_at_completion).toBe(470000); // 150000 actual + 320000 etc
    expect(line.variance).toBe(30000); // 500000 revised - 470000 eac

    // 4. View budget details with summary
    const resDetail = await app.inject({
      method: "GET",
      url: `/finance/budgets/${budgetId}`,
      headers: authHeader(tokenA),
    });
    expect(resDetail.statusCode).toBe(200);
    const detail = resDetail.json();
    expect(detail.summary.totalOriginal).toBe(500000);
    expect(detail.summary.totalActual).toBe(150000);
    expect(detail.summary.totalEstimateAtCompletion).toBe(470000);
    expect(detail.summary.totalVariance).toBe(30000);

    // 5. Submit budget
    const resSubmit = await app.inject({
      method: "POST",
      url: `/finance/budgets/${budgetId}/submit`,
      headers: authHeader(tokenA),
    });
    expect(resSubmit.statusCode).toBe(200);
    expect(resSubmit.json().budget.status).toBe("submitted");

    // 6. Approve and lock baseline
    const resApprove = await app.inject({
      method: "POST",
      url: `/finance/budgets/${budgetId}/approve`,
      headers: authHeader(tokenA),
      payload: {
        approvedBy: "CFO Jane Smith",
        lockBaseline: true,
      },
    });
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.json().budget.status).toBe("locked_baseline");
  });

  it("handles budget revisions and reallocation workflow", async () => {
    // Setup cost code
    const resCc = await app.inject({
      method: "POST",
      url: "/finance/cost-codes",
      headers: authHeader(tokenA),
      payload: { code: "05-FINISH", name: "Finishes", category: "materials" },
    });
    const costCodeId = resCc.json().costCode.id;

    // Create budget revision request
    const resRev = await app.inject({
      method: "POST",
      url: "/finance/projects/proj-101/revisions",
      headers: authHeader(tokenA),
      payload: {
        toCostCodeId: costCodeId,
        amount: 25000,
        reason: "Additional premium marble specification per client request",
        requestedBy: "Project Engineer",
      },
    });
    expect(resRev.statusCode).toBe(201);
    const revision = resRev.json().revision;
    expect(revision.status).toBe("draft");
    expect(revision.amount).toBe(25000);

    // Authorize revision
    const resAuth = await app.inject({
      method: "POST",
      url: `/finance/revisions/${revision.id}/authorize`,
      headers: authHeader(tokenA),
      payload: {
        status: "approved",
        approvedBy: "Finance Manager",
      },
    });
    expect(resAuth.statusCode).toBe(200);
    expect(resAuth.json().revision.status).toBe("approved");
  });

  it("enforces closed financial period protection on expense claims", async () => {
    // 1. Create a cost code
    const resCc = await app.inject({
      method: "POST",
      url: "/finance/cost-codes",
      headers: authHeader(tokenA),
      payload: { code: "06-SITE-EXP", name: "Site Expenses", category: "overhead" },
    });
    const costCodeId = resCc.json().costCode.id;

    // 2. Create financial period for September 2026 and close it
    const resPeriod = await app.inject({
      method: "POST",
      url: "/finance/periods",
      headers: authHeader(tokenA),
      payload: {
        periodName: "2026-09",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      },
    });
    const periodId = resPeriod.json().period.id;

    await app.inject({
      method: "POST",
      url: `/finance/periods/${periodId}/close`,
      headers: authHeader(tokenA),
      payload: { closedBy: "Chief Financial Officer" },
    });

    // 3. Attempting to backdate an expense claim into September 2026 must be rejected
    const resFail = await app.inject({
      method: "POST",
      url: "/finance/expense-claims",
      headers: authHeader(tokenA),
      payload: {
        projectId: "proj-101",
        costCodeId,
        claimantName: "Site Engineer",
        claimDate: "2026-09-15T00:00:00Z",
        amount: 1200,
        description: "Emergency site generator diesel purchase",
      },
    });
    expect(resFail.statusCode).toBe(400);
    expect(resFail.json().error).toContain("closed financial period");

    // 4. Submitting in an open period succeeds
    const resSuccess = await app.inject({
      method: "POST",
      url: "/finance/expense-claims",
      headers: authHeader(tokenA),
      payload: {
        projectId: "proj-101",
        costCodeId,
        claimantName: "Site Engineer",
        claimDate: "2026-10-18T00:00:00Z",
        amount: 850,
        description: "Survey equipment batteries and calibration kit",
      },
    });
    expect(resSuccess.statusCode).toBe(201);
    const claim = resSuccess.json().claim;
    expect(claim.status).toBe("draft");

    // Authorize claim
    const resApprove = await app.inject({
      method: "POST",
      url: `/finance/expense-claims/${claim.id}/authorize`,
      headers: authHeader(tokenA),
      payload: {
        status: "approved",
        approvedBy: "Finance Controller",
      },
    });
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.json().claim.status).toBe("approved");
  });

  it("enforces tenant isolation across all finance records", async () => {
    // Tenant A creates cost code and budget
    const resA = await app.inject({
      method: "POST",
      url: "/finance/cost-codes",
      headers: authHeader(tokenA),
      payload: { code: "CC-A-1", name: "Tenant A Code", category: "materials" },
    });
    expect(resA.statusCode).toBe(201);

    // Tenant B cannot see Tenant A's cost code
    const resB = await app.inject({
      method: "GET",
      url: "/finance/cost-codes",
      headers: authHeader(tokenB),
    });
    expect(resB.statusCode).toBe(200);
    expect(resB.json().costCodes).toHaveLength(0);
  });
});
