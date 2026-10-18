import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { EquipmentPage } from "./EquipmentPage";
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

const mockSession = { access_token: "test-token", user: { email: "plant.engineer@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const PROJECTS = [
  { id: "proj-101", name: "Skyline Tower", code: "SKY-01", status: "active" },
];

const ASSETS = [
  {
    id: "eq-1",
    asset_code: "EQ-CAT-320D",
    name: "CAT 320D Hydraulic Excavator",
    category: "earthmoving",
    ownership_type: "owned",
    make: "Caterpillar",
    model: "320D",
    year_of_manufacture: 2022,
    serial_or_vin: "CAT0320DKTY12345",
    registration_plate: "DXB-98124",
    status: "active",
    current_meter_hours: 1450,
    daily_rate: 1800,
    created_at: "2026-10-18T00:00:00Z",
  },
];

const ALLOCATIONS = [
  {
    id: "alloc-1",
    allocation_number: "ALC-2026-001",
    equipment_id: "eq-1",
    project_id: "proj-101",
    mobilization_date: "2026-10-18",
    expected_demobilization_date: "2026-12-31",
    actual_demobilization_date: null,
    grid_location: "Grid A3 - Deep Foundation Pit",
    status: "approved",
    requested_by: "operations.manager@example.com",
    notes: "Main excavation mobilization",
    created_at: "2026-10-18T07:00:00Z",
  },
];

const DAILY_LOGS = [
  {
    id: "log-1",
    equipment_id: "eq-1",
    project_id: "proj-101",
    log_date: "2026-10-18",
    operating_hours: 8,
    idle_hours: 1,
    breakdown_hours: 0,
    start_meter_reading: 1442,
    end_meter_reading: 1450,
    fuel_added_litres: 120,
    operator_name: "Tariq Mahmood",
    work_description: "Pit digging and loading tippers",
    created_at: "2026-10-18T18:00:00Z",
  },
];

const MAINTENANCE = [
  {
    id: "maint-1",
    equipment_id: "eq-1",
    maintenance_type: "preventive",
    maintenance_date: "2026-10-15",
    meter_hours_at_service: 1400,
    performed_by: "Engineer Ziad",
    cost: 3200,
    description: "500hr engine oil & hydraulic filter replacement",
    status: "completed",
    created_at: "2026-10-15T12:00:00Z",
  },
];

const CERTIFICATES = [
  {
    id: "cert-1",
    equipment_id: "eq-1",
    certificate_number: "EIAC-2026-9912",
    certificate_type: "statutory_calibration",
    issuing_authority: "DAC / EIAC Accredited Body",
    issue_date: "2026-01-10",
    expiry_date: "2027-01-09",
    status: "valid",
    created_at: "2026-01-10T09:00:00Z",
  },
];

describe("EquipmentPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/projects") return { projects: PROJECTS };
      if (path.includes("/authority/effective-permissions") || path.includes("/authority/my-permissions")) {
        return {
          permissions: [
            "equipment.asset.manage",
            "equipment.allocation.manage",
            "equipment.allocation.approve",
            "equipment.log.manage",
            "equipment.maintenance.manage",
            "equipment.certificate.manage",
          ],
        };
      }
      if (path.includes("/equipment/assets")) return { assets: ASSETS };
      if (path.includes("/equipment/allocations")) return { allocations: ALLOCATIONS };
      if (path.includes("/equipment/daily-logs")) return { logs: DAILY_LOGS };
      if (path.includes("/equipment/maintenance")) return { records: MAINTENANCE };
      if (path.includes("/equipment/certificates")) return { certificates: CERTIFICATES };
      return {};
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <PermissionsProvider>
          <EquipmentPage />
        </PermissionsProvider>
      </MemoryRouter>
    );

  it("renders equipment page header and master register by default", async () => {
    renderComponent();

    expect(await screen.findByText("Equipment, Plant & Fleet Operations")).toBeInTheDocument();
    expect(await screen.findByText("EQ-CAT-320D")).toBeInTheDocument();
    expect(screen.getByText("CAT 320D Hydraulic Excavator")).toBeInTheDocument();
    expect(screen.getByText("earthmoving")).toBeInTheDocument();
    expect(screen.getByText("OWNED")).toBeInTheDocument();
    expect(screen.getByText(/1450\s*hrs/i)).toBeInTheDocument();
  });

  it("switches to Mobilizations & Allocations tab and renders allocations", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Equipment, Plant & Fleet Operations");
    const allocTab = screen.getByRole("button", { name: /Mobilizations & Allocations/i });
    await user.click(allocTab);

    expect(await screen.findByText("Grid A3 - Deep Foundation Pit")).toBeInTheDocument();
    expect(screen.getByText("ALC-2026-001")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("switches to Daily Utilization tab and displays operating hours & fuel", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Equipment, Plant & Fleet Operations");
    const logsTab = screen.getByRole("button", { name: /Daily Utilization & Run Hours/i });
    await user.click(logsTab);

    expect(await screen.findByText("Pit digging and loading tippers")).toBeInTheDocument();
    expect(screen.getByText("8 hrs")).toBeInTheDocument();
    expect(screen.getByText("120 L")).toBeInTheDocument();
    expect(screen.getByText("Tariq Mahmood")).toBeInTheDocument();
  });

  it("switches to Maintenance & Statutory Certs tab and renders calibration info", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("Equipment, Plant & Fleet Operations");
    const maintTab = screen.getByRole("button", { name: /Maintenance & Statutory Certs/i });
    await user.click(maintTab);

    expect(await screen.findByText("EIAC-2026-9912")).toBeInTheDocument();
    expect(screen.getByText("DAC / EIAC Accredited Body")).toBeInTheDocument();
    expect(screen.getByText("500hr engine oil & hydraulic filter replacement")).toBeInTheDocument();
    expect(screen.getByText("Engineer Ziad")).toBeInTheDocument();
  });

  it("opens asset registration modal when clicking '+ Register New Equipment'", async () => {
    const user = userEvent.setup();
    renderComponent();

    const regBtn = await screen.findByRole("button", { name: /\+ Register New Equipment/i });
    await user.click(regBtn);

    expect(await screen.findByText("Register New Equipment Asset")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Komatsu PC210 Hydraulic Excavator")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Komatsu")).toBeInTheDocument();
  });

  it("opens equipment details drawer when clicking View Details", async () => {
    const user = userEvent.setup();
    renderComponent();

    const viewBtn = await screen.findByRole("button", { name: /View Details/i });
    await user.click(viewBtn);

    expect(await screen.findByRole("button", { name: "Close Drawer" })).toBeInTheDocument();
    expect(screen.getAllByText("CAT 320D Hydraulic Excavator").length).toBeGreaterThan(0);
    expect(screen.getByText("CAT0320DKTY12345")).toBeInTheDocument();
  });
});
