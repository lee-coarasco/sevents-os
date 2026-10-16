import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DocumentsPage } from "./DocumentsPage";

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

const PROJECTS = [{ id: "p1", name: "Marina Tower" }];
const DOCUMENTS = [
  { id: "d1", document_type: "drawing", document_number: "DR-1", title: "Floor plan", project_id: "p1", discipline: "architectural", access_class: "internal", current_revision_id: null, created_at: "2026-10-01T00:00:00Z" },
];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path.startsWith("/documents")) return Promise.resolve({ documents: DOCUMENTS });
    if (path === "/projects") return Promise.resolve({ projects: PROJECTS });
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["documents.register.manage"] });
    return Promise.resolve({});
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DocumentsPage />
    </MemoryRouter>,
  );
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists documents", async () => {
    renderPage();
    expect(await screen.findByText("Floor plan")).toBeInTheDocument();
    expect(screen.getAllByText("Marina Tower").length).toBeGreaterThan(0);
  });

  it("creates a new document", async () => {
    renderPage();
    await screen.findByText("Floor plan");
    await userEvent.click(screen.getByRole("button", { name: /new document/i }));

    await userEvent.type(screen.getByPlaceholderText("Title"), "Elevation drawing");
    await userEvent.type(screen.getByPlaceholderText("Document type"), "drawing");
    await userEvent.click(screen.getByRole("button", { name: /create document/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/documents",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
