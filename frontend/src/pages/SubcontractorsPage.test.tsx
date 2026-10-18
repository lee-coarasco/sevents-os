import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SubcontractorsPage } from "./SubcontractorsPage";
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

const mockSession = { access_token: "test-token", user: { email: "site.qs@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const VENDORS = [
  { id: "ven-1", name: "Al Futtaim Engineering", category: "specialist_contractor" },
];

const WORK_ORDERS = [
  {
    id: "wo-1",
    project_id: "proj-101",
    vendor_id: "ven-1",
    vendor_name: "Al Futtaim Engineering",
    work_order_number: "WO-MEP-001",
    title: "HVAC Ductwork & Chilled Water Package",
    trade_discipline: "mep",
    contract_value: 450000,
    retention_rate_pct: 10.0,
    start_date: "2026-11-01",
    completion_date: "2027-04-30",
    status: "active",
    scope_of_work: "Complete installation of ductwork and pumps",
    created_at: "2026-10-18T10:00:00Z",
  },
];

const MILESTONES = [
  {
    id: "ms-1",
    work_order_id: "wo-1",
    milestone_name: "Basement 1 & 2 Rough-in",
    description: "Install primary galvanized ducts",
    amount: 150000,
    planned_date: "2026-12-15",
    status: "pending",
  },
];

const ATTENDANCE = [
  {
    id: "att-1",
    project_id: "proj-101",
    work_order_id: "wo-1",
    work_order_title: "HVAC Ductwork & Chilled Water Package",
    date: "2026-10-18",
    trade: "MEP Electricians & Helpers",
    skilled_count: 12,
    unskilled_count: 6,
    total_hours: 8.5,
    supervisor_name: "Farhan Qureshi",
    notes: "Basement duct hanger bracket fabrication",
  },
];

const MEASURED_WORKS = [
  {
    id: "mw-1",
    work_order_id: "wo-1",
    work_order_title: "HVAC Ductwork & Chilled Water Package",
    measurement_date: "2026-10-18",
    wbs_code: "04-MEP",
    boq_item_reference: "BOQ-HVAC-01",
    description: "Rectangular GI Sheet Metal Ducting",
    uom: "SQM",
    quantity_measured: 250,
    unit_rate: 65,
    certified_amount: 16250,
    measured_by: "Engr. Nader",
    status: "draft",
  },
];

const PAYMENT_CLAIMS = [
  {
    id: "claim-1",
    project_id: "proj-101",
    work_order_id: "wo-1",
    work_order_title: "HVAC Ductwork & Chilled Water Package",
    claim_number: "IPC-01",
    period_start: "2026-10-01",
    period_end: "2026-10-15",
    claimed_amount: 80000,
    certified_amount: 80000,
    retention_deducted: 8000,
    net_payable_amount: 72000,
    status: "submitted",
    submitted_at: "2026-10-18T10:00:00Z",
    certified_at: null,
    notes: "Interim payment claim 1",
  },
];

describe("SubcontractorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") {
        return {
          direct_permissions: [
            "subcontractor.workorder.manage",
            "subcontractor.workorder.view",
            "subcontractor.attendance.manage",
            "subcontractor.claims.manage",
            "subcontractor.claims.certify",
          ],
          inherited_permissions: [],
        };
      }
      if (path === "/projects") {
        return { projects: PROJECTS };
      }
      if (path === "/procurement/vendors") {
        return { vendors: VENDORS };
      }
      if (path === "/projects/proj-101/subcontractors/work-orders") {
        return { workOrders: WORK_ORDERS };
      }
      if (path === "/subcontractors/work-orders/wo-1") {
        return { workOrder: WORK_ORDERS[0], milestones: MILESTONES };
      }
      if (path.startsWith("/projects/proj-101/subcontractors/attendance")) {
        return { logs: ATTENDANCE };
      }
      if (path === "/subcontractors/work-orders/wo-1/measured-works") {
        return { measuredWorks: MEASURED_WORKS };
      }
      if (path === "/projects/proj-101/subcontractors/payment-claims") {
        return { claims: PAYMENT_CLAIMS };
      }
      return {};
    });
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <PermissionsProvider>
          <SubcontractorsPage />
        </PermissionsProvider>
      </MemoryRouter>
    );
  }

  it("renders header and tabs correctly", async () => {
    renderPage();

    expect(await screen.findByText("Subcontractors & Labour Operations")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Work Packages/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Daily Manpower/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Measured Work/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Payment Claims/i })).toBeInTheDocument();
  });

  it("renders subcontractor work orders list", async () => {
    renderPage();

    expect(await screen.findByText("WO-MEP-001")).toBeInTheDocument();
    expect(screen.getByText("HVAC Ductwork & Chilled Water Package")).toBeInTheDocument();
    expect(screen.getByText("Al Futtaim Engineering")).toBeInTheDocument();
    expect(screen.getByText(/4,?50,?000/)).toBeInTheDocument();
    expect(screen.getByText(/10%/)).toBeInTheDocument();
  });

  it("switches to Daily Manpower tab and shows attendance records", async () => {
    const user = userEvent.setup();
    renderPage();

    const attendanceTab = await screen.findByRole("tab", { name: /Daily Manpower/i });
    await user.click(attendanceTab);

    expect(await screen.findByText("MEP Electricians & Helpers")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Farhan Qureshi")).toBeInTheDocument();
  });

  it("switches to Payment Claims tab and shows claim with retention deductions", async () => {
    const user = userEvent.setup();
    renderPage();

    const claimsTab = await screen.findByRole("tab", { name: /Payment Claims/i });
    await user.click(claimsTab);

    expect(await screen.findByText("IPC-01")).toBeInTheDocument();
    expect(screen.getAllByText(/80,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/-8,000/)).toBeInTheDocument();
    expect(screen.getByText(/72,000/)).toBeInTheDocument();
  });
});
