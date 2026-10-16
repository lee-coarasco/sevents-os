import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DocumentDetailPage } from "./DocumentDetailPage";

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

const DOCUMENT = {
  id: "doc1",
  document_type: "drawing",
  document_number: "DR-1",
  title: "Floor plan",
  project_id: "p1",
  discipline: "architectural",
  access_class: "internal",
  tags: [],
  current_revision_id: "r1",
};
const REVISIONS = [
  { id: "r1", revision_code: "A", status: "under_review", storage_reference: "s3://x", reviewer_id: "u1", approver_id: null, superseded_by_revision_id: null, workflow_instance_id: null, approved_at: null, created_by: "u1", created_at: "2026-10-01T00:00:00Z" },
];
const DEFINITIONS = [{ id: "wf1", name: "IFC Release Approval" }];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/documents/doc1") return Promise.resolve({ document: DOCUMENT });
    if (path.startsWith("/documents/doc1/revisions")) return Promise.resolve({ revisions: REVISIONS });
    if (path === "/workflow/definitions/published") return Promise.resolve({ definitions: DEFINITIONS });
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["documents.register.manage"] });
    if (path === "/admin/users") return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
    return Promise.resolve({});
  });
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/documents/doc1"]}>
      <Routes>
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DocumentDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("renders document metadata and revisions", async () => {
    renderDetail();
    expect(await screen.findByText("Floor plan")).toBeInTheDocument();
    expect(screen.getByText("Revision A")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("adds a new revision", async () => {
    renderDetail();
    await screen.findByText("Floor plan");
    await userEvent.click(screen.getByRole("button", { name: /add revision/i }));

    await userEvent.type(screen.getByPlaceholderText(/revision code/i), "B");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/documents/doc1/revisions",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("submits an under-review revision for IFC release", async () => {
    renderDetail();
    await screen.findByText("Floor plan");
    await userEvent.selectOptions(screen.getByDisplayValue("Select approval workflow…"), "wf1");
    await userEvent.click(screen.getByRole("button", { name: /submit for ifc release/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/documents/revisions/r1/submit-for-release",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ definitionId: "wf1" }) }),
      ),
    );
  });
});
