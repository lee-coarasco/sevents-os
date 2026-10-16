import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OpportunityDetailPage } from "./OpportunityDetailPage";

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

const OPPORTUNITY = {
  id: "o1",
  client_id: "c1",
  title: "Marina Tower fit-out",
  source: "referral",
  owner_id: "u1",
  stage: "tender",
  expected_value: 250000,
  probability: 40,
};
const CLIENTS = [{ id: "c1", name: "Al Futtaim" }];
const TENDER_SUBMISSIONS = [{ id: "ts1", deadline_date: "2026-11-01", submitted_at: null, evidence_reference: null, notes: null }];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/crm/opportunities/o1") return Promise.resolve({ opportunity: OPPORTUNITY });
    if (path === "/crm/clients") return Promise.resolve({ clients: CLIENTS });
    if (path === "/crm/opportunities/o1/site-visits") return Promise.resolve({ siteVisits: [] });
    if (path === "/crm/opportunities/o1/tender-submissions") return Promise.resolve({ tenderSubmissions: TENDER_SUBMISSIONS });
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["crm.lead.manage"] });
    if (path === "/admin/users") return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
    return Promise.resolve({});
  });
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/crm/opportunities/o1"]}>
      <Routes>
        <Route path="/crm/opportunities/:id" element={<OpportunityDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OpportunityDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("renders the opportunity overview and tender submissions", async () => {
    renderDetail();
    expect(await screen.findByText("Marina Tower fit-out")).toBeInTheDocument();
    expect(screen.getByText("Al Futtaim")).toBeInTheDocument();
    expect(screen.getByText(/open documents, estimates/i)).toBeInTheDocument();
  });

  it("adds a new tender submission", async () => {
    renderDetail();
    await screen.findByText("Marina Tower fit-out");
    await userEvent.click(screen.getByRole("button", { name: /new tender submission/i }));

    const [deadlineInput] = screen.getAllByDisplayValue("");
    await userEvent.type(deadlineInput, "2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: /add tender submission/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/opportunities/o1/tender-submissions",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("switches to the site visits tab and logs a visit", async () => {
    renderDetail();
    await screen.findByText("Marina Tower fit-out");
    await userEvent.click(screen.getByRole("button", { name: /site visits/i }));
    expect(await screen.findByText(/no site visits logged yet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /log site visit/i }));
    const ownerSearch = screen.getByPlaceholderText("Visited by…");
    await userEvent.click(ownerSearch);
    await userEvent.type(ownerSearch, "Uma");
    await userEvent.click(await screen.findByText("Uma One (u1@sevents.test)"));
    await userEvent.type(document.querySelector('input[type="date"]')!, "2026-11-05");
    await userEvent.click(screen.getByRole("button", { name: /add visit/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/opportunities/o1/site-visits",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
