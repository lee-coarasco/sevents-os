import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QualityPage } from "./QualityPage";
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

const mockSession = { access_token: "test-token", user: { email: "qhse.lead@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const WIRS = [
  {
    id: "wir-1",
    project_id: "proj-101",
    plan_id: "plan-1",
    plan_title: "Substructure Concrete Pouring ITP",
    wir_number: "WIR-CIV-042",
    title: "Foundation Slab Grid B2-B6 Pre-Pour Inspection",
    trade_discipline: "civil",
    location_or_grid: "Grid B2-B6 Level B1",
    inspection_date: "2026-10-18",
    status: "approved",
    contractor_representative: "Eng. Ahmed",
    inspector_name: "Robert Smith",
    inspector_remarks: "All cover blocks verified",
    signed_off_at: "2026-10-18T14:00:00Z",
    created_at: "2026-10-18T08:00:00Z",
    checklist: [
      {
        id: "chk-1",
        wir_id: "wir-1",
        item_sequence: 1,
        checkpoint_description: "Vapour barrier membrane overlap sealed",
        result: "pass",
        comments: "Double taped",
      },
    ],
  },
];

const NCRS = [
  {
    id: "ncr-1",
    project_id: "proj-101",
    wir_id: null,
    wir_number: undefined,
    ncr_number: "NCR-STR-008",
    title: "Honeycomb voiding in Column C3",
    trade_discipline: "structural",
    location_or_grid: "Grid C3 Ground Floor",
    severity: "major",
    status: "open",
    issue_description: "Severe honeycombing and exposed aggregate observed",
    root_cause_category: "workmanship",
    issued_by: "QHSE Lead Engineer",
    issued_to: "Concrete Subcontractor",
    target_closure_date: "2026-10-25",
    containment_action: "No load on beam above",
    corrective_action_plan: null,
    preventive_action_plan: null,
    closed_by: null,
    closed_at: null,
    closure_remarks: null,
    created_at: "2026-10-18T09:00:00Z",
  },
];

const ITPS = [
  {
    id: "plan-1",
    project_id: "proj-101",
    plan_number: "ITP-CIV-001",
    title: "Substructure Concrete Pouring ITP",
    trade_discipline: "civil",
    version: "v1.0",
    status: "approved",
    applicable_specifications: "BS EN 206",
    created_at: "2026-10-15T00:00:00Z",
    items: [
      {
        id: "itp-item-1",
        plan_id: "plan-1",
        item_sequence: 1,
        activity_name: "Rebar Placement",
        acceptance_criteria: "+/- 5mm tolerance",
        point_type: "hold_point",
        reference_standard: "BS 8666",
        verifying_document: "Bar Bending Sheet",
      },
    ],
  },
];

describe("QualityPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/projects") return { projects: PROJECTS };
      if (path.includes("/authority/effective-permissions") || path.includes("/authority/my-permissions")) {
        return {
          permissions: [
            "quality.inspection.manage",
            "quality.inspection.signoff",
            "quality.ncr.manage",
            "quality.ncr.close",
            "quality.itp.manage",
          ],
        };
      }
      if (path.includes("/quality/wirs")) return { wirs: WIRS };
      if (path.includes("/quality/ncrs")) return { ncrs: NCRS };
      if (path.includes("/quality/plans")) return { plans: ITPS };
      return {};
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <PermissionsProvider>
          <QualityPage />
        </PermissionsProvider>
      </MemoryRouter>
    );

  it("renders page header and quality inspection requests by default", async () => {
    renderComponent();

    expect(await screen.findByText("Quality Control, Inspection & NCR")).toBeInTheDocument();
    expect(await screen.findByText("WIR-CIV-042")).toBeInTheDocument();
    expect(screen.getByText("Foundation Slab Grid B2-B6 Pre-Pour Inspection")).toBeInTheDocument();
    expect(screen.getByText("✓ Approved")).toBeInTheDocument();
  });

  it("switches to NCR tab and displays non-conformance reports", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Quality Control, Inspection & NCR");
    const ncrTab = screen.getByRole("button", { name: /Non-Conformance Reports/i });
    await user.click(ncrTab);

    expect(await screen.findByText("NCR-STR-008")).toBeInTheDocument();
    expect(screen.getByText("Honeycomb voiding in Column C3")).toBeInTheDocument();
    expect(screen.getByText("Major")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("switches to ITP tab and displays quality plans with checkpoints", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Quality Control, Inspection & NCR");
    const itpTab = screen.getByRole("button", { name: /Inspection & Test Plans/i });
    await user.click(itpTab);

    expect(await screen.findByText("ITP-CIV-001")).toBeInTheDocument();
    expect(screen.getByText("Substructure Concrete Pouring ITP")).toBeInTheDocument();
    expect(screen.getByText("Rebar Placement")).toBeInTheDocument();
    expect(screen.getByText("HOLD POINT")).toBeInTheDocument();
  });

  it("opens WIR review drawer on click", async () => {
    const user = userEvent.setup();
    renderComponent();

    const reviewBtn = await screen.findByRole("button", { name: /Review & Sign-off →/i });
    await user.click(reviewBtn);

    expect(await screen.findByText("Inspection Checklist Criteria")).toBeInTheDocument();
    expect(screen.getByText("Vapour barrier membrane overlap sealed")).toBeInTheDocument();
    expect(screen.getByText("Quality Sign-off Determination")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Execute Sign-off" })).toBeInTheDocument();
  });
});
