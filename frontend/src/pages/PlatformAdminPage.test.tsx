import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PlatformAdminPage } from "./PlatformAdminPage";
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

const SETTINGS = {
  id: "sett-1",
  tenant_id: "tenant-1",
  organization_name: "SEVENTS Contracting LLC",
  default_timezone: "Asia/Dubai",
  default_currency: "AED",
  fiscal_year_start_month: 1,
  storage_quota_gb: 100,
  session_timeout_minutes: 60,
  mfa_enforced: false,
  support_email: "support@sevents.ae",
  support_phone: "+971 4 000 0000",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const FLAGS = [
  {
    id: "flag-1",
    tenant_id: "tenant-1",
    flag_key: "ai_copilot_enabled",
    name: "AI Copilot & Document Assistant",
    category: "ai",
    description: "Enables conversational AI queries over documents and workflows.",
    is_enabled: true,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "flag-2",
    tenant_id: "tenant-1",
    flag_key: "wps_banking_export",
    name: "WPS Payroll Bank File Export",
    category: "finance",
    description: "Direct generation of UAE SIF bank transfer files.",
    is_enabled: false,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
];

const HEALTH = {
  status: "healthy" as const,
  timestamp: new Date().toISOString(),
  components: {
    database: { status: "up" as const, latency_ms: 12 },
    storage: { status: "up" as const, quota_used_gb: 14.8, quota_total_gb: 100 },
    auth_service: { status: "up" as const, mfa_enforced: false },
    job_queues: { active_jobs: 3, failed_jobs: 0, delayed_jobs: 0 },
  },
};

const MAINTENANCE_WINDOWS = [
  {
    id: "maint-1",
    tenant_id: "tenant-1",
    title: "Scheduled Database Indexing",
    message: "Routine index optimization scheduled for midnight UTC.",
    severity: "info" as const,
    starts_at: "2026-10-25T00:00:00Z",
    ends_at: "2026-10-25T02:00:00Z",
    is_active: true,
    created_at: "2026-10-18T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
  },
];

const TICKETS = [
  {
    id: "tkt-1",
    tenant_id: "tenant-1",
    ticket_number: "SUP-001001",
    title: "Payment Certificate PDF issue",
    description: "Error 500 when exporting payment application.",
    category: "bug" as const,
    priority: "high" as const,
    status: "open" as const,
    reported_by: "eng@sevents.ae",
    created_at: "2026-10-18T00:00:00Z",
    updated_at: "2026-10-18T00:00:00Z",
  },
];

const ALL_PERMISSIONS = [
  "platform.settings.view",
  "platform.settings.manage",
  "platform.feature_flags.manage",
  "platform.health.view",
  "platform.maintenance.manage",
  "platform.support.view",
  "platform.support.manage",
];

function renderWithPerms(initialRoute = "/platform-admin") {
  return render(
    <PermissionsProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <PlatformAdminPage />
      </MemoryRouter>
    </PermissionsProvider>
  );
}

describe("PlatformAdminPage (M36: Platform Administration & Support)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") return { permissions: ALL_PERMISSIONS };
      if (path === "/platform-admin/settings") return { settings: SETTINGS };
      if (path === "/platform-admin/feature-flags") return { flags: FLAGS };
      if (path === "/platform-admin/health") return { health: HEALTH };
      if (path === "/platform-admin/maintenance") return { maintenance_windows: MAINTENANCE_WINDOWS };
      if (path === "/platform-admin/support-tickets") return { tickets: TICKETS };
      return {};
    });
  });

  it("renders page header and tenant profile configuration form", async () => {
    renderWithPerms();

    expect(await screen.findByText(/Platform Administration & Support/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("SEVENTS Contracting LLC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("support@sevents.ae")).toBeInTheDocument();
    expect(screen.getByText("Storage & Capacity Quotas")).toBeInTheDocument();
  });

  it("switches to Feature Flags tab and toggles a flag", async () => {
    const user = userEvent.setup();
    apiFetch.mockImplementation(async (path: string, _token: string, options?: any) => {
      if (path === "/authority/effective-permissions") return { permissions: ALL_PERMISSIONS };
      if (path === "/platform-admin/settings") return { settings: SETTINGS };
      if (path === "/platform-admin/feature-flags") return { flags: FLAGS };
      if (path === "/platform-admin/health") return { health: HEALTH };
      if (path === "/platform-admin/maintenance") return { maintenance_windows: MAINTENANCE_WINDOWS };
      if (path === "/platform-admin/support-tickets") return { tickets: TICKETS };
      if (path === "/platform-admin/feature-flags/toggle" && options?.method === "POST") {
        return {
          flag: {
            ...FLAGS[1],
            is_enabled: true,
          },
        };
      }
      return {};
    });

    renderWithPerms();
    await screen.findByText(/Platform Administration & Support/i);

    const flagsTab = screen.getByRole("button", { name: /Feature Flags/i });
    await user.click(flagsTab);

    expect(await screen.findByText("ai_copilot_enabled")).toBeInTheDocument();
    expect(screen.getByText("wps_banking_export")).toBeInTheDocument();

    const enableButtons = screen.getAllByRole("button", { name: /Enable/i });
    await user.click(enableButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Flag WPS Payroll Bank File Export enabled/i)).toBeInTheDocument();
    });
  });

  it("switches to System Health tab and renders component telemetry", async () => {
    const user = userEvent.setup();
    renderWithPerms();
    await screen.findByText(/Platform Administration & Support/i);

    const healthTab = screen.getByRole("button", { name: /System Health & Observability/i });
    await user.click(healthTab);

    expect(await screen.findByText("12 ms")).toBeInTheDocument();
    expect(screen.getByText("14.8 GB")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL ping latency")).toBeInTheDocument();
  });

  it("switches to Support & Helpdesk tab and displays tickets", async () => {
    const user = userEvent.setup();
    renderWithPerms();
    await screen.findByText(/Platform Administration & Support/i);

    const supportTab = screen.getByRole("button", { name: /Support & Helpdesk/i });
    await user.click(supportTab);

    expect(await screen.findByText("SUP-001001")).toBeInTheDocument();
    expect(screen.getByText("Payment Certificate PDF issue")).toBeInTheDocument();
    expect(screen.getByText("eng@sevents.ae")).toBeInTheDocument();
  });
});
