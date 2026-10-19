import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CommunicationsPage } from "./CommunicationsPage";
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

const mockSession = { access_token: "test-token", user: { id: "user-1", email: "pm@sevents.ae" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const STAKEHOLDERS = [
  {
    id: "sh-1",
    project_id: "proj-1",
    name: "Engr. Tariq Al Mansoori",
    organization: "Apex Master Developers",
    stakeholder_type: "client",
    role_title: "Development Director",
    email: "tariq@apex.com",
    phone: "+971 50 123 4567",
    engagement_level: "high",
    notes: "Primary client signatory",
    created_at: "2026-10-01T00:00:00Z",
  },
];

const LOGS = [
  {
    id: "log-1",
    project_id: "proj-1",
    reference_number: "LTR-2026-0042",
    channel: "letter",
    direction: "outbound",
    sender_name: "Lead Project Manager",
    recipient_name: "Supervising Consultant",
    subject: "Notice of Impending Site Inspection",
    summary: "Formal 48-hour notice per clause 4.2",
    requires_response: true,
    response_due_date: "2026-10-25",
    status: "sent",
    created_at: "2026-10-02T00:00:00Z",
  },
];

const MINUTES = [
  {
    id: "mom-1",
    project_id: "proj-1",
    meeting_title: "Weekly Site Coordination Meeting #18",
    meeting_type: "site_coordination",
    meeting_date: "2026-10-18",
    location: "Site Office Conference Room A",
    attendees: ["John Doe", "Sara Smith"],
    summary: "Reviewed structural steel deliveries and MEP clashes.",
    action_items: [
      {
        id: "act-1",
        task: "Submit revised MEP penetration drawings",
        assignee: "Zack Lee",
        due_date: "2026-10-22",
        status: "pending",
      },
    ],
    status: "published",
    created_at: "2026-10-18T00:00:00Z",
  },
];

const COMPLAINTS = [
  {
    id: "cmp-1",
    project_id: "proj-1",
    complaint_number: "CMP-0001",
    client_name: "Apex Properties Group",
    contact_info: "director@apex.com",
    severity: "critical",
    category: "safety",
    description: "Dust suppression and boundary hoarding issue",
    resolution_plan: null,
    status: "received",
    assigned_to: "HSE Lead",
    resolved_at: null,
    created_at: "2026-10-15T00:00:00Z",
  },
];

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <PermissionsProvider>
        <CommunicationsPage />
      </PermissionsProvider>
    </MemoryRouter>
  );
}

describe("CommunicationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (url: string) => {
      if (url === "/authority/effective-permissions") {
        return {
          permissions: [
            "communications.stakeholder.manage",
            "communications.log.manage",
            "communications.minutes.manage",
            "communications.complaint.manage",
            "communications.complaint.resolve",
          ],
        };
      }
      if (url.includes("/communications/stakeholders")) {
        return { stakeholders: STAKEHOLDERS };
      }
      if (url.includes("/communications/logs")) {
        return { logs: LOGS };
      }
      if (url.includes("/communications/meeting-minutes")) {
        return { minutes: MINUTES };
      }
      if (url.includes("/communications/complaints")) {
        return { complaints: COMPLAINTS };
      }
      return {};
    });
  });

  it("renders the communications header and default Stakeholders tab", async () => {
    renderWithProviders();

    expect(
      screen.getByText("Customer & Stakeholder Communications")
    ).toBeInTheDocument();

    expect(await screen.findByText("Engr. Tariq Al Mansoori")).toBeInTheDocument();
    expect(screen.getByText("Apex Master Developers")).toBeInTheDocument();
    expect(await screen.findByText("+ Add Stakeholder")).toBeInTheDocument();
  });

  it("switches to Communication Logs tab and displays correspondence", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const logsTab = await screen.findByRole("button", { name: /Communication Logs & Notices/i });
    await user.click(logsTab);

    expect(await screen.findByText("LTR-2026-0042")).toBeInTheDocument();
    expect(
      screen.getByText("Notice of Impending Site Inspection")
    ).toBeInTheDocument();
    expect(await screen.findByText("+ Log Correspondence")).toBeInTheDocument();
  });

  it("switches to Meeting Minutes tab and renders action items", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const minutesTab = await screen.findByRole("button", { name: /Meeting Minutes \(MOM\)/i });
    await user.click(minutesTab);

    expect(
      await screen.findByText("Weekly Site Coordination Meeting #18")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Submit revised MEP penetration drawings")
    ).toBeInTheDocument();
    expect(screen.getByText("Assigned to: Zack Lee • Due: 2026-10-22")).toBeInTheDocument();
  });

  it("switches to Client Complaints tab and displays critical grievance", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const complaintsTab = await screen.findByRole("button", { name: /Client Complaints & Escalations/i });
    await user.click(complaintsTab);

    expect(await screen.findByText("CMP-0001")).toBeInTheDocument();
    expect(screen.getByText("Apex Properties Group")).toBeInTheDocument();
    expect(screen.getByText("Critical Escalations")).toBeInTheDocument();
    expect(
      screen.getByText("Dust suppression and boundary hoarding issue")
    ).toBeInTheDocument();
    expect(await screen.findByText("Resolve")).toBeInTheDocument();
  });

  it("opens Add Stakeholder modal when clicking action button", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    const addBtn = await screen.findByText("+ Add Stakeholder");
    await user.click(addBtn);

    expect(screen.getByPlaceholderText("e.g. Engr. Khalid Mansoori")).toBeInTheDocument();
    expect(screen.getByText("Save Stakeholder")).toBeInTheDocument();
  });
});
