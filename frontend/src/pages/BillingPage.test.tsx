import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BillingPage } from "./BillingPage";
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

const mockSession = { access_token: "test-token", user: { email: "commercial.manager@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower" },
];

const APPLICATIONS = [
  {
    id: "app-1",
    project_id: "proj-101",
    application_number: "APP-001",
    period_start: "2026-10-01",
    period_end: "2026-10-31",
    submission_date: "2026-10-31",
    gross_work_completed: 100000,
    advance_recovery_amount: 10000,
    retention_withheld_amount: 10000,
    net_certified_amount: 80000,
    tax_rate: 5,
    tax_amount: 4000,
    total_amount: 84000,
    status: "submitted",
    notes: "Foundation concrete works",
    created_at: "2026-10-31T00:00:00Z",
  },
];

const INVOICES = [
  {
    id: "inv-1",
    project_id: "proj-101",
    invoice_number: "INV-2026-001",
    invoice_type: "progress",
    client_name: "Emaar Properties PJSC",
    trn: "100293847500003",
    issue_date: "2026-10-31",
    due_date: "2026-11-30",
    subtotal_amount: 80000,
    tax_amount: 4000,
    total_amount: 84000,
    paid_amount: 40000,
    status: "partially_paid",
    notes: "Progress Invoice 1",
    created_at: "2026-10-31T00:00:00Z",
  },
];

const AGING = {
  current_amount: 44000,
  days_31_60: 0,
  days_61_90: 0,
  days_90_plus: 0,
  total_overdue: 0,
};

const VENDOR_BILLS = [
  {
    id: "bill-1",
    project_id: "proj-101",
    vendor_id: "vendor-steel-co",
    po_id: "PO-101",
    bill_number: "SINV-8821",
    bill_date: "2026-10-15",
    due_date: "2026-11-15",
    subtotal_amount: 50000,
    tax_amount: 2500,
    total_amount: 52500,
    match_status: "matched",
    status: "approved",
    paid_amount: 0,
    created_at: "2026-10-15T00:00:00Z",
  },
];

const RETENTIONS = [
  {
    id: "ret-1",
    project_id: "proj-101",
    retention_type: "client_receivable",
    party_name: "Emaar Properties PJSC",
    reference_id: "TOWER-RET-01",
    total_retained_amount: 100000,
    first_release_amount: 50000,
    first_release_date: "2027-01-15",
    first_release_status: "pending",
    second_release_amount: 50000,
    second_release_due_date: "2028-01-15",
    second_release_status: "pending",
    status: "held",
    created_at: "2026-10-15T00:00:00Z",
  },
];

describe("M22: Billing, Invoicing, Receivables & Payables Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") {
        return {
          permissions: [
            "billing.application.manage",
            "billing.application.certify",
            "billing.invoice.manage",
            "billing.receipt.record",
            "billing.vendor_bill.manage",
            "billing.vendor_bill.approve",
            "billing.retention.manage",
          ],
        };
      }
      if (path === "/projects") {
        return { projects: PROJECTS };
      }
      if (path.startsWith("/billing/applications")) {
        return { applications: APPLICATIONS };
      }
      if (path.startsWith("/billing/invoices")) {
        return { invoices: INVOICES };
      }
      if (path === "/billing/aging") {
        return { aging: AGING };
      }
      if (path.startsWith("/billing/vendor-bills")) {
        return { vendorBills: VENDOR_BILLS };
      }
      if (path.startsWith("/billing/retentions")) {
        return { retentions: RETENTIONS };
      }
      return {};
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PermissionsProvider>
          <BillingPage />
        </PermissionsProvider>
      </MemoryRouter>
    );
  };

  it("renders page header, KPI cards, and payment applications table", async () => {
    renderComponent();

    expect(await screen.findByText(/Billing, Invoicing & Receivables \/ Payables \(M22\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Certified Progress \(Net\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Accounts Receivable \(AR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Accounts Payable \(AP\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Client Retention Held/i)).toBeInTheDocument();

    // Verify Application list row
    expect(await screen.findByText("APP-001")).toBeInTheDocument();
    expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
    expect(screen.getByText("+ New Payment Application")).toBeInTheDocument();
  });

  it("opens '+ New Payment Application' modal", async () => {
    const user = userEvent.setup();
    renderComponent();

    const newBtn = await screen.findByText("+ New Payment Application");
    await user.click(newBtn);

    expect(await screen.findByText("Submit Application for Payment (IPC)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. APP-001")).toBeInTheDocument();
  });

  it("navigates to Tax Invoices & AR tab and displays invoice register and aging", async () => {
    const user = userEvent.setup();
    renderComponent();

    const invTab = await screen.findByRole("button", { name: /Tax Invoices & Receivables \(AR\)/i });
    await user.click(invTab);

    expect(await screen.findByText("Official Tax Invoices (5% UAE VAT)")).toBeInTheDocument();
    expect(screen.getByText(/AR\) Aging Analysis/i)).toBeInTheDocument();
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Emaar Properties PJSC")).toBeInTheDocument();
    expect(screen.getByText("PARTIALLY PAID")).toBeInTheDocument();
  });

  it("navigates to Vendor Bills (AP) tab and displays 3-way match status", async () => {
    const user = userEvent.setup();
    renderComponent();

    const billsTab = await screen.findByRole("button", { name: /Vendor Bills & 3-Way Match \(AP\)/i });
    await user.click(billsTab);

    expect(await screen.findByText("Vendor & Subcontractor Bills (3-Way Matching AP)")).toBeInTheDocument();
    expect(screen.getByText("SINV-8821")).toBeInTheDocument();
    expect(screen.getByText(/3-Way Matched/i)).toBeInTheDocument();
    expect(screen.getByText("+ Register Vendor Bill")).toBeInTheDocument();
  });

  it("navigates to Retention & DLP Ledger tab and displays milestone release schedule", async () => {
    const user = userEvent.setup();
    renderComponent();

    const retTab = await screen.findByRole("button", { name: /Retention & DLP Ledger/i });
    await user.click(retTab);

    expect(await screen.findByText("Retention Ledger (TOC & DLP Release Schedule)")).toBeInTheDocument();
    expect(screen.getByText("TOWER-RET-01")).toBeInTheDocument();
    expect(screen.getByText("Client Receivable")).toBeInTheDocument();
    expect(screen.getByText("Release TOC (50%)")).toBeInTheDocument();
  });
});
