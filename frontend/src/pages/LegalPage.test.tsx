import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LegalPage } from "./LegalPage";
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

const mockSession = { access_token: "test-token", user: { id: "user-1", email: "clo@sevents.ae" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const LICENCES = [
  {
    id: "lic-1",
    project_id: null,
    licence_name: "Dubai Commercial Trade Licence",
    licence_number: "DED-2024-884920",
    category: "trade_licence",
    issuing_authority: "Department of Economy and Tourism (DET)",
    issue_date: "2024-01-01",
    expiry_date: "2027-01-01",
    renewal_lead_days: 60,
    status: "active",
    responsible_officer: "Zainab Al Hashimi",
    renewal_cost: 25000,
    document_url: null,
    notes: "Main operational commercial licence",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "lic-2",
    project_id: "proj-1",
    licence_name: "Civil Defense Fire Safety Certificate",
    licence_number: "DCD-FS-2026-119",
    category: "civil_defense",
    issuing_authority: "Dubai Civil Defense",
    issue_date: "2025-10-15",
    expiry_date: "2026-10-25",
    renewal_lead_days: 30,
    status: "expiring_soon",
    responsible_officer: "Hamad Al Mazrouei",
    renewal_cost: 8500,
    document_url: null,
    notes: "Site office and warehouse inspection clearance",
    created_at: "2025-10-15T00:00:00Z",
  },
];

const MATTERS = [
  {
    id: "mat-1",
    project_id: "proj-1",
    matter_reference: "ARB-DIAC-2026-004",
    title: "Subcontractor Delay & Quantum Dispute - Package 3",
    matter_type: "arbitration",
    court_or_tribunal: "DIAC (Dubai International Arbitration Centre)",
    claim_amount: 1450000,
    currency: "AED",
    opposing_party: "Apex MEP Contracting LLC",
    risk_level: "high",
    access_class: "privileged_confidential",
    internal_counsel: "Counsel Sarah Jenkins",
    status: "pleadings",
    summary: "Dispute concerning time extension and disputed variations on MEP installation.",
    created_at: "2026-05-10T00:00:00Z",
  },
];

const COUNSEL = [
  {
    id: "csl-1",
    firm_name: "Al Tamimi & Company",
    lead_attorney: "Marcus Aurelius, Partner",
    email: "m.aurelius@tamimi.example.com",
    phone: "+971 4 364 1000",
    specialization: "Construction & DIAC Arbitration",
    fee_arrangement: "hourly",
    budget_amount: 300000,
    billed_amount: 142000,
    currency: "AED",
    status: "active",
    notes: "Retained for DIAC arbitration matter 004",
    created_at: "2026-01-15T00:00:00Z",
  },
];

const OBLIGATIONS = [
  {
    id: "obl-1",
    obligation_name: "WPS Wage Protection Monthly Submission",
    regulatory_body: "Ministry of Human Resources and Emiratisation (MOHRE)",
    frequency: "monthly",
    deadline_date: "2026-11-05",
    compliance_owner: "HR & Payroll Lead",
    status: "pending",
    evidence_reference: null,
    filing_date: null,
    notes: "Mandatory monthly wage file upload",
    created_at: "2026-10-01T00:00:00Z",
  },
];

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <PermissionsProvider>
        <LegalPage />
      </PermissionsProvider>
    </MemoryRouter>
  );
}

describe("LegalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (url: string) => {
      if (url === "/authority/effective-permissions") {
        return {
          permissions: [
            "legal.licence.manage",
            "legal.licence.renew",
            "legal.matter.manage",
            "legal.matter.view_privileged",
            "legal.counsel.manage",
            "legal.compliance.manage",
          ],
        };
      }
      if (url.includes("/legal/licences")) {
        return { licences: LICENCES };
      }
      if (url.includes("/legal/matters")) {
        return { matters: MATTERS };
      }
      if (url.includes("/legal/counsel")) {
        return { counsel: COUNSEL };
      }
      if (url.includes("/legal/obligations")) {
        return { obligations: OBLIGATIONS };
      }
      return {};
    });
  });

  it("renders the Legal & Licences header and tab buttons", async () => {
    renderWithProviders();

    expect(await screen.findByText("Legal, Licences & Regulatory Register")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /licences & permits/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /legal matters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /external counsel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compliance obligations & filings/i })).toBeInTheDocument();
  });

  it("displays licences in the licences table", async () => {
    renderWithProviders();

    expect(await screen.findByText("Dubai Commercial Trade Licence")).toBeInTheDocument();
    expect(screen.getByText("DED-2024-884920")).toBeInTheDocument();
    expect(screen.getByText("Civil Defense Fire Safety Certificate")).toBeInTheDocument();
    expect(screen.getByText("DCD-FS-2026-119")).toBeInTheDocument();
  });

  it("opens the Register Licence modal when clicking the button", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const registerBtn = await screen.findByRole("button", { name: /\+ register licence \/ permit/i });
    await user.click(registerBtn);

    expect(await screen.findByText("Register Licence or Permit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Commercial Contracting Licence/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText("Register Licence or Permit")).not.toBeInTheDocument();
    });
  });

  it("navigates to the Legal Matters tab and shows disputes", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const mattersTab = await screen.findByRole("button", { name: /legal matters/i });
    await user.click(mattersTab);

    expect(await screen.findByText("Subcontractor Delay & Quantum Dispute - Package 3")).toBeInTheDocument();
    expect(screen.getByText("ARB-DIAC-2026-004")).toBeInTheDocument();
    expect(screen.getByText("Apex MEP Contracting LLC")).toBeInTheDocument();
  });

  it("navigates to the External Counsel tab and shows law firms", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const counselTab = await screen.findByRole("button", { name: /external counsel/i });
    await user.click(counselTab);

    expect(await screen.findByText("Al Tamimi & Company")).toBeInTheDocument();
    expect(screen.getByText("Marcus Aurelius, Partner")).toBeInTheDocument();
    expect(screen.getByText("Construction & DIAC Arbitration")).toBeInTheDocument();
  });

  it("navigates to the Compliance Obligations tab and displays statutory filings", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const obligationsTab = await screen.findByRole("button", { name: /compliance obligations & filings/i });
    await user.click(obligationsTab);

    expect(await screen.findByText("WPS Wage Protection Monthly Submission")).toBeInTheDocument();
    expect(screen.getByText("Ministry of Human Resources and Emiratisation (MOHRE)")).toBeInTheDocument();
  });

  it("opens the renewal modal for an expiring licence", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(await screen.findByText("Dubai Commercial Trade Licence")).toBeInTheDocument();

    const renewButtons = screen.getAllByRole("button", { name: /renew/i });
    expect(renewButtons.length).toBeGreaterThan(0);

    await user.click(renewButtons[0]);

    expect(await screen.findByText("Renew Licence / Permit")).toBeInTheDocument();
    expect(screen.getByText(/New Expiry Date \*/i)).toBeInTheDocument();
  });
});
