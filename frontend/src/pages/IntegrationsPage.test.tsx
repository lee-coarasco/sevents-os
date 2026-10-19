import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { IntegrationsPage } from "./IntegrationsPage";
import { PermissionsProvider } from "../context/PermissionsContext";

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

const mockSession = { access_token: "test-token", user: { id: "user-1", email: "admin@sevents.ae" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const API_KEYS = [
  {
    id: "key-1",
    tenant_id: "tenant-1",
    name: "ERP Sync Service",
    key_prefix: "sev_live_abc123...",
    scopes: ["projects:read", "billing:read"],
    rate_limit_rpm: 120,
    expires_at: null,
    revoked_at: null,
    last_used_at: "2026-10-18T10:00:00Z",
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00Z",
  },
];

const WEBHOOKS = [
  {
    id: "wh-1",
    tenant_id: "tenant-1",
    name: "Finance Webhook",
    target_url: "https://finance.sevents.ae/webhooks/billing",
    event_types: ["billing.invoice_approved"],
    is_active: true,
    created_at: "2026-10-05T00:00:00Z",
    updated_at: "2026-10-05T00:00:00Z",
  },
];

const CONNECTORS = [
  {
    id: "conn-1",
    tenant_id: "tenant-1",
    connector_key: "xero",
    name: "Xero Accounting",
    category: "accounting" as const,
    status: "connected" as const,
    credentials_masked: { client_id: "••••••••1234" },
    settings: { environment: "production" },
    last_sync_at: "2026-10-19T08:30:00Z",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-19T08:30:00Z",
  },
  {
    id: "conn-2",
    tenant_id: "tenant-1",
    connector_key: "docusign",
    name: "DocuSign E-Signature",
    category: "e_sign" as const,
    status: "disconnected" as const,
    credentials_masked: {},
    settings: { environment: "sandbox" },
    last_sync_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
];

const DELIVERIES = [
  {
    id: "del-1",
    tenant_id: "tenant-1",
    webhook_id: "wh-1",
    event_type: "billing.invoice_approved",
    payload: { invoice_id: "inv-101", amount: 250000 },
    response_status: 200,
    response_body: '{"received":true}',
    status: "success" as const,
    delivered_at: "2026-10-19T09:00:00Z",
  },
];

const ALL_PERMISSIONS = [
  "integrations.api_key.manage",
  "integrations.api_key.revoke",
  "integrations.webhook.manage",
  "integrations.webhook.test",
  "integrations.connector.manage",
  "integrations.log.view",
];

function renderWithPerms(initialRoute = "/integrations") {
  return render(
    <PermissionsProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <IntegrationsPage />
      </MemoryRouter>
    </PermissionsProvider>
  );
}

describe("IntegrationsPage (M34: Integrations & API Management)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") return { permissions: ALL_PERMISSIONS };
      if (path === "/integrations/api-keys") return { api_keys: API_KEYS };
      if (path === "/integrations/webhooks") return { webhooks: WEBHOOKS };
      if (path === "/integrations/connectors") return { connectors: CONNECTORS };
      if (path === "/integrations/deliveries") return { deliveries: DELIVERIES };
      return {};
    });
  });

  it("renders the page header and active tab data", async () => {
    renderWithPerms();

    expect(await screen.findByText(/Integrations & API Management/i)).toBeInTheDocument();
    expect(screen.getByText("ERP Sync Service")).toBeInTheDocument();
    expect(screen.getByText("sev_live_abc123...")).toBeInTheDocument();
    expect(screen.getByText("120 rpm")).toBeInTheDocument();
  });

  it("switches to Outbound Webhooks tab and displays webhooks", async () => {
    const user = userEvent.setup();
    renderWithPerms();

    await screen.findByText(/Integrations & API Management/i);

    const webhooksTab = screen.getByRole("button", { name: /Outbound Webhooks/i });
    await user.click(webhooksTab);

    expect(await screen.findByText("Finance Webhook")).toBeInTheDocument();
    expect(screen.getByText("https://finance.sevents.ae/webhooks/billing")).toBeInTheDocument();
    expect(screen.getByText("billing.invoice_approved")).toBeInTheDocument();
  });

  it("switches to Service Connectors tab and shows configured connectors", async () => {
    const user = userEvent.setup();
    renderWithPerms();

    await screen.findByText(/Integrations & API Management/i);

    const connectorsTab = screen.getByRole("button", { name: /Service Connectors/i });
    await user.click(connectorsTab);

    expect(await screen.findByText("Xero Accounting")).toBeInTheDocument();
    expect(screen.getByText("DocuSign E-Signature")).toBeInTheDocument();
  });

  it("switches to Delivery Logs tab and displays log history", async () => {
    const user = userEvent.setup();
    renderWithPerms();

    await screen.findByText(/Integrations & API Management/i);

    const logsTab = screen.getByRole("button", { name: /Delivery & Audit Logs/i });
    await user.click(logsTab);

    expect(await screen.findByText("billing.invoice_approved")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("wh-1")).toBeInTheDocument();
  });

  it("triggers test ping on a webhook", async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation(async (path: string, _token: string, options?: any) => {
      if (path === "/authority/effective-permissions") return { permissions: ALL_PERMISSIONS };
      if (path === "/integrations/api-keys") return { api_keys: API_KEYS };
      if (path === "/integrations/webhooks") return { webhooks: WEBHOOKS };
      if (path === "/integrations/connectors") return { connectors: CONNECTORS };
      if (path === "/integrations/deliveries") return { deliveries: DELIVERIES };
      if (path === "/integrations/webhooks/wh-1/test" && options?.method === "POST") {
        return {
          delivery: {
            id: "del-test-99",
            tenant_id: "tenant-1",
            webhook_id: "wh-1",
            event_type: "webhook.test_ping",
            payload: { ping: true },
            response_status: 200,
            response_body: '{"received":true}',
            status: "success",
            delivered_at: new Date().toISOString(),
          },
        };
      }
      return {};
    });

    renderWithPerms();
    await screen.findByText(/Integrations & API Management/i);

    const webhooksTab = screen.getByRole("button", { name: /Outbound Webhooks/i });
    await user.click(webhooksTab);

    const testPingBtn = await screen.findByRole("button", { name: /Test Ping/i });
    await user.click(testPingBtn);

    await waitFor(() => {
      expect(screen.getByText(/Test ping dispatched! Response status: 200/i)).toBeInTheDocument();
    });
  });
});
