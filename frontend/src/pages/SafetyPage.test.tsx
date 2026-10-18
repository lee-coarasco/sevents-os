import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SafetyPage } from "./SafetyPage";
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

const mockSession = { access_token: "test-token", user: { email: "qhse.engineer@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const PERMITS = [
  {
    id: "ptw-1",
    project_id: "proj-101",
    permit_number: "PTW-2026-001",
    permit_type: "confined_space",
    title: "Basement Stormwater Tank Deep Cleaning",
    location_or_grid: "Grid B-2 Tank Room",
    start_time: "2026-10-18T08:00:00Z",
    expiry_time: "2026-10-18T16:00:00Z",
    status: "active",
    contractor_name: "Subsea Services Ltd",
    supervisor_name: "John Miller",
    safety_officer_name: "Sarah Chen (QHSE)",
    precautions_taken: "Continuous ventilation forced, gas monitor worn",
    gas_test_required: true,
    gas_test_results: "O2: 20.9%, H2S: 0ppm",
    created_at: "2026-10-18T07:30:00Z",
  },
];

const INCIDENTS = [
  {
    id: "inc-1",
    project_id: "proj-101",
    incident_number: "INC-2026-001",
    incident_date: "2026-10-18T09:15:00Z",
    incident_type: "lost_time_injury",
    severity: "major",
    status: "under_investigation",
    location_or_grid: "Tower Crane #2 Base",
    description: "Rigger slipped on oily plate during slewing test",
    injured_person_name: "David K.",
    injury_details: "Fractured right ankle",
    lost_workdays: 3,
    immediate_action_taken: "First aid team dispatched, hospital transport",
    root_cause_analysis: null,
    corrective_preventive_action: null,
    reported_by: "Site Supervisor",
    investigated_by: null,
    closed_by: null,
    closed_at: null,
    created_at: "2026-10-18T09:30:00Z",
  },
];

const HAZARDS = [
  {
    id: "haz-1",
    project_id: "proj-101",
    observation_number: "HAZ-2026-001",
    observation_type: "unsafe_condition",
    risk_level: "imminent_danger",
    stop_work_issued: true,
    location_or_grid: "Level 14 Edge Perimeter",
    description: "Guardrails missing on edge adjacent to material hoist",
    action_required: "Install double edge guardrails and toe-boards immediately",
    status: "open",
    reported_by: "qhse.engineer@example.com",
    assigned_to: "Edge Protection Team",
    rectification_evidence: null,
    target_rectification_date: "2026-10-18",
    rectified_at: null,
    created_at: "2026-10-18T10:00:00Z",
  },
];

const TBTS = [
  {
    id: "tbt-1",
    project_id: "proj-101",
    tbt_number: "TBT-2026-001",
    talk_date: "2026-10-18T07:00:00Z",
    topic: "Working at Heights & 100% Tie-Off Rule",
    conducted_by: "Sarah Chen",
    trade_discipline: "structural",
    attendee_count: 24,
    key_points_discussed: "Inspected harnesses, shock absorbers, and lifelines",
    notes: null,
    created_at: "2026-10-18T07:15:00Z",
  },
];

describe("SafetyPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/projects") return { projects: PROJECTS };
      if (path.includes("/authority/effective-permissions") || path.includes("/authority/my-permissions")) {
        return {
          permissions: [
            "safety.ptw.manage",
            "safety.ptw.approve",
            "safety.incident.manage",
            "safety.incident.investigate",
            "safety.hazard.manage",
            "safety.tbt.manage",
          ],
        };
      }
      if (path.includes("/safety/permits")) return { permits: PERMITS };
      if (path.includes("/safety/incidents")) return { incidents: INCIDENTS };
      if (path.includes("/safety/hazards")) return { hazards: HAZARDS };
      if (path.includes("/safety/toolbox-talks")) return { toolboxTalks: TBTS };
      return {};
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <PermissionsProvider>
          <SafetyPage />
        </PermissionsProvider>
      </MemoryRouter>
    );

  it("renders page header and permits to work by default", async () => {
    renderComponent();

    expect(await screen.findByText("Safety, Incidents & Compliance")).toBeInTheDocument();
    expect(await screen.findByText("PTW-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Basement Stormwater Tank Deep Cleaning")).toBeInTheDocument();
    expect(screen.getByText(/confined space/i)).toBeInTheDocument();
    expect(screen.getByText("Pass (O2: 20.9%, H2S: 0ppm)")).toBeInTheDocument();
  });

  it("displays Stop-Work warning banner when imminent danger hazard is open", async () => {
    renderComponent();

    expect(await screen.findByText("ACTIVE STOP-WORK ORDER IN EFFECT")).toBeInTheDocument();
  });

  it("switches to Incidents tab and displays lost workdays", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Safety, Incidents & Compliance");
    const incTab = screen.getByRole("button", { name: /Incidents & Lost Workdays/i });
    await user.click(incTab);

    expect(await screen.findByText("INC-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Tower Crane #2 Base")).toBeInTheDocument();
    expect(screen.getByText("3 days")).toBeInTheDocument();
    expect(screen.getByText("major")).toBeInTheDocument();
  });

  it("switches to Hazards tab and displays stop work status", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Safety, Incidents & Compliance");
    const hazTab = screen.getByRole("button", { name: /Hazard Observations & Stop-Work/i });
    await user.click(hazTab);

    expect(await screen.findByText("HAZ-2026-001")).toBeInTheDocument();
    expect(screen.getByText("STOP-WORK ORDER ISSUED")).toBeInTheDocument();
    expect(screen.getByText("imminent danger")).toBeInTheDocument();
  });

  it("switches to Toolbox Talks tab and displays attendees", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Safety, Incidents & Compliance");
    const tbtTab = screen.getByRole("button", { name: /Toolbox Talks \(TBT\)/i });
    await user.click(tbtTab);

    expect(await screen.findByText("TBT-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Working at Heights & 100% Tie-Off Rule")).toBeInTheDocument();
    expect(screen.getByText("24 workers")).toBeInTheDocument();
  });

  it("opens PTW review drawer on click", async () => {
    const user = userEvent.setup();
    renderComponent();

    const reviewBtn = await screen.findByRole("button", { name: /Review \/ Sign-off/i });
    await user.click(reviewBtn);

    expect(await screen.findByText("Safety Officer Sign-off")).toBeInTheDocument();
    expect(screen.getAllByText(/Subsea Services Ltd/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirm Safety Authorization" })).toBeInTheDocument();
  });
});
