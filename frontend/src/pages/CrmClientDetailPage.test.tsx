import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CrmClientDetailPage } from "./CrmClientDetailPage";

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

const mockSession = { access_token: "test-token", user: { email: "bd@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({
    has: (permission: string) => permission === "crm.lead.manage",
    loading: false,
    permissions: ["crm.lead.manage"],
  }),
}));

const CLIENT = {
  id: "client-1",
  name: "Emaar Properties",
  trade_license_number: "TL-EMAAR-99",
  registration_country: "UAE",
};

const CONTACTS = [
  {
    id: "cont-1",
    client_id: "client-1",
    name: "Tariq Mansoor",
    title: "Procurement Director",
    email: "tariq@emaar.test",
    phone: "+971 50 123 4567",
    is_primary: true,
  },
];

const OPPORTUNITIES = [
  {
    id: "opp-1",
    client_id: "client-1",
    title: "Downtown Tower Fitout",
    source: "Direct",
    owner_id: "u1",
    stage: "tender",
    expected_value: 1250000,
    probability: 60,
  },
];

const COMMUNICATIONS = [
  {
    id: "comm-1",
    client_id: "client-1",
    channel: "meeting",
    summary: "Kickoff scoping meeting at Emaar HQ",
    occurred_at: "2026-03-01T10:00:00Z",
  },
];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/crm/clients/client-1") return Promise.resolve({ client: CLIENT });
    if (path === "/crm/clients/client-1/contacts") return Promise.resolve({ contacts: CONTACTS });
    if (path === "/crm/opportunities") return Promise.resolve({ opportunities: OPPORTUNITIES });
    if (path === "/crm/client-communications?clientId=client-1") {
      return Promise.resolve({ clientCommunications: COMMUNICATIONS });
    }
    if (path === "/admin/users") {
      return Promise.resolve({ users: [{ id: "u1", email: "bd@sevents.test", display_name: "BD Lead" }] });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions: ["crm.lead.manage"] });
    }
    return Promise.resolve({});
  });
}

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={["/crm/clients/client-1"]}>
      <Routes>
        <Route path="/crm/clients/:id" element={<CrmClientDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CrmClientDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("renders client details, contact list and stats", async () => {
    renderComponent();
    expect(await screen.findByRole("heading", { name: "Emaar Properties" })).toBeInTheDocument();
    expect(screen.getByText("TL-EMAAR-99")).toBeInTheDocument();
    expect(screen.getByText("UAE")).toBeInTheDocument();
    expect(screen.getByText("Tariq Mansoor")).toBeInTheDocument();
    expect(screen.getByText("Procurement Director")).toBeInTheDocument();
    expect(screen.getAllByText("Primary")[0]).toBeInTheDocument();
  });

  it("edits client details and sends PATCH request", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/crm/clients/client-1" && init?.method === "PATCH") {
        return Promise.resolve({ client: { ...CLIENT, name: "Emaar Developments LLC" } });
      }
      if (path === "/crm/clients/client-1") return Promise.resolve({ client: CLIENT });
      if (path === "/crm/clients/client-1/contacts") return Promise.resolve({ contacts: [] });
      if (path === "/crm/opportunities") return Promise.resolve({ opportunities: [] });
      if (path === "/crm/client-communications?clientId=client-1") return Promise.resolve({ clientCommunications: [] });
      if (path === "/admin/users") return Promise.resolve({ users: [] });
      return Promise.resolve({});
    });

    renderComponent();
    await screen.findByRole("heading", { name: "Emaar Properties" });

    await userEvent.click(screen.getByRole("button", { name: /edit details/i }));
    const nameInput = screen.getByPlaceholderText("Client name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Emaar Developments LLC");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/clients/client-1",
        "test-token",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            name: "Emaar Developments LLC",
            tradeLicenseNumber: "TL-EMAAR-99",
            registrationCountry: "UAE",
          }),
        })
      );
    });
  });

  it("adds a new contact to the client", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/crm/clients/client-1/contacts" && init?.method === "POST") {
        return Promise.resolve({ contact: { id: "cont-2" } });
      }
      if (path === "/crm/clients/client-1") return Promise.resolve({ client: CLIENT });
      if (path === "/crm/clients/client-1/contacts") return Promise.resolve({ contacts: CONTACTS });
      if (path === "/crm/opportunities") return Promise.resolve({ opportunities: [] });
      if (path === "/crm/client-communications?clientId=client-1") return Promise.resolve({ clientCommunications: [] });
      if (path === "/admin/users") return Promise.resolve({ users: [] });
      return Promise.resolve({});
    });

    renderComponent();
    await screen.findByRole("heading", { name: "Emaar Properties" });

    await userEvent.click(screen.getByRole("button", { name: /add contact/i }));
    await userEvent.type(screen.getByPlaceholderText(/full name \*/i), "Salim Al-Nuaimi");
    await userEvent.type(screen.getByPlaceholderText(/job title/i), "Contracts Manager");
    await userEvent.click(screen.getByRole("button", { name: /save contact/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/crm/clients/client-1/contacts",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Salim Al-Nuaimi",
            title: "Contracts Manager",
            email: null,
            phone: null,
            isPrimary: false,
          }),
        })
      );
    });
  });

  it("switches to opportunities tab and displays linked opportunities", async () => {
    renderComponent();
    await screen.findByRole("heading", { name: "Emaar Properties" });

    await userEvent.click(screen.getByRole("button", { name: /opportunities \(1\)/i }));
    expect(await screen.findByText("Downtown Tower Fitout")).toBeInTheDocument();
    expect(screen.getAllByText(/12,?50,?000/)[0]).toBeInTheDocument();
  });

  it("switches to communications tab and displays communication history", async () => {
    renderComponent();
    await screen.findByRole("heading", { name: "Emaar Properties" });

    await userEvent.click(screen.getByRole("button", { name: /communications \(1\)/i }));
    expect(await screen.findByText(/kickoff scoping meeting at emaar hq/i)).toBeInTheDocument();
  });
});
