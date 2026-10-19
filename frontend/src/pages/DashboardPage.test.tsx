import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "./DashboardPage";
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

const mockSession = { access_token: "test-token", user: { id: "user-1", email: "ceo@sevents.ae" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-1", name: "Downtown Commercial Tower Fitout", code: "PRJ-001" },
  { id: "proj-2", name: "Dubai Marina Hotel MEP Package", code: "PRJ-002" },
];

const EXECUTIVE_ANALYTICS = {
  total_projects: 4,
  active_projects: 3,
  on_track_projects: 2,
  at_risk_projects: 1,
  delayed_projects: 0,
  total_contract_value: 28500000,
  average_progress_pct: 64,
  pending_approvals_count: 5,
  critical_risks_count: 1,
  open_disputes_count: 1,
  recent_projects: [
    {
      id: "proj-1",
      name: "Downtown Commercial Tower Fitout",
      code: "PRJ-001",
      status: "active",
      progress_pct: 68,
      contract_amount: 14500000,
    },
    {
      id: "proj-2",
      name: "Dubai Marina Hotel MEP Package",
      code: "PRJ-002",
      status: "at_risk",
      progress_pct: 45,
      contract_amount: 14000000,
    },
  ],
};

const FINANCIAL_ANALYTICS = {
  total_budget: 25000000,
  committed_costs: 11200000,
  subcontractor_claims_certified: 6800000,
  actual_expenses: 1200000,
  total_invoiced: 16500000,
  cash_collected: 14200000,
  pending_variation_amount: 1850000,
  approved_variation_amount: 950000,
  retention_withheld: 1650000,
  retention_released: 450000,
  cost_variance: 5800000,
};

const OPERATIONS_ANALYTICS = {
  manpower_demanded: 180,
  manpower_mobilized: 165,
  manpower_efficiency_pct: 92,
  total_equipment_assets: 24,
  active_equipment_assets: 21,
  equipment_utilization_pct: 88,
  open_quality_ncrs: 4,
  closed_quality_ncrs: 28,
  quality_ncr_closure_rate_pct: 88,
  safe_man_hours: 124500,
  active_ptws_count: 9,
  open_safety_incidents: 1,
  open_hazards_count: 3,
};

const REPORTS = [
  {
    id: "rep-1",
    name: "Portfolio Status & Financial Overview",
    description: "Executive high-level summary",
    category: "executive",
    config: { entity: "projects" },
    is_preset: true,
    created_at: "2026-10-18T00:00:00Z",
  },
];

const GENERATED_REPORT = {
  entity: "projects",
  total_count: 2,
  columns: [
    { key: "code", label: "Project Code" },
    { key: "name", label: "Project Name" },
    { key: "status", label: "Status" },
    { key: "progress_pct", label: "Progress %" },
  ],
  rows: [
    { code: "PRJ-001", name: "Downtown Tower", status: "active", progress_pct: 68 },
    { code: "PRJ-002", name: "Marina Hotel", status: "at_risk", progress_pct: 45 },
  ],
  summary: { "Total Projects": 2 },
};

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <PermissionsProvider>
        <DashboardPage />
      </PermissionsProvider>
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (url: string) => {
      if (url === "/authority/effective-permissions") {
        return {
          permissions: [
            "dashboard.executive.view",
            "dashboard.financial.view",
            "dashboard.operations.view",
            "dashboard.reports.manage",
            "dashboard.reports.export",
          ],
        };
      }
      if (url === "/projects") {
        return { projects: PROJECTS };
      }
      if (url.includes("/dashboard/analytics/executive")) {
        return { analytics: EXECUTIVE_ANALYTICS };
      }
      if (url.includes("/dashboard/analytics/financial")) {
        return { analytics: FINANCIAL_ANALYTICS };
      }
      if (url.includes("/dashboard/analytics/operations")) {
        return { analytics: OPERATIONS_ANALYTICS };
      }
      if (url === "/dashboard/reports") {
        return { reports: REPORTS };
      }
      if (url === "/dashboard/reports/generate") {
        return { result: GENERATED_REPORT };
      }
      return {};
    });
  });

  it("renders the Executive Analytics cockpit title and main tabs", async () => {
    renderWithProviders();

    expect(await screen.findByText(/Executive Analytics & KPI Cockpit/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Executive Command Center/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Financial & Commercial/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Operations, Fleet & QHSE/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Custom Reports & Export/i })).toBeInTheDocument();
  });

  it("displays executive metrics and recent active projects", async () => {
    renderWithProviders();

    expect(await screen.findByText("Portfolio Contract Sum")).toBeInTheDocument();
    expect(screen.getByText("AED 28,500,000")).toBeInTheDocument();
    expect(screen.getByText("Downtown Commercial Tower Fitout")).toBeInTheDocument();
    expect(screen.getByText("Dubai Marina Hotel MEP Package")).toBeInTheDocument();
  });

  it("navigates to the Financial & Commercial tab and shows budget variance", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const finTab = await screen.findByRole("button", { name: /Financial & Commercial/i });
    await user.click(finTab);

    expect(await screen.findByText("Total Baseline Budget")).toBeInTheDocument();
    expect(screen.getByText("AED 25,000,000")).toBeInTheDocument();
    expect(screen.getByText("Budget Cost Variance")).toBeInTheDocument();
    expect(screen.getByText("AED 5,800,000")).toBeInTheDocument();
  });

  it("navigates to Operations, Fleet & QHSE tab and shows mobilization and safety", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const opsTab = await screen.findByRole("button", { name: /Operations, Fleet & QHSE/i });
    await user.click(opsTab);

    expect(await screen.findByText("Site Manpower Mobilization")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("Equipment Fleet Utilization")).toBeInTheDocument();
    expect(screen.getAllByText("88%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("124,500")).toBeInTheDocument(); // Safe man-hours
  });

  it("navigates to Custom Reports tab and allows generating and saving reports", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const reportsTab = await screen.findByRole("button", { name: /Custom Reports & Export/i });
    await user.click(reportsTab);

    expect(await screen.findByText("Portfolio Status & Financial Overview")).toBeInTheDocument();

    const generateBtn = screen.getByRole("button", { name: /Generate Live Report/i });
    await user.click(generateBtn);

    expect(await screen.findByText("Downtown Tower")).toBeInTheDocument();
    expect(screen.getByText("Marina Hotel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export to CSV/i })).toBeInTheDocument();

    // Open Save modal
    const saveReportBtn = screen.getByRole("button", { name: /\+ Save Custom Report/i });
    await user.click(saveReportBtn);

    expect(await screen.findByText("Save Custom Report Configuration")).toBeInTheDocument();
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText("Save Custom Report Configuration")).not.toBeInTheDocument();
    });
  });
});
