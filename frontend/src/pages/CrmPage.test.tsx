import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrmPage } from "./CrmPage";

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

const CLIENTS = [{ id: "c1", name: "Al Futtaim", trade_license_number: "TL-1", registration_country: "UAE" }];
const CONTACTS = [{ id: "ct1", client_id: "c1", name: "Sara", title: "Procurement", email: "sara@example.com", phone: null, is_primary: true }];
const OPPORTUNITIES = [
  { id: "o1", client_id: "c1", title: "Marina Tower fit-out", stage: "lead", expected_value: 250000, probability: 20 },
  { id: "o2", client_id: "c1", title: "Airport warehouse", stage: "tender", expected_value: 900000, probability: 60 },
];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path.startsWith("/crm/clients")) return Promise.resolve({ clients: CLIENTS });
    if (path.startsWith("/crm/contacts")) return Promise.resolve({ contacts: CONTACTS });
    if (path === "/crm/opportunities") return Promise.resolve({ opportunities: OPPORTUNITIES });
    return Promise.resolve({});
  });
}

describe("CrmPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists clients by default", async () => {
    render(<CrmPage />);
    expect(await screen.findByText("Al Futtaim")).toBeInTheDocument();
    expect(screen.getByText("TL-1")).toBeInTheDocument();
  });

  it("switches to the contacts tab and resolves the client name", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: "Contacts" }));

    expect(await screen.findByText("Sara")).toBeInTheDocument();
    expect(screen.getAllByText("Al Futtaim").length).toBeGreaterThan(0);
  });

  it("switches to the pipeline tab and groups opportunities by stage", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: "Pipeline" }));

    expect(await screen.findByText("Marina Tower fit-out")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Lead \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Tender \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Won \(0\)/ })).toBeInTheDocument();
  });

  it("moves an opportunity to a new stage", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: "Pipeline" }));
    await screen.findByText("Marina Tower fit-out");

    const selects = screen.getAllByDisplayValue("Lead");
    await userEvent.selectOptions(selects[0], "qualified");

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/opportunities/o1",
        "test-token",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ stage: "qualified" }) }),
      ),
    );
  });
});
