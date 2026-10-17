import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({ has: () => true, loading: false }),
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

const versionDraft = { ...versionV1, id: "v2", version: 2, status: "draft", effective_from: null, published_at: null };

const definitionDraft = {
  id: "d1", key: "wf.test", name: "Test Workflow",
  description: null, capability_key: null, status: "draft",
  current_version: null, created_by: null, updated_by: null,
};

const definitionApproved = { ...definitionDraft, status: "approved" };
const definitionUnderReview = { ...definitionDraft, status: "under_review" };

function renderPage(definitionId = "d1", versionId = "v1") {
  return render(
    <MemoryRouter initialEntries={[`/config-studio/${definitionId}/versions/${versionId}`]}>
      <Routes>
        <Route path="/config-studio/:definitionId/versions/:versionId" element={<WorkflowVersionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkflowVersionDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("shows the version's metadata", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionV1] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionDraft });
      return Promise.resolve({});
    });
    renderPage();
    expect(await screen.findByText("Version 1")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows validation tab and run validation button for draft version", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionDraft });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    expect(await screen.findByRole("button", { name: /run validation/i })).toBeInTheDocument();
  });

  it("shows pass banner after successful validation", async () => {
    apiFetch.mockImplementation((path: string, _token: string, opts?: { method?: string }) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionDraft });
      if (path.includes("/validate") && opts?.method === "POST")
        return Promise.resolve({ run: { id: "r1", result: "pass", findings: [], started_at: "", finished_at: "" } });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    await screen.findByRole("button", { name: /run validation/i });
    fireEvent.click(screen.getByRole("button", { name: /run validation/i }));
    expect(await screen.findByText(/validation passed/i)).toBeInTheDocument();
  });

  it("shows findings after failed validation", async () => {
    apiFetch.mockImplementation((path: string, _token: string, opts?: { method?: string }) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionDraft });
      if (path.includes("/validate") && opts?.method === "POST")
        return Promise.resolve({
          run: {
            id: "r2", result: "fail",
            findings: [{ code: "NO_TERMINAL_NODE", severity: "error", message: "No terminal node found." }],
            started_at: "", finished_at: "",
          },
        });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    await screen.findByRole("button", { name: /run validation/i });
    fireEvent.click(screen.getByRole("button", { name: /run validation/i }));
    expect(await screen.findByText(/NO_TERMINAL_NODE/)).toBeInTheDocument();
    expect(screen.getByText(/No terminal node found/)).toBeInTheDocument();
  });

  it("shows Submit for Review when definition is draft", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionDraft });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    expect(await screen.findByRole("button", { name: /submit for review/i })).toBeInTheDocument();
  });

  it("shows Approve/Reject form when definition is under_review", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionUnderReview });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    expect(await screen.findByText(/approval decision/i)).toBeInTheDocument();
  });

  it("publish button disabled without passing validation", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionApproved });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    const publishBtn = await screen.findByRole("button", { name: /^publish$/i });
    expect(publishBtn).toBeDisabled();
  });

  it("publish button enabled after passing validation on approved definition", async () => {
    apiFetch.mockImplementation((path: string, _token: string, opts?: { method?: string }) => {
      if (path === "/workflow/definitions/d1/versions") return Promise.resolve({ versions: [versionDraft] });
      if (path === "/workflow/definitions/d1") return Promise.resolve({ definition: definitionApproved });
      if (path.includes("/validate") && opts?.method === "POST")
        return Promise.resolve({ run: { id: "r1", result: "pass", findings: [], started_at: "", finished_at: "" } });
      if (path.endsWith("/graph")) return Promise.resolve({ graph: { nodes: [], transitions: [], conditions: [] } });
      return Promise.resolve({});
    });
    renderPage("d1", "v2");
    await screen.findByText("Version 2");
    fireEvent.click(screen.getByRole("button", { name: /validation/i }));
    await screen.findByRole("button", { name: /run validation/i });
    fireEvent.click(screen.getByRole("button", { name: /run validation/i }));
    await screen.findByText(/validation passed/i);
    await waitFor(() => {
      const publishBtn = screen.getByRole("button", { name: /^publish$/i });
      expect(publishBtn).not.toBeDisabled();
    });
  });
});
