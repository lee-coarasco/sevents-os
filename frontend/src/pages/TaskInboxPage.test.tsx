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
    if (path === "/admin/users") {
      return Promise.resolve({
        users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }],
      });
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

  it("reassigns a task to another user via the picker", async () => {
    render(<TaskInboxPage />);
    await userEvent.click(await screen.findByText("Review drawing"));

    const reassignSearch = screen.getByPlaceholderText("Reassign to…");
    await userEvent.click(reassignSearch);
    await userEvent.type(reassignSearch, "Uma");
    await userEvent.click(await screen.findByText("Uma One (u1@sevents.test)"));

    await userEvent.click(screen.getByRole("button", { name: /reassign task/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/tasks/t1/reassign",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ newAssigneeUserId: "u1" }) }),
      ),
    );
  });

  it("shows an SLA countdown and the overdue colour, and posts a comment to the ActivityThread", async () => {
    const overdueDueAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const tasksWithDue = [{ ...TASKS[0], due_at: overdueDueAt }];
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tasks/my-work") return Promise.resolve({ items: tasksWithDue });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["workflow.instance.act"] });
      if (path === "/tasks/t1") {
        return Promise.resolve({
          detail: { stepInstance: tasksWithDue[0], comments: [{ id: "c1", author_id: "u1", body: "first comment", created_at: new Date().toISOString() }] },
        });
      }
      if (path === "/workflow/steps/t1/comments" && init?.method === "POST") return Promise.resolve({ comment: {} });
      if (path === "/admin/users") return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
      return Promise.resolve({});
    });

    render(<TaskInboxPage />);
    await userEvent.click(await screen.findByText("Review drawing"));

    expect(await screen.findByText(/overdue by/i)).toBeInTheDocument();
    expect(await screen.findByText("first comment")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Add a comment…"), "looking into it");
    await userEvent.click(screen.getByRole("button", { name: /post comment/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/workflow/steps/t1/comments",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "looking into it" }) }),
      ),
    );
  });

  it("delegates a task to another user via the picker", async () => {
    render(<TaskInboxPage />);
    await userEvent.click(await screen.findByText("Review drawing"));

    const delegateSearch = screen.getByPlaceholderText("Delegate to…");
    await userEvent.click(delegateSearch);
    await userEvent.type(delegateSearch, "Uma");
    await userEvent.click(await screen.findByText("Uma One (u1@sevents.test)"));

    await userEvent.click(screen.getByRole("button", { name: /delegate task/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/tasks/t1/delegate",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ delegateUserId: "u1" }) }),
      ),
    );
  });
});
