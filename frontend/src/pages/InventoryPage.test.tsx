import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { InventoryPage } from "./InventoryPage";
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

const mockSession = { access_token: "test-token", user: { email: "storekeeper@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const LOCATIONS = [
  {
    id: "loc-1",
    project_id: "proj-101",
    name: "Central Yard A",
    code: "CY-A",
    location_type: "site_store",
    address: "Skyline Tower Ground Level",
    is_active: true,
  },
];

const ITEMS = [
  {
    id: "itm-1",
    item_code: "MAT-CBL-001",
    name: "Copper Armoured Cable 4C x 16mm",
    category: "materials",
    uom: "MTR",
    reorder_level: 100,
    unit_cost: 45.5,
  },
];

const BALANCES = [
  {
    id: "bal-1",
    location_id: "loc-1",
    item_id: "itm-1",
    item_code: "MAT-CBL-001",
    item_name: "Copper Armoured Cable 4C x 16mm",
    category: "materials",
    uom: "MTR",
    location_name: "Central Yard A",
    rack_bin: "RACK-02",
    quantity_on_hand: 500,
    quantity_reserved: 0,
  },
];

const GRNS = [
  {
    id: "grn-1",
    project_id: "proj-101",
    grn_number: "GRN-202610-0001",
    location_id: "loc-1",
    location_name: "Central Yard A",
    supplier_delivery_note: "DN-9941",
    carrier_name: "Al Futtaim Supply",
    vehicle_number: "DXB-4412",
    received_date: "2026-10-18",
    status: "draft",
  },
];

const GRN_DETAIL = {
  grn: GRNS[0],
  items: [
    {
      id: "grni-1",
      grn_id: "grn-1",
      item_id: "itm-1",
      item_code: "MAT-CBL-001",
      item_name: "Copper Armoured Cable 4C x 16mm",
      uom: "MTR",
      quantity_delivered: 200,
      quantity_accepted: 200,
      quantity_rejected: 0,
      rack_bin: "RACK-02",
      rejection_reason: null,
    },
  ],
};

const ISSUES = [
  {
    id: "min-1",
    project_id: "proj-101",
    location_id: "loc-1",
    location_name: "Central Yard A",
    issue_number: "MIN-202610-0001",
    issue_date: "2026-10-18",
    issued_to: "Electrical Gang 2",
    cost_code: "04-ELEC",
    status: "draft",
  },
];

const MIN_DETAIL = {
  issue: ISSUES[0],
  items: [
    {
      id: "mini-1",
      issue_id: "min-1",
      item_id: "itm-1",
      item_code: "MAT-CBL-001",
      item_name: "Copper Armoured Cable 4C x 16mm",
      uom: "MTR",
      quantity_issued: 50,
      quantity_returned: 0,
      rack_bin: "RACK-02",
    },
  ],
};

const GATE_PASSES = [
  {
    id: "gp-1",
    project_id: "proj-101",
    pass_number: "GP-202610-0001",
    pass_type: "inbound",
    status: "draft",
    vehicle_number: "DXB-K-99120",
    driver_name: "Tariq Mahmood",
    driver_contact: "+971500000000",
    destination: "Main Gate",
    authorized_by: null,
    exit_time: null,
    notes: "Delivery of supplies",
    created_at: "2026-10-18T10:00:00Z",
  },
];

describe("InventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") {
        return {
          direct_permissions: [
            "inventory.store.manage",
            "inventory.item.manage",
            "inventory.stock.view",
            "inventory.grn.manage",
            "inventory.issue.manage",
            "inventory.gatepass.manage",
          ],
          inherited_permissions: [],
        };
      }
      if (path === "/projects") {
        return { projects: PROJECTS };
      }
      if (path.startsWith("/inventory/locations")) {
        return { locations: LOCATIONS };
      }
      if (path === "/inventory/items") {
        return { items: ITEMS };
      }
      if (path.startsWith("/inventory/stock-balances")) {
        return { balances: BALANCES };
      }
      if (path === "/projects/proj-101/inventory/grns") {
        return { grns: GRNS };
      }
      if (path === "/inventory/grns/grn-1") {
        return GRN_DETAIL;
      }
      if (path === "/projects/proj-101/inventory/issues") {
        return { issues: ISSUES };
      }
      if (path === "/inventory/issues/min-1") {
        return MIN_DETAIL;
      }
      if (path === "/projects/proj-101/inventory/gate-passes") {
        return { gatePasses: GATE_PASSES };
      }
      return {};
    });
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <PermissionsProvider>
          <InventoryPage />
        </PermissionsProvider>
      </MemoryRouter>
    );
  }

  it("renders page header and tabs correctly", async () => {
    renderPage();

    expect(await screen.findByText("Inventory & Site Stores")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Stock Balances/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Goods Received/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Material Issues/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Gate Passes/i })).toBeInTheDocument();
  });

  it("loads and displays live stock balances and catalog items", async () => {
    renderPage();

    expect(await screen.findByText("Copper Armoured Cable 4C x 16mm")).toBeInTheDocument();
    expect(screen.getByText("MAT-CBL-001")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getAllByText("Central Yard A").length).toBeGreaterThan(0);
  });

  it("switches to GRN tab and shows GRN list", async () => {
    const user = userEvent.setup();
    renderPage();

    const grnTab = await screen.findByRole("tab", { name: /Goods Received/i });
    await user.click(grnTab);

    expect(await screen.findByText("GRN-202610-0001")).toBeInTheDocument();
    expect(screen.getByText(/Al Futtaim Supply/)).toBeInTheDocument();
    expect(screen.getByText("DN-9941")).toBeInTheDocument();
  });

  it("switches to Material Issues tab and shows issue note list", async () => {
    const user = userEvent.setup();
    renderPage();

    const issuesTab = await screen.findByRole("tab", { name: /Material Issues/i });
    await user.click(issuesTab);

    expect(await screen.findByText("MIN-202610-0001")).toBeInTheDocument();
    expect(screen.getByText("Electrical Gang 2")).toBeInTheDocument();
  });

  it("switches to Gate Passes tab and shows passes list", async () => {
    const user = userEvent.setup();
    renderPage();

    const gpTab = await screen.findByRole("tab", { name: /Gate Passes/i });
    await user.click(gpTab);

    expect(await screen.findByText("GP-202610-0001")).toBeInTheDocument();
    expect(screen.getByText("DXB-K-99120")).toBeInTheDocument();
    expect(screen.getByText("Tariq Mahmood")).toBeInTheDocument();
  });
});
