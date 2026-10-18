import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ContractsPage } from "./ContractsPage";
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

const mockSession = { access_token: "test-token", user: { id: "user-1", email: "legal@sevents.ae" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const CONTRACTS = [
  {
    id: "ctr-1",
    project_id: "proj-1",
    contract_reference: "CTR-2026-MAIN-001",
    title: "Main Structural & Civil Package",
    contract_type: "main_contract",
    counterparty_name: "Apex Engineering LLC",
    original_value: 2500000,
    revised_value: 2600000,
    signed_date: "2026-01-01",
    commencement_date: "2026-01-15",
    contractual_completion_date: "2026-12-31",
    revised_completion_date: "2027-01-31",
    governing_law: "FIDIC Red Book / UAE Law",
    status: "active",
    notes: "Prime EPC contract",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const VARIATIONS = [
  {
    id: "vo-1",
    contract_id: "ctr-1",
    project_id: "proj-1",
    vo_number: "VO-001",
    title: "Structural slab thickening",
    description: "Extra rebar and concrete for rooftop plant room",
    reason: "design_change",
    proposed_cost_amount: 100000,
    proposed_time_days: 31,
    approved_cost_amount: 100000,
    approved_time_days: 31,
    status: "approved",
    approved_by: "user-1",
    approved_at: "2026-02-01T00:00:00Z",
    notes: "Approved by Employer Representative",
    created_at: "2026-01-20T00:00:00Z",
  },
];

const CLAIMS = [
  {
    id: "clm-1",
    contract_id: "ctr-1",
    project_id: "proj-1",
    claim_number: "CLM-EOT-001",
    title: "Delay due to late site access",
    event_type: "late_access",
    event_date: "2026-01-01",
    notice_date: "2026-02-15",
    notice_deadline_date: "2026-01-29",
    claimed_days: 45,
    claimed_cost_amount: 50000,
    certified_days: 0,
    certified_cost_amount: 0,
    status: "notice_issued",
    assessment_notes: "[FIDIC Cl. 20.1 Notice Warning: Notice issued after 28-day time bar]",
    created_at: "2026-02-15T00:00:00Z",
  },
];

const SECURITIES = [
  {
    id: "sec-1",
    contract_id: "ctr-1",
    project_id: "proj-1",
    security_type: "performance_bond",
    reference_number: "PB-HSBC-2026-99",
    issuing_institution: "HSBC Bank Middle East",
    beneficiary: "Sevents Developments",
    amount: 250000,
    currency: "USD",
    effective_date: "2026-01-01",
    expiry_date: "2027-01-01",
    status: "active",
    notes: "10% performance bond",
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("M23: Contracts, Claims & Variations Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") {
        return {
          permissions: [
            "contracts.contract.manage",
            "contracts.variation.manage",
            "contracts.variation.approve",
            "contracts.claim.manage",
            "contracts.claim.assess",
            "contracts.security.manage",
          ],
        };
      }
      if (path.startsWith("/contracts/variations")) {
        return { variations: VARIATIONS };
      }
      if (path.startsWith("/contracts/claims")) {
        return { claims: CLAIMS };
      }
      if (path.startsWith("/contracts/securities")) {
        return { securities: SECURITIES };
      }
      if (path.startsWith("/contracts")) {
        return { contracts: CONTRACTS };
      }
      return {};
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PermissionsProvider>
          <ContractsPage />
        </PermissionsProvider>
      </MemoryRouter>
    );
  };

  it("renders page header, KPI cards, and contracts table", async () => {
    renderComponent();

    expect(await screen.findByText(/Contracts, Claims & Variations/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Committed Value/i)).toBeInTheDocument();
    expect(screen.getAllByText("$2,600,000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CTR-2026-MAIN-001")).toBeInTheDocument();
    expect(screen.getByText("Main Structural & Civil Package")).toBeInTheDocument();
    expect(screen.getByText("Apex Engineering LLC")).toBeInTheDocument();
  });

  it("switches to Variations tab and displays variation details", async () => {
    const user = userEvent.setup();
    renderComponent();

    const variationsTab = await screen.findByRole("button", { name: /Variation Orders/i });
    await user.click(variationsTab);

    expect(await screen.findByText("VO-001")).toBeInTheDocument();
    expect(screen.getByText("Structural slab thickening")).toBeInTheDocument();
    expect(screen.getByText(/design change/i)).toBeInTheDocument();
  });

  it("switches to Claims tab and displays FIDIC 28-day notice warning", async () => {
    const user = userEvent.setup();
    renderComponent();

    const claimsTab = await screen.findByRole("button", { name: /Claims & EOT/i });
    await user.click(claimsTab);

    expect(await screen.findByText("CLM-EOT-001")).toBeInTheDocument();
    expect(screen.getByText("Delay due to late site access")).toBeInTheDocument();
    expect(screen.getByText(/FIDIC 28-day Time Bar Warning/i)).toBeInTheDocument();
  });

  it("switches to Securities tab and displays active guarantees", async () => {
    const user = userEvent.setup();
    renderComponent();

    const securitiesTab = await screen.findByRole("button", { name: /Bonds & Insurance/i });
    await user.click(securitiesTab);

    expect(await screen.findByText("PB-HSBC-2026-99")).toBeInTheDocument();
    expect(screen.getByText(/performance bond/i)).toBeInTheDocument();
    expect(screen.getByText("HSBC Bank Middle East")).toBeInTheDocument();
  });

  it("opens Register Contract modal when clicking the action button", async () => {
    const user = userEvent.setup();
    renderComponent();

    const registerBtn = await screen.findByRole("button", { name: /\+ Register Contract/i });
    await user.click(registerBtn);

    expect(screen.getByRole("heading", { name: /Register Contract/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/CTR-2026-MAIN-001/i)).toBeInTheDocument();
  });
});
