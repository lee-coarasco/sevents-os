import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WorkflowInstancesPage } from "./WorkflowInstancesPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkflowInstancesPage />
    </MemoryRouter>,
  );
}

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

const mockSession = { access_token: "test-token", user: { email: "admin@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const DEFINITIONS = [
  { id: "d1", key: "wf.po_approval", name: "High-Value Purchase Order Approval Workflow" },
];

const INSTANCES = [
  {
    id: "inst-101",
    workflow_definition_id: "d1",
    workflow_version_id: "v1",
    status: "running",
    started_by: "u1",
    started_at: "2026-10-20T10:00:00Z",
    ended_at: null,
    context: { po_number: "PO-2026-001", total_amount: 1500000 },
  },
];

const DETAIL = {
  instance: INSTANCES[0],
  stepInstances: [
    {
      id: "step-1",
      workflow_instance_id: "inst-101",
      node_id: "start_po",
      status: "completed",
      assigned_to: "u1",
      created_at: "2026-10-20T10:00:00Z",
      completed_at: "2026-10-20T10:02:00Z",
    },
    {
      id: "step-2",
      workflow_instance_id: "inst-101",
      node_id: "procurement_head_approval",
      status: "active",
      assigned_to: "u2",
      created_at: "2026-10-20T10:02:00Z",
      completed_at: null,
    },
  ],
  events: [
    {
      id: "evt-1",
      event_type: "instance_started",
      payload: { definitionKey: "wf.po_approval" },
      created_at: "2026-10-20T10:00:00Z",
    },
  ],
};

describe("WorkflowInstancesPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/instances") return Promise.resolve({ instances: INSTANCES });
      if (path === "/workflow/definitions") return Promise.resolve({ definitions: DEFINITIONS });
      if (path === "/workflow/instances/inst-101") return Promise.resolve(DETAIL);
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["workflow.instance.manage", "workflow.definition.manage"] });
      }
      return Promise.resolve({});
    });
  });

  it("renders the workflow runs cockpit, KPI tiles, and instance rows", async () => {
    renderPage();

    expect(await screen.findByText(/Workflow Executions & Runs/i)).toBeInTheDocument();
    expect(screen.getByText("High-Value Purchase Order Approval Workflow")).toBeInTheDocument();
    expect(screen.getByText("inst-101")).toBeInTheDocument();
    expect(screen.getByText("Inspect Run →")).toBeInTheDocument();
  });

  it("opens the inspection modal and shows steps timeline and event log", async () => {
    renderPage();

    await screen.findByText("Inspect Run →");
    await userEvent.click(screen.getByText("Inspect Run →"));

    expect(await screen.findByText("Workflow Run Inspection")).toBeInTheDocument();
    expect(screen.getByText(/Step Node ID: start_po/i)).toBeInTheDocument();
    expect(screen.getByText(/Step Node ID: procurement_head_approval/i)).toBeInTheDocument();
    expect(screen.getByText("instance_started")).toBeInTheDocument();
  });
});
