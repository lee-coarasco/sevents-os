import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FinancePage } from "./FinancePage";
import { PermissionsProvider } from "../context/PermissionsContext";

const apiFetch = vi.fn();

vi.mock("../lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockSession = { access_token: "test-token", user: { email: "finance.controller@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const COST_CODES = [
  { id: "cc-1", code: "02-SUBSTRUCT", name: "Substructure & Deep Piling", category: "subcontractor", is_active: true },
  { id: "cc-2", code: "03-CONCRETE", name: "Structural Concrete & Rebar", category: "materials", is_active: true },
];

const BUDGETS = [
  {
    id: "b-1",
    project_id: "proj-101",
    version_number: 1,
    status: "approved",
    total_original_budget: 1500000,
    total_revised_budget: 1550000,
    approved_by: "cfo@example.com",
    approved_at: "2026-10-18T00:00:00Z",
    notes: "Approved master baseline",
    created_at: "2026-10-18T00:00:00Z",
  },
];

const BUDGET_DETAIL = {
  budget: BUDGETS[0],
  lines: [
    {
      id: "line-1",
      budget_id: "b-1",
      cost_code_id: "cc-1",
      cost_code: COST_CODES[0],
      original_amount: 500000,
      revised_amount: 500000,
      committed_amount: 300000,
      actual_amount: 200000,
      accrued_amount: 50000,
      estimate_to_complete: 280000,
      estimate_at_completion: 480000,
      variance: 20000,
    },
  ],
  summary: {
    totalOriginal: 500000,
    totalRevised: 500000,
    totalCommitted: 300000,
    totalActual: 200000,
    totalAccrued: 50000,
    totalEstimateAtCompletion: 480000,
    totalVariance: 20000,
  },
};

const REVISIONS = [
  {
    id: "rev-1",
    project_id: "proj-101",
    revision_number: "REV-001",
    from_cost_code_id: null,
    to_cost_code_id: "cc-1",
    amount: 50000,
    reason: "Piling depth variation instruction #04",
    status: "approved",
    requested_by: "Project Manager",
    approved_by: "cfo@example.com",
    approved_at: "2026-10-18T00:00:00Z",
    created_at: "2026-10-18T00:00:00Z",
  },
];

const EXPENSES = [
  {
    id: "exp-1",
    project_id: "proj-101",
    cost_code_id: "cc-1",
    claim_number: "EXP-101",
    claimant_name: "Ahmed Al-Mansoor",
    claim_date: "2026-10-18T00:00:00Z",
    amount: 1450,
    currency: "AED",
    description: "Urgent core-drilling diamond bits",
    receipt_reference: "INV-9921",
    status: "approved",
    approved_by: "finance@example.com",
    approved_at: "2026-10-18T00:00:00Z",
    paid_at: null,
    created_at: "2026-10-18T00:00:00Z",
  },
];

const PERIODS = [
  {
    id: "fp-1",
    period_name: "2026-10",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    status: "open",
    closed_by: null,
    closed_at: null,
    created_at: "2026-10-01T00:00:00Z",
  },
];

describe("FinancePage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/projects") return { projects: PROJECTS };
      if (path.includes("/authority/effective-permissions") || path.includes("/authority/my-permissions")) {
        return {
          permissions: [
            "finance.budget.manage",
            "finance.budget.approve",
            "finance.forecast.manage",
            "finance.expense.manage",
            "finance.expense.approve",
            "finance.period.manage",
          ],
        };
      }
      if (path.includes("/finance/cost-codes")) return { costCodes: COST_CODES };
      if (path.includes("/finance/periods")) return { periods: PERIODS };
      if (path.includes("/finance/budgets/b-1")) return BUDGET_DETAIL;
      if (path.includes("/finance/projects/proj-101/budgets")) return { budgets: BUDGETS };
      if (path.includes("/finance/projects/proj-101/revisions")) return { revisions: REVISIONS };
      if (path.includes("/finance/expense-claims")) return { claims: EXPENSES };
      return {};
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <PermissionsProvider>
          <FinancePage />
        </PermissionsProvider>
      </MemoryRouter>
    );

  it("renders page header and budget summary cards by default", async () => {
    renderComponent();

    expect(await screen.findByText("Finance, Budgets & Cost Control")).toBeInTheDocument();
    expect(await screen.findByText("02-SUBSTRUCT")).toBeInTheDocument();
    expect(screen.getByText("Substructure & Deep Piling")).toBeInTheDocument();
    expect(screen.getAllByText(/4.*80.*000/).length).toBeGreaterThan(0); // EAC
    expect(screen.getAllByText(/20.*000/).length).toBeGreaterThan(0); // Variance
  });

  it("switches to Budget Revisions tab and displays revisions", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Finance, Budgets & Cost Control");
    const revTab = screen.getByRole("button", { name: /Budget Revisions & Transfers/i });
    await user.click(revTab);

    expect(await screen.findByText("REV-001")).toBeInTheDocument();
    expect(screen.getByText("Piling depth variation instruction #04")).toBeInTheDocument();
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
  });

  it("switches to Expense Claims tab and renders claims", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Finance, Budgets & Cost Control");
    const expTab = screen.getByRole("button", { name: /Expense Claims & Petty Cash/i });
    await user.click(expTab);

    expect(await screen.findByText("EXP-101")).toBeInTheDocument();
    expect(screen.getByText("Ahmed Al-Mansoor")).toBeInTheDocument();
    expect(screen.getByText("Urgent core-drilling diamond bits")).toBeInTheDocument();
    expect(screen.getByText(/1,450/)).toBeInTheDocument();
  });

  it("switches to Financial Periods tab and displays open period", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Finance, Budgets & Cost Control");
    const periodTab = screen.getByRole("button", { name: /Financial Periods & Controls/i });
    await user.click(periodTab);

    expect(await screen.findByText("2026-10")).toBeInTheDocument();
    expect(screen.getByText("2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("2026-10-31")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close Accounting Period/i })).toBeInTheDocument();
  });

  it("opens '+ Add Budget Line' modal when clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    const addLineBtn = await screen.findByRole("button", { name: /\+ Add Budget Line/i });
    await user.click(addLineBtn);

    expect(await screen.findByText("Add or Update Budget Line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Budget Line/i })).toBeInTheDocument();
  });
});
