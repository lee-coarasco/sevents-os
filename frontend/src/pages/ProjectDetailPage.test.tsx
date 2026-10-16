import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
    apiFetch.mockImplementation((path: string) => {
      if (path === "/projects/p1") return Promise.resolve({ project: PROJECT });
      if (path === "/projects/p1/wbs-nodes") return Promise.resolve({ wbsNodes: WBS_NODES });
      if (path === "/projects/p1/milestones") return Promise.resolve({ milestones: MILESTONES });
      return Promise.resolve({});
    });
  });

  it("renders project info, the WBS tree and the milestone timeline", async () => {
    renderDetail();

    expect(await screen.findByText("Marina Tower")).toBeInTheDocument();
    expect(screen.getByText("Al Futtaim")).toBeInTheDocument();
    expect(screen.getByText("Substructure")).toBeInTheDocument();
    expect(screen.getByText("Piling")).toBeInTheDocument();
    expect(screen.getByText("Foundation complete")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows empty states when there is no WBS or milestones", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/projects/p1") return Promise.resolve({ project: PROJECT });
      if (path === "/projects/p1/wbs-nodes") return Promise.resolve({ wbsNodes: [] });
      if (path === "/projects/p1/milestones") return Promise.resolve({ milestones: [] });
      return Promise.resolve({});
    });

    renderDetail();

    expect(await screen.findByText("No WBS nodes yet.")).toBeInTheDocument();
    expect(screen.getByText("No milestones yet.")).toBeInTheDocument();
  });
});
