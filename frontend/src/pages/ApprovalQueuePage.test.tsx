import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalQueuePage } from "./ApprovalQueuePage";

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
  { id: "a1", workflow_instance_id: "i1", status: "waiting", due_at: null, priority: "high", nodeType: "request_approval", nodeKey: "Approve PO-1002" },
  { id: "t1", workflow_instance_id: "i1", status: "waiting", due_at: null, priority: "normal", nodeType: "create_task", nodeKey: "Site visit" },
];

const DETAIL = {
  stepInstance: TASKS[0],
  decisions: [],
  requestContext: { amount: 5000, currency: "AED" },
  comments: [],
  authorityCheck: { configured: true, withinLimit: true },
};

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/tasks/waiting-approval" || path === "/tasks/my-work") return Promise.resolve({ items: TASKS });
    if (path === "/approvals/a1") return Promise.resolve({ detail: DETAIL });
    if (path === "/admin/users") {
      return Promise.resolve({
        users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }],
      });
    }
    return Promise.resolve({});
  });
}

describe("ApprovalQueuePage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("shows only pending approval tasks, not other task types", async () => {
    render(<ApprovalQueuePage />);
    expect(await screen.findByText("Approve PO-1002")).toBeInTheDocument();
    expect(screen.queryByText("Site visit")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no approvals", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/tasks/my-work") return Promise.resolve({ items: [] });
      return Promise.resolve({});
    });
    render(<ApprovalQueuePage />);
    expect(await screen.findByText("No approvals are waiting on you right now.")).toBeInTheDocument();
  });

  it("opens detail and approves with a decision call", async () => {
    render(<ApprovalQueuePage />);
    await userEvent.click(await screen.findByText("Approve PO-1002"));

    expect(await screen.findByText("Within your limit")).toBeInTheDocument();
    expect(screen.getByText("amount")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/approvals/a1/decide",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "approved", reason: null }) }),
      ),
    );
  });

  it("requires a reason before rejecting", async () => {
    render(<ApprovalQueuePage />);
    await userEvent.click(await screen.findByText("Approve PO-1002"));
    await screen.findByText("Within your limit");

    await userEvent.click(screen.getByRole("button", { name: /reject/i }));

    expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith("/approvals/a1/decide", expect.anything(), expect.anything());
  });

  it("delegates the approval to another user via the picker", async () => {
    render(<ApprovalQueuePage />);
    await userEvent.click(await screen.findByText("Approve PO-1002"));
    await screen.findByText("Within your limit");

    const delegateSearch = screen.getByPlaceholderText("Delegate to…");
    await userEvent.click(delegateSearch);
    await userEvent.type(delegateSearch, "Uma");
    await userEvent.click(await screen.findByText("Uma One (u1@sevents.test)"));
    await userEvent.click(screen.getByRole("button", { name: /delegate this approval/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/tasks/a1/delegate",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ delegateUserId: "u1", reason: null }) }),
      ),
    );
  });

  it("approves with conditions, carrying the comment as reason", async () => {
    render(<ApprovalQueuePage />);
    await userEvent.click(await screen.findByText("Approve PO-1002"));
    await screen.findByText("Within your limit");

    await userEvent.type(screen.getByPlaceholderText("Comment (required if rejecting)"), "Subject to revised schedule");
    await userEvent.click(screen.getByRole("button", { name: /approve with conditions/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/approvals/a1/decide",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ decision: "approved_with_conditions", reason: "Subject to revised schedule" }),
        }),
      ),
    );
  });

  it("shows comments and decisions in the ActivityThread, and posts a new comment", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tasks/waiting-approval" || path === "/tasks/my-work") return Promise.resolve({ items: TASKS });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["workflow.instance.act"] });
      if (path === "/approvals/a1") {
        return Promise.resolve({
          detail: {
            ...DETAIL,
            comments: [{ id: "c1", author_id: "u1", body: "please review the schedule impact", created_at: new Date().toISOString() }],
            decisions: [{ id: "d1", approver_id: "u1", decision: "returned_for_correction", reason: "needs revision", decided_at: new Date().toISOString() }],
          },
        });
      }
      if (path === "/workflow/steps/a1/comments" && init?.method === "POST") return Promise.resolve({ comment: {} });
      if (path === "/admin/users") return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
      return Promise.resolve({});
    });

    render(<ApprovalQueuePage />);
    await userEvent.click(await screen.findByText("Approve PO-1002"));

    expect(await screen.findByText("please review the schedule impact")).toBeInTheDocument();
    expect(screen.getByText("Returned for correction")).toBeInTheDocument();
    expect(screen.getByText("needs revision")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Add a comment…"), "fixed, please re-review");
    await userEvent.click(screen.getByRole("button", { name: /post comment/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/workflow/steps/a1/comments",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "fixed, please re-review" }) }),
      ),
    );
  });

  it("returns for correction, requiring a reason", async () => {
    render(<ApprovalQueuePage />);
    await userEvent.click(await screen.findByText("Approve PO-1002"));
    await screen.findByText("Within your limit");

    await userEvent.click(screen.getByRole("button", { name: /return for correction/i }));
    expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Comment (required if rejecting)"), "Missing cost backup");
    await userEvent.click(screen.getByRole("button", { name: /return for correction/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/approvals/a1/decide",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ decision: "returned_for_correction", reason: "Missing cost backup" }),
        }),
      ),
    );
  });
});
