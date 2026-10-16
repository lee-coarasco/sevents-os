import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskInboxPage } from "./TaskInboxPage";

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

const TASKS = [
  { id: "t1", workflow_instance_id: "i1", status: "waiting", due_at: null, priority: "normal", blocked_reason: null, nodeType: "create_task", nodeKey: "Review drawing" },
  { id: "t2", workflow_instance_id: "i1", status: "active", due_at: null, priority: "high", blocked_reason: null, nodeType: "create_task", nodeKey: "Submit estimate" },
  { id: "t3", workflow_instance_id: "i1", status: "waiting", due_at: null, priority: "urgent", blocked_reason: "waiting on client", nodeType: "create_task", nodeKey: "Site visit" },
  { id: "t4", workflow_instance_id: "i1", status: "completed", due_at: null, priority: "low", blocked_reason: null, nodeType: "create_task", nodeKey: "Onboard vendor" },
];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/tasks/my-work") {
      return Promise.resolve({ items: TASKS });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions: ["workflow.instance.act"] });
    }
    return Promise.resolve({});
  });
}

describe("TaskInboxPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("groups tasks by status", async () => {
    render(<TaskInboxPage />);

    expect(await screen.findByText("Review drawing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "To do (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "In progress (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Blocked (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done (1)" })).toBeInTheDocument();
  });

  it("opens a detail drawer and completes a task", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tasks/my-work") return Promise.resolve({ items: TASKS });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["workflow.instance.act"] });
      if (path === "/workflow/instances/i1/steps/t1/complete" && init?.method === "POST") {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    render(<TaskInboxPage />);
    await userEvent.click(await screen.findByText("Review drawing"));
    expect(screen.getByText("Task detail")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /mark complete/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/workflow/instances/i1/steps/t1/complete",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("shows the empty state when there are no tasks", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/tasks/my-work") return Promise.resolve({ items: [] });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: [] });
      return Promise.resolve({});
    });

    render(<TaskInboxPage />);
    expect(await screen.findByText("No tasks assigned to you right now.")).toBeInTheDocument();
  });
});
