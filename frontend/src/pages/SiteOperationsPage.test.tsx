import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SiteOperationsPage } from "./SiteOperationsPage";
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

const mockSession = { access_token: "test-token", user: { email: "site.engineer@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const DPRS = [
  {
    id: "dpr-1",
    tenant_id: "tenant-a",
    project_id: "proj-101",
    report_date: "2026-10-18",
    status: "draft",
    weather_condition: "sunny",
    temperature_celsius: 31.5,
    weather_impact: "none",
    general_notes: "Ground floor column casting ongoing.",
    site_engineer_id: null,
    supervisor_id: null,
    approved_at: null,
    approved_by: null,
    rejection_reason: null,
    created_at: "2026-10-18T08:00:00Z",
    updated_at: "2026-10-18T08:00:00Z",
  },
];

const DPR_DETAIL = {
  report: DPRS[0],
  manpowerEntries: [
    {
      id: "mp-1",
      tenant_id: "tenant-a",
      dpr_id: "dpr-1",
      trade: "Steel Fixers",
      headcount: 14,
      hours_worked: 8,
      subcontractor_name: "Apex Rebar Ltd",
      notes: "Grid C rebar tying",
      created_at: "2026-10-18T08:30:00Z",
    },
  ],
  equipmentEntries: [
    {
      id: "eq-1",
      tenant_id: "tenant-a",
      dpr_id: "dpr-1",
      equipment_type: "Tower Crane 50T",
      quantity: 1,
      operating_hours: 8,
      idle_hours: 0,
      notes: "Lifting rebar bundles",
      created_at: "2026-10-18T08:30:00Z",
    },
  ],
  workProgressEntries: [
    {
      id: "wp-1",
      tenant_id: "tenant-a",
      dpr_id: "dpr-1",
      schedule_activity_id: null,
      location_or_grid: "Grid B1-B5",
      description: "Concrete casting of Level 2 columns",
      quantity_executed: 35,
      uom: "cum",
      notes: "Batch tickets verified",
      created_at: "2026-10-18T09:00:00Z",
    },
  ],
  blockers: [
    {
      id: "bl-1",
      tenant_id: "tenant-a",
      dpr_id: "dpr-1",
      category: "material_shortage",
      description: "Ready-mix truck delayed by traffic",
      impact_hours: 1.5,
      resolution_action: "Rerouted second delivery",
      status: "open",
      created_at: "2026-10-18T09:30:00Z",
    },
  ],
};

const INSTRUCTIONS = [
  {
    id: "ins-1",
    tenant_id: "tenant-a",
    project_id: "proj-101",
    dpr_id: null,
    instruction_number: "SI-2026-001",
    issued_by: "Structural Consultant",
    recipient: "Lead Contractor",
    instruction_text: "Install extra bracing at Shear Wall SW-3 before pour.",
    priority: "urgent",
    status: "open",
    target_completion_date: "2026-10-20",
    issued_at: "2026-10-18T10:00:00Z",
  },
];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/projects") return Promise.resolve({ projects: PROJECTS });
    if (path === "/projects/proj-101/site/dprs") return Promise.resolve({ dprs: DPRS });
    if (path === "/site/dprs/dpr-1") return Promise.resolve({ dpr: DPR_DETAIL });
    if (path === "/projects/proj-101/site/instructions") return Promise.resolve({ instructions: INSTRUCTIONS });
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({
        permissions: ["site.dpr.manage", "site.dpr.approve", "site.instruction.manage"],
      });
    }
    return Promise.resolve({});
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PermissionsProvider>
        <SiteOperationsPage />
      </PermissionsProvider>
    </MemoryRouter>,
  );
}

describe("SiteOperationsPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("renders page header and DPR list", async () => {
    renderPage();

    expect(await screen.findByText("Site Operations & DPR")).toBeInTheDocument();
    expect(await screen.findByText("2026-10-18")).toBeInTheDocument();
    expect(screen.getByText("Ground floor column casting ongoing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new dpr/i })).toBeInTheDocument();
  });

  it("opens DPR workspace with child entry logs", async () => {
    const user = userEvent.setup();
    renderPage();

    const openBtn = await screen.findByRole("button", { name: /open workspace/i });
    await user.click(openBtn);

    expect(await screen.findByText("DPR for 2026-10-18")).toBeInTheDocument();
    expect(screen.getByText("Steel Fixers")).toBeInTheDocument();
    expect(screen.getByText("Apex Rebar Ltd")).toBeInTheDocument();
    expect(screen.getByText(/14 workers/i)).toBeInTheDocument();
  });

  it("switches to equipment and work progress tabs in workspace", async () => {
    const user = userEvent.setup();
    renderPage();

    const openBtn = await screen.findByRole("button", { name: /open workspace/i });
    await user.click(openBtn);

    // Switch to Equipment tab
    const eqTab = await screen.findByRole("button", { name: /equipment log/i });
    await user.click(eqTab);
    expect(await screen.findByText("Tower Crane 50T")).toBeInTheDocument();

    // Switch to Work Progress tab
    const wpTab = screen.getByRole("button", { name: /work progress log/i });
    await user.click(wpTab);
    expect(await screen.findByText("Concrete casting of Level 2 columns")).toBeInTheDocument();

    // Switch to Blockers tab
    const blTab = screen.getByRole("button", { name: /site blockers/i });
    await user.click(blTab);
    expect(await screen.findByText("Ready-mix truck delayed by traffic")).toBeInTheDocument();
  });

  it("switches to Site Instructions tab and lists instructions", async () => {
    const user = userEvent.setup();
    renderPage();

    const insTab = await screen.findByRole("button", { name: /site instructions register/i });
    await user.click(insTab);

    expect(await screen.findByText("SI-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Install extra bracing at Shear Wall SW-3 before pour.")).toBeInTheDocument();
    expect(screen.getByText("Structural Consultant")).toBeInTheDocument();
  });
});
