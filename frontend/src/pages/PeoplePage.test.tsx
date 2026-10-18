import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PeoplePage } from "./PeoplePage";
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

const mockSession = { access_token: "test-token", user: { id: "user-1", email: "hr@sevents.ae" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const MANPOWER_REQUESTS = [
  {
    id: "mpr-1",
    project_id: "proj-skyline",
    request_number: "MPR-2026-SITE-01",
    role_title: "Senior QA/QC Inspector",
    quantity_required: 4,
    skill_level: "senior",
    required_date: "2026-11-15",
    status: "approved",
    notes: "Site QA lead",
    created_at: "2026-10-01T00:00:00Z",
  },
];

const CANDIDATES = [
  {
    id: "cand-1",
    manpower_request_id: "mpr-1",
    candidate_name: "Salim Al-Khatib",
    email: "salim@example.com",
    phone: "+971 55 123 4567",
    position_applied: "Senior QA/QC Inspector",
    current_company: "Al Naboodah Construction",
    years_experience: 9,
    stage: "interview",
    rating: 5,
    notes: "Strong candidate",
    created_at: "2026-10-05T00:00:00Z",
  },
];

const COMPETENCIES = [
  {
    id: "comp-1",
    employee_name: "Ramesh Kumar",
    trade: "scaffolder",
    certification_name: "Working at Height Level 3",
    certifying_body: "PASMA / IPAF",
    issue_date: "2025-01-01",
    expiry_date: "2027-01-01",
    status: "valid",
    notes: "Site certified",
    created_at: "2025-01-01T00:00:00Z",
  },
];

const APPRAISALS = [
  {
    id: "appr-1",
    employee_name: "Fatima Al-Nuaimi",
    review_period: "2026-H1",
    appraiser_name: "Operations Director",
    score: 4.8,
    strengths: "Outstanding site leadership",
    growth_areas: "BIM integration",
    goals: "Deliver Level 15 on target",
    status: "completed",
    created_at: "2026-06-30T00:00:00Z",
  },
];

describe("M24: People, Recruitment & Performance Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === "/authority/effective-permissions") {
        return {
          permissions: [
            "people.manpower.manage",
            "people.manpower.approve",
            "people.recruitment.manage",
            "people.competency.manage",
            "people.appraisal.manage",
          ],
        };
      }
      if (path.startsWith("/people/manpower-requests")) {
        return { requests: MANPOWER_REQUESTS };
      }
      if (path.startsWith("/people/candidates")) {
        return { candidates: CANDIDATES };
      }
      if (path.startsWith("/people/competencies")) {
        return { competencies: COMPETENCIES };
      }
      if (path.startsWith("/people/appraisals")) {
        return { appraisals: APPRAISALS };
      }
      return {};
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PermissionsProvider>
          <PeoplePage />
        </PermissionsProvider>
      </MemoryRouter>
    );
  };

  it("renders page header, KPI cards, and manpower requisitions table", async () => {
    renderComponent();

    expect(await screen.findByText(/People, Recruitment & Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Manpower Demanded/i)).toBeInTheDocument();
    expect(screen.getByText("4 workers")).toBeInTheDocument();
    expect(screen.getByText("MPR-2026-SITE-01")).toBeInTheDocument();
    expect(screen.getByText("Senior QA/QC Inspector")).toBeInTheDocument();
  });

  it("switches to Recruitment tab and displays candidate pipeline details", async () => {
    const user = userEvent.setup();
    renderComponent();

    const recruitmentTab = await screen.findByRole("button", { name: /Recruitment Pipeline/i });
    await user.click(recruitmentTab);

    expect(await screen.findByText("Salim Al-Khatib")).toBeInTheDocument();
    expect(screen.getByText("Al Naboodah Construction")).toBeInTheDocument();
    expect(screen.getByText("9 yrs")).toBeInTheDocument();
  });

  it("switches to Competency tab and displays site certification details", async () => {
    const user = userEvent.setup();
    renderComponent();

    const competencyTab = await screen.findByRole("button", { name: /Site Competency Matrix/i });
    await user.click(competencyTab);

    expect(await screen.findByText("Ramesh Kumar")).toBeInTheDocument();
    expect(screen.getByText("Working at Height Level 3")).toBeInTheDocument();
    expect(screen.getByText("PASMA / IPAF")).toBeInTheDocument();
    expect(screen.getByText("scaffolder")).toBeInTheDocument();
  });

  it("switches to Appraisals tab and displays performance review records", async () => {
    const user = userEvent.setup();
    renderComponent();

    const appraisalsTab = await screen.findByRole("button", { name: /Performance Appraisals/i });
    await user.click(appraisalsTab);

    expect(await screen.findByText("Fatima Al-Nuaimi")).toBeInTheDocument();
    expect(screen.getByText("2026-H1")).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("Operations Director")).toBeInTheDocument();
  });

  it("opens Request Manpower modal when clicking action button", async () => {
    const user = userEvent.setup();
    renderComponent();

    const requestBtn = await screen.findByRole("button", { name: /\+ Request Manpower/i });
    await user.click(requestBtn);

    expect(screen.getByRole("heading", { name: /Request Manpower Mobilization/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/MPR-2026-SITE-01/i)).toBeInTheDocument();
  });
});
