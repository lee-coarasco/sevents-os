import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TenderSubmissionDetailPage } from "./TenderSubmissionDetailPage";

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

const DOCUMENTS = [
  { id: "d1", document_type: "drawing", title: "Floor plan rev A", document_number: "DR-1", revision: "A", received_date: null, storage_reference: "s3://x", created_by: null, created_at: "2026-10-01T00:00:00Z" },
];
const ESTIMATES = [
  { id: "e1", version: 1, status: "draft", assumptions: null, inclusions: null, exclusions: null, taxes: 0, overheads: 0, contingency: 0, margin: 0, subtotal_amount: 0, total_amount: 0, workflow_instance_id: null },
];
const DEFINITIONS = [{ id: "wf1", name: "Standard Approval", capability_key: null }];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/tendering/tender-submissions/ts1/documents") return Promise.resolve({ documents: DOCUMENTS });
    if (path === "/tendering/tender-submissions/ts1/estimates") return Promise.resolve({ estimates: ESTIMATES });
    if (path === "/workflow/definitions/published") return Promise.resolve({ definitions: DEFINITIONS });
    if (path === "/estimates/e1/lines") return Promise.resolve({ lines: [] });
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["tendering.document.manage"] });
    return Promise.resolve({});
  });
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/tendering/tender-submissions/ts1"]}>
      <Routes>
        <Route path="/tendering/tender-submissions/:id" element={<TenderSubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TenderSubmissionDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists tender documents by default", async () => {
    renderDetail();
    expect(await screen.findByText("Floor plan rev A")).toBeInTheDocument();
  });

  it("uploads a new tender document", async () => {
    renderDetail();
    await screen.findByText("Floor plan rev A");
    await userEvent.click(screen.getByRole("button", { name: /upload document/i }));

    await userEvent.type(screen.getByPlaceholderText("Document type"), "boq");
    await userEvent.type(screen.getByPlaceholderText("Title"), "Bill of quantities");
    await userEvent.click(screen.getByRole("button", { name: /add document/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/tendering/tender-submissions/ts1/documents",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("switches to the estimates tab, manages lines and submits for approval", async () => {
    renderDetail();
    await screen.findByText("Floor plan rev A");
    await userEvent.click(screen.getByRole("button", { name: "Estimates" }));
    expect(await screen.findByText("v1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /manage lines/i }));
    expect(await screen.findByText(/no lines yet/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Item description"), "Formwork");
    await userEvent.type(screen.getByPlaceholderText("Qty"), "10");
    await userEvent.type(screen.getByPlaceholderText("Unit of measure…"), "m2");
    await userEvent.type(screen.getByPlaceholderText("AED 0.00"), "50");
    await userEvent.click(screen.getByRole("button", { name: /add line/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/estimates/e1/lines",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );

    await userEvent.selectOptions(screen.getByDisplayValue("Select approval workflow…"), "wf1");
    await userEvent.click(screen.getByRole("button", { name: /submit for approval/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/estimates/e1/submit-for-approval",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ definitionId: "wf1" }) }),
      ),
    );
  });

  it("switches to the bidding tab and creates a bid/no-bid decision for an estimate", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/tendering/tender-submissions/ts1/documents") return Promise.resolve({ documents: [] });
      if (path === "/tendering/tender-submissions/ts1/estimates") return Promise.resolve({ estimates: ESTIMATES });
      if (path === "/workflow/definitions/published") return Promise.resolve({ definitions: DEFINITIONS });
      if (path === "/estimates/e1/bid-decisions") return Promise.resolve({ decisions: [] });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["tendering.document.manage"] });
      return Promise.resolve({});
    });
    renderDetail();
    await screen.findByText(/no documents uploaded yet/i);
    await userEvent.click(screen.getByRole("button", { name: "Bid / No-Bid" }));

    await userEvent.selectOptions(screen.getByRole("combobox"), "e1");
    await screen.findByRole("button", { name: /create decision/i });
    await userEvent.click(screen.getByRole("button", { name: /create decision/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/estimates/e1/bid-decisions",
        "test-token",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ recommendation: "bid" }) }),
      ),
    );
  });
});
