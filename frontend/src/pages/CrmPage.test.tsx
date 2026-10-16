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
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path.startsWith("/crm/clients") && !init) return Promise.resolve({ clients: CLIENTS });
    if (path.startsWith("/crm/contacts") && !init) return Promise.resolve({ contacts: CONTACTS });
    if (path === "/crm/opportunities" && !init) return Promise.resolve({ opportunities: OPPORTUNITIES });
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["crm.lead.manage"] });
    if (path === "/admin/users") {
      return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
    }
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

  it("creates a client through the form", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: /new client/i }));

    await userEvent.type(screen.getByPlaceholderText("Client name"), "Emaar Properties");
    await userEvent.click(screen.getByRole("button", { name: /add client/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/clients",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("edits a client through the form", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));

    const nameInput = screen.getByPlaceholderText("Client name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Al Futtaim Group");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/clients/c1",
        "test-token",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("creates a contact through the form, picking the client and toggling primary", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: "Contacts" }));
    await screen.findByText("Sara");
    await userEvent.click(screen.getByRole("button", { name: /new contact/i }));

    await userEvent.selectOptions(screen.getByRole("combobox"), "c1");
    await userEvent.type(screen.getByPlaceholderText("Contact name"), "Omar");
    await userEvent.click(screen.getByRole("checkbox", { name: /primary contact/i }));
    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/clients/c1/contacts",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("creates an opportunity through the form with a client, source and BD owner", async () => {
    render(<CrmPage />);
    await screen.findByText("Al Futtaim");
    await userEvent.click(screen.getByRole("button", { name: "Pipeline" }));
    await screen.findByText("Marina Tower fit-out");
    await userEvent.click(screen.getByRole("button", { name: /new opportunity/i }));

    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "c1");
    await userEvent.type(screen.getByPlaceholderText("Source"), "referral");
    await userEvent.type(screen.getByPlaceholderText("Opportunity title"), "Mall fit-out");
    const ownerSearch = screen.getByPlaceholderText("BD owner…");
    await userEvent.click(ownerSearch);
    await userEvent.type(ownerSearch, "Uma");
    await userEvent.click(await screen.findByText("Uma One (u1@sevents.test)"));
    await userEvent.click(screen.getByRole("button", { name: /add opportunity/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/opportunities",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
