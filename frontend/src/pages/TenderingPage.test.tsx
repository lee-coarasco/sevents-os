import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TenderingPage } from "./TenderingPage";

function renderTenderingPage() {
  return render(
    <MemoryRouter>
      <TenderingPage />
    </MemoryRouter>,
  );
}

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

const mockSession = { access_token: "test-token", user: { email: "estimator@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const CLIENTS = [{ id: "c1", name: "Horizon Realty Developers Ltd." }];
const OPPORTUNITIES = [
  {
    id: "o1",
    client_id: "c1",
    title: "The Metro Tech Park - Tower C Construction Package",
    source: "Direct RFP",
    owner_id: "u1",
    stage: "tender",
    expected_value: 450000000,
    probability: 80,
  },
];
const SUBMISSIONS = [
  {
    id: "ts1",
    deadline_date: "2026-11-15T00:00:00Z",
    submitted_at: null,
    evidence_reference: null,
    notes: "Turnkey Civil & MEP Package",
  },
];

describe("TenderingPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (path === "/crm/opportunities") return Promise.resolve({ opportunities: OPPORTUNITIES });
      if (path === "/crm/clients") return Promise.resolve({ clients: CLIENTS });
      if (path === "/crm/opportunities/o1/tender-submissions") {
        return Promise.resolve({ tenderSubmissions: SUBMISSIONS });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["tendering.document.manage", "crm.lead.manage"] });
      }
      return Promise.resolve({});
    });
  });

  it("renders the tendering cockpit header, KPIs, and opportunity rows", async () => {
    renderTenderingPage();

    expect(await screen.findByText(/Tendering, Estimation & Commercials/i)).toBeInTheDocument();
    expect(screen.getByText("The Metro Tech Park - Tower C Construction Package")).toBeInTheDocument();
    expect(screen.getByText("Horizon Realty Developers Ltd.")).toBeInTheDocument();
    expect(screen.getByText("Open Estimating Workspace →")).toBeInTheDocument();
  });

  it("allows searching for tender opportunities", async () => {
    renderTenderingPage();

    await screen.findByText("The Metro Tech Park - Tower C Construction Package");
    const searchInput = screen.getByPlaceholderText(/Search tender or client…/i);
    await userEvent.type(searchInput, "Nonexistent");

    expect(screen.getByText(/No tendering opportunities found/i)).toBeInTheDocument();

    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "Metro Tech");
    expect(screen.getByText("The Metro Tech Park - Tower C Construction Package")).toBeInTheDocument();
  });
});
