import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkflowDefinitionDetailPage } from "./WorkflowDefinitionDetailPage";

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

const definition = {
  id: "d1",
  key: "material_request",
  name: "Material Request",
  description: "PO approval flow",
  capability_key: null,
  status: "approved",
  current_version: 1,
  created_by: null,
  updated_by: null,
};

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

function mockResponses(options: { permissions?: string[]; versions?: unknown[] } = {}) {
  const permissions = options.permissions ?? ["workflow.definition.manage", "workflow.definition.publish"];
  const versions = options.versions ?? [versionV1];
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions });
    if (path === "/workflow/definitions/d1") return Promise.resolve({ definition });
    if (path === "/workflow/definitions/d1/versions" && (!init || init.method === undefined)) {
      return Promise.resolve({ versions });
    }
    if (path === "/workflow/definitions/d1/versions" && init?.method === "POST") {
      return Promise.resolve({ version: { ...versionV1, id: "v2", version: 2, status: "draft", published_at: null } });
    }
    if (path === "/workflow/definitions/d1/rollback" && init?.method === "POST") {
      return Promise.resolve({ version: { ...versionV1, id: "v3", version: 2, rollback_of_version: 1 } });
    }
    return Promise.resolve({});
  });
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/config-studio/d1"]}>
      <Routes>
        <Route path="/config-studio/:definitionId" element={<WorkflowDefinitionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkflowDefinitionDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows the definition header and its versions", async () => {
    mockResponses();
    renderPage();
    expect(await screen.findByText("Material Request")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("drafts a new version copying the current published one", async () => {
    mockResponses();
    renderPage();
    await screen.findByText("New Version");

    await userEvent.click(screen.getByText("New Version"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/workflow/definitions/d1/versions",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ copyFromVersionId: "v1" }) }),
      ),
    );
  });

  it("rolls back to a published version with a confirmation step", async () => {
    mockResponses();
    renderPage();
    await screen.findByText("Rollback to this version");

    await userEvent.click(screen.getByText("Rollback to this version"));
    expect(screen.getByText(/Rolling back to version 1/)).toBeInTheDocument();

    await userEvent.click(screen.getByText("Confirm rollback"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/workflow/definitions/d1/rollback",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("hides rollback without workflow.definition.publish", async () => {
    mockResponses({ permissions: ["workflow.definition.manage"] });
    renderPage();
    await screen.findByText("v1");
    expect(screen.queryByText("Rollback to this version")).not.toBeInTheDocument();
  });
});
