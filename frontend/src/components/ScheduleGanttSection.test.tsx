import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleGanttSection } from "./ScheduleGanttSection";

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

const mockSession = { access_token: "test-token" };
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const GANTT_DATA = {
  schedule: {
    project_id: "p1",
    baseline_version: 1,
    critical_path: ["a1", "a2"],
    total_activities: 2,
    completed_activities: 1,
    overall_progress: 50,
    activities: [
      {
        id: "a1",
        wbs_node_id: "w1",
        wbs_code: "1.0",
        wbs_name: "Substructure",
        name: "Deep Piling",
        planned_start: "2026-11-01",
        planned_end: "2026-11-15",
        actual_start: "2026-11-01",
        actual_end: "2026-11-15",
        baseline_start: "2026-11-01",
        baseline_end: "2026-11-15",
        percent_complete: 100,
        dependencies: [],
        is_critical: true,
        total_float_days: 0,
        duration_days: 14,
        status: "completed",
      },
      {
        id: "a2",
        wbs_node_id: "w1",
        wbs_code: "1.0",
        wbs_name: "Substructure",
        name: "Raft Slab Concreting",
        planned_start: "2026-11-16",
        planned_end: "2026-11-30",
        actual_start: null,
        actual_end: null,
        baseline_start: "2026-11-16",
        baseline_end: "2026-11-30",
        percent_complete: 0,
        dependencies: ["a1"],
        is_critical: true,
        total_float_days: 0,
        duration_days: 14,
        status: "not_started",
      },
    ],
  },
};

const VARIANCE_DATA = {
  variance: {
    project_id: "p1",
    total_activities: 2,
    delayed_activities_count: 1,
    total_delay_days: 4,
    critical_delayed_count: 1,
    delays_by_category: {
      client: 0,
      design: 0,
      procurement: 0,
      subcontractor: 4,
      weather: 0,
      permits: 0,
      other: 0,
    },
    total_float_consumed_days: 4,
  },
};

const DELAY_RECORDS = {
  delayRecords: [
    {
      id: "d1",
      project_id: "p1",
      schedule_activity_id: "a2",
      delay_days: 4,
      reason_category: "subcontractor",
      description: "Rebar delivery delayed by steel fabricator",
      mitigation_plan: "Air-freight remaining couplers and run 2 shift crews",
      recorded_at: "2026-11-10T10:00:00Z",
    },
  ],
};

const LOOKAHEAD_PLANS = {
  lookaheadPlans: [
    {
      id: "plan1",
      project_id: "p1",
      title: "Substructure Phase 1 (2-Week Lookahead)",
      period_start: "2026-11-01",
      period_end: "2026-11-14",
      timeframe_weeks: 2,
      created_at: "2026-10-30T10:00:00Z",
    },
  ],
};

const PLAN_DETAILS = {
  lookaheadPlan: LOOKAHEAD_PLANS.lookaheadPlans[0],
  activities: [
    {
      id: "la1",
      lookahead_plan_id: "plan1",
      schedule_activity_id: "a1",
      custom_activity_name: null,
      planned_action: "Complete pile trimming and blinding concrete",
      target_date: "2026-11-05",
      status: "completed",
      assigned_to: null,
      notes: "Surveyed and approved by QA engineer",
    },
  ],
};

function mockApis() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/projects/p1/schedule/gantt") return Promise.resolve(GANTT_DATA);
    if (path === "/projects/p1/schedule/variance") return Promise.resolve(VARIANCE_DATA);
    if (path === "/projects/p1/delays") return Promise.resolve(DELAY_RECORDS);
    if (path === "/projects/p1/lookahead-plans") return Promise.resolve(LOOKAHEAD_PLANS);
    if (path === "/lookahead-plans/plan1") return Promise.resolve(PLAN_DETAILS);
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({
        permissions: ["tenancy.project.manage", "project.progress.record"],
      });
    }
    return Promise.resolve({});
  });
}

describe("ScheduleGanttSection Component", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockApis();
  });

  it("renders KPIs, baseline version, and interactive Gantt schedule", async () => {
    render(<ScheduleGanttSection projectId="p1" token="test-token" />);

    expect(await screen.findByText("Schedule, Progress & Resource Planning")).toBeInTheDocument();
    expect(screen.getByText("Deep Piling")).toBeInTheDocument();
    expect(screen.getByText("Raft Slab Concreting")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("switches to Lookahead Plans tab and displays plan details", async () => {
    const user = userEvent.setup();
    render(<ScheduleGanttSection projectId="p1" token="test-token" />);

    const lookaheadTabBtn = await screen.findByRole("button", { name: /Lookahead Plans/i });
    await user.click(lookaheadTabBtn);

    expect((await screen.findAllByText("Substructure Phase 1 (2-Week Lookahead)")).length).toBeGreaterThan(0);
    expect(screen.getByText("Complete pile trimming and blinding concrete")).toBeInTheDocument();
  });

  it("switches to Delay Register tab and displays logged variance records", async () => {
    const user = userEvent.setup();
    render(<ScheduleGanttSection projectId="p1" token="test-token" />);

    const delaysTabBtn = await screen.findByRole("button", { name: /Delay Register/i });
    await user.click(delaysTabBtn);

    expect(await screen.findByText("Delay Reason Categorization (Variance Drivers)")).toBeInTheDocument();
    expect(screen.getByText("Rebar delivery delayed by steel fabricator")).toBeInTheDocument();
    expect(screen.getByText("+4 days")).toBeInTheDocument();
  });
});
