import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkflowVersionDetailPage } from "./WorkflowVersionDetailPage";

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

const versionV1 = {
  id: "v1",
  version: 1,
  status: "published",
  effective_from: "2026-10-01T00:00:00.000Z",
  effective_to: null,
  rollback_of_version: null,
  published_by: null,
  published_at: "2026-10-01T00:00:00.000Z",
  created_by: null,
  created_at: "2026-09-30T00:00:00.000Z",
};

describe("WorkflowVersionDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows the version's metadata", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionV1] });
      return Promise.resolve({});
    });
    render(
      <MemoryRouter initialEntries={["/config-studio/d1/versions/v1"]}>
        <Routes>
          <Route path="/config-studio/:definitionId/versions/:versionId" element={<WorkflowVersionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Version 1")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});
