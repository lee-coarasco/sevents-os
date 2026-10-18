import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProcurementPage } from "./ProcurementPage";
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

const mockSession = { access_token: "test-token", user: { email: "procurement.manager@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const VENDORS = [
  {
    id: "ven-1",
    name: "Al Futtaim Building Materials",
    trade_license_number: "TL-88412",
    tax_registration_number: "100293847500003",
    contact_person: "Rashid Ali",
    email: "rashid@alfuttaim.ae",
    phone: "+971501234567",
    address: "Al Quoz Industrial Area 3, Dubai",
    category: "materials",
    rating: 5,
    status: "active",
    created_at: "2026-10-18T10:00:00Z",
  },
];

const REQUISITIONS = [
  {
    id: "pr-1",
    project_id: "proj-101",
    pr_number: "PR-90001",
    title: "High Grade Rebar Steel",
    required_date: "2026-10-25",
    priority: "urgent",
    status: "draft",
    requested_by: "eng-1",
    total_estimated_amount: 12500,
    currency: "AED",
    notes: "Direct deliver to Bay A",
    approved_at: null,
    approved_by: null,
    rejection_reason: null,
    created_at: "2026-10-18T10:00:00Z",
  },
];

const PR_DETAIL = {
  requisition: REQUISITIONS[0],
  items: [
    {
      id: "pri-1",
      requisition_id: "pr-1",
      item_description: "Deformed High Tensile Steel 16mm",
      cost_code: "03-REBAR",
      quantity: 5,
      uom: "TON",
      estimated_unit_rate: 2500,
      estimated_total_amount: 12500,
      notes: null,
    },
  ],
};

const ORDERS = [
  {
    id: "po-1",
    project_id: "proj-101",
    vendor_id: "ven-1",
    vendor_name: "Al Futtaim Building Materials",
    requisition_id: "pr-1",
    po_number: "PO-77001",
    order_date: "2026-10-18",
    expected_delivery_date: "2026-10-24",
    delivery_address: "Main Site, Dubai",
    payment_terms: "30 Days PDC",
    status: "issued",
    subtotal_amount: 10000,
    tax_amount: 500,
    total_amount: 10500,
    currency: "AED",
    notes: null,
    created_at: "2026-10-18T11:00:00Z",
  },
];

const PO_DETAIL = {
  order: ORDERS[0],
  items: [
    {
      id: "poi-1",
      po_id: "po-1",
      item_description: "Deformed Steel 16mm",
      quantity: 4,
      uom: "TON",
      unit_price: 2500,
      total_amount: 10000,
      delivery_status: "pending",
    },
  ],
};

describe("ProcurementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/projects") return PROJECTS;
      if (path.startsWith("/procurement/vendors")) return VENDORS;
      if (path.includes("/procurement/requisitions/pr-1")) return PR_DETAIL;
      if (path.includes("/procurement/requisitions")) return REQUISITIONS;
      if (path.includes("/procurement/orders/po-1")) return PO_DETAIL;
      if (path.includes("/procurement/orders")) return ORDERS;
      if (path === "/authority/effective-permissions") {
        return {
          roles: ["platform_administrator"],
          permissions: [
            "procurement.vendor.manage",
            "procurement.requisition.manage",
            "procurement.requisition.approve",
            "procurement.po.manage",
            "procurement.po.approve",
          ],
        };
      }
      return [];
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <PermissionsProvider>
          <ProcurementPage />
        </PermissionsProvider>
      </MemoryRouter>
    );

  it("renders page header and tabs correctly", async () => {
    renderComponent();

    expect(await screen.findByText("Procurement & Purchase Orders")).toBeInTheDocument();
    expect(screen.getByText("Purchase Requisitions (PR)")).toBeInTheDocument();
    expect(screen.getByText("Purchase Orders (PO)")).toBeInTheDocument();
    expect(screen.getByText("Approved Vendor List (AVL)")).toBeInTheDocument();
  });

  it("lists purchase requisitions and allows opening drawer", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText("PR-90001")).toBeInTheDocument();
    expect(screen.getByText("High Grade Rebar Steel")).toBeInTheDocument();
    expect(screen.getByText("URGENT")).toBeInTheDocument();

    // Click "View Items"
    const viewBtn = screen.getByRole("button", { name: /view items/i });
    await user.click(viewBtn);

    expect(await screen.findByText("Requisition Line Items")).toBeInTheDocument();
    expect(screen.getByText("Deformed High Tensile Steel 16mm")).toBeInTheDocument();
    expect(screen.getByText("Submit for Approval")).toBeInTheDocument();
  });

  it("switches to PO tab and displays purchase orders with VAT breakdown", async () => {
    const user = userEvent.setup();
    renderComponent();

    const poTab = await screen.findByRole("button", { name: /purchase orders/i });
    await user.click(poTab);

    expect(await screen.findByText("PO-77001")).toBeInTheDocument();
    expect(screen.getByText("AED 10,000.00")).toBeInTheDocument(); // Subtotal
    expect(screen.getByText("AED 500.00")).toBeInTheDocument(); // 5% VAT
    expect(screen.getByText("AED 10,500.00")).toBeInTheDocument(); // Total
  });

  it("switches to AVL tab and displays approved vendors", async () => {
    const user = userEvent.setup();
    renderComponent();

    const avlTab = await screen.findByRole("button", { name: /approved vendor list/i });
    await user.click(avlTab);

    expect(await screen.findByText("Al Futtaim Building Materials")).toBeInTheDocument();
    expect(screen.getByText("+ Register New Vendor")).toBeInTheDocument();
    expect(screen.getByText("TL-88412")).toBeInTheDocument();
  });
});
