import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProjectDetailPage } from "./ProjectDetailPage";

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

const mockSession = { access_token: "test-token", user: { email: "owner@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECT = {
  id: "p1",
  name: "Marina Tower",
  code: "PRJ-001",
  status: "active",
  client_name: "Al Futtaim",
  location: "Dubai Marina",
  contract_reference: "CTR-99",
  contract_value: 5000000,
  contract_currency: "AED",
  project_manager_id: null,
  baseline_start_date: "2026-01-01",
  baseline_end_date: "2027-01-01",
  budget_amount: 4500000,
  budget_currency: "AED",
};

const WBS_NODES = [
  { id: "w1", parent_wbs_node_id: null, code: "1", name: "Substructure", sequence: 1 },
  { id: "w2", parent_wbs_node_id: "w1", code: "1.1", name: "Piling", sequence: 1 },
];

const MILESTONES = [
  { id: "m1", name: "Foundation complete", target_date: "2026-06-01", actual_date: null, status: "pending" },
];

const ACTIVITIES = [
  {
    id: "a1",
    wbs_node_id: null,
    name: "Excavation",
    planned_start: "2026-02-01",
    planned_end: "2026-03-01",
    actual_start: null,
    actual_end: null,
    percent_complete: 0,
  },
];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/projects/p1") return Promise.resolve({ project: PROJECT });
    if (path === "/projects/p1/wbs-nodes") return Promise.resolve({ wbsNodes: WBS_NODES });
    if (path === "/projects/p1/milestones") return Promise.resolve({ milestones: MILESTONES });
    if (path === "/projects/p1/schedule-activities") return Promise.resolve({ scheduleActivities: ACTIVITIES });
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["tenancy.project.manage"] });
    if (path === "/admin/users") {
      return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
    }
    return Promise.resolve({});
  });
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1"]}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("renders project info, the WBS tree, milestones and schedule activities", async () => {
    renderDetail();

    expect(await screen.findByText("Marina Tower")).toBeInTheDocument();
    expect(screen.getByText("Al Futtaim")).toBeInTheDocument();
    expect(screen.getByText("Substructure")).toBeInTheDocument();
    expect(screen.getByText("Piling")).toBeInTheDocument();
    expect(screen.getByText("Foundation complete")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Excavation")).toBeInTheDocument();
  });

  it("shows empty states when there is no WBS, milestones or activities", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/projects/p1") return Promise.resolve({ project: PROJECT });
      if (path === "/projects/p1/wbs-nodes") return Promise.resolve({ wbsNodes: [] });
      if (path === "/projects/p1/milestones") return Promise.resolve({ milestones: [] });
      if (path === "/projects/p1/schedule-activities") return Promise.resolve({ scheduleActivities: [] });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: [] });
      return Promise.resolve({});
    });

    renderDetail();

    expect(await screen.findByText("No WBS nodes yet.")).toBeInTheDocument();
    expect(screen.getByText("No milestones yet.")).toBeInTheDocument();
    expect(screen.getByText("No schedule activities yet.")).toBeInTheDocument();
  });

  it("edits the project through the inline form", async () => {
    renderDetail();
    await userEvent.click(await screen.findByRole("button", { name: /edit project/i }));

    const nameInput = screen.getByPlaceholderText("Project name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Marina Tower II");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/projects/p1",
        "test-token",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = apiFetch.mock.calls.find(
      ([path, , init]) => path === "/projects/p1" && (init as RequestInit | undefined)?.method === "PATCH",
    );
    expect(JSON.parse(call?.[2]?.body as string).name).toBe("Marina Tower II");
  });

  it("adds a new WBS node", async () => {
    renderDetail();
    await screen.findByText("Marina Tower");
    await userEvent.click(screen.getByRole("button", { name: /add node/i }));

    await userEvent.type(screen.getByPlaceholderText("Code"), "2");
    await userEvent.type(screen.getByPlaceholderText("Name"), "Superstructure");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/projects/p1/wbs-nodes",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ code: "2", name: "Superstructure", parentWbsNodeId: undefined }),
        }),
      ),
    );
  });

  it("adds a new milestone", async () => {
    renderDetail();
    await screen.findByText("Marina Tower");
    await userEvent.click(screen.getByRole("button", { name: /add milestone/i }));

    await userEvent.type(screen.getByPlaceholderText("Milestone name"), "Topping out");
    await userEvent.type(screen.getByLabelText("Target date"), "2026-08-01");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/projects/p1/milestones",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("adds a new schedule activity", async () => {
    renderDetail();
    await screen.findByText("Marina Tower");
    await userEvent.click(screen.getByRole("button", { name: /add activity/i }));

    await userEvent.type(screen.getByPlaceholderText("Activity name"), "Roofing");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/projects/p1/schedule-activities",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
