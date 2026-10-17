import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./NotificationBell";

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

const unread = {
  id: "n1",
  rendered_subject: "Task assigned",
  rendered_body: "You've been assigned a new task.",
  read_at: null,
  delivered_at: "2026-10-17T00:00:00.000Z",
};
const read = {
  id: "n2",
  rendered_subject: "Approval decided",
  rendered_body: "Your request was approved.",
  read_at: "2026-10-16T00:00:00.000Z",
  delivered_at: "2026-10-16T00:00:00.000Z",
};

describe("NotificationBell", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows the unread count badge", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/notifications") return Promise.resolve({ notifications: [unread, read] });
      return Promise.resolve({});
    });
    render(<NotificationBell />);
    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("shows no badge and an empty state when there are no notifications", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/notifications") return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });
    render(<NotificationBell />);
    await userEvent.click(screen.getByLabelText("Notifications"));
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
  });

  it("opens the inbox and marks a notification read on click", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/notifications") return Promise.resolve({ notifications: [unread, read] });
      if (path === "/notifications/n1/read" && init?.method === "POST") {
        return Promise.resolve({ notification: { ...unread, read_at: "2026-10-17T01:00:00.000Z" } });
      }
      return Promise.resolve({});
    });
    render(<NotificationBell />);

    await userEvent.click(screen.getByLabelText("Notifications"));
    expect(await screen.findByText("Task assigned")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Task assigned"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/notifications/n1/read", "test-token", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
  });
});
