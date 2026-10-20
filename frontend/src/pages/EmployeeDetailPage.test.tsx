import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EmployeeDetailPage } from "./EmployeeDetailPage";

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

const mockSession = { access_token: "test-token", user: { email: "hr@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({
    has: (permission: string) => permission === "employee.directory.manage",
    loading: false,
    permissions: ["employee.directory.manage"],
  }),
}));

const EMPLOYEE = {
  id: "emp-1",
  company_id: "comp-1",
  employee_code: "EMP-001",
  full_name: "Rahul Sharma",
  department_id: "dept-1",
  reporting_role_id: null,
  employment_status: "active",
  app_user_id: "u1",
  emergency_contact_name: "Anita Sharma",
  emergency_contact_phone: "+91 9999999999",
  onboarded_at: "2026-01-15T00:00:00Z",
};

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/employees/emp-1" && (!init || !init.method || init.method === "GET")) {
      return Promise.resolve({ employee: EMPLOYEE });
    }
    if (path === "/tenancy/companies") {
      return Promise.resolve({ companies: [{ id: "comp-1", legal_name: "Apex Horizon Pvt Ltd" }] });
    }
    if (path === "/authority/departments?companyId=comp-1") {
      return Promise.resolve({ departments: [{ id: "dept-1", name: "Civil Engineering" }] });
    }
    if (path === "/employees/emp-1/project-allocations" && (!init || !init.method || init.method === "GET")) {
      return Promise.resolve({
        allocations: [
          {
            id: "alloc-1",
            employee_id: "emp-1",
            project_id: "proj-1",
            site_assignment: "Tower A",
            valid_from: "2026-02-01T00:00:00Z",
            valid_to: null,
          },
        ],
      });
    }
    if (path === "/projects") {
      return Promise.resolve({ projects: [{ id: "proj-1", name: "Metro Line 3", code: "PRJ-M3" }] });
    }
    if (path === "/admin/users") {
      return Promise.resolve({ users: [{ id: "u1", email: "rahul@example.com", display_name: "Rahul Sharma" }] });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions: ["employee.directory.manage"] });
    }
    return Promise.resolve({});
  });
}

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={["/employees/emp-1"]}>
      <Routes>
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("EmployeeDetailPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("renders employee header and profile information", async () => {
    renderComponent();
    expect(await screen.findByRole("heading", { name: "Rahul Sharma" })).toBeInTheDocument();
    expect(screen.getByText("EMP-001")).toBeInTheDocument();
    expect(screen.getAllByText("Civil Engineering")[0]).toBeInTheDocument();
    expect(screen.getByText(/Apex Horizon Pvt Ltd/)).toBeInTheDocument();
  });

  it("edits employee profile and sends PATCH request", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/employees/emp-1" && init?.method === "PATCH") {
        return Promise.resolve({ employee: { ...EMPLOYEE, full_name: "Rahul S. Sharma" } });
      }
      if (path === "/employees/emp-1") return Promise.resolve({ employee: EMPLOYEE });
      if (path === "/tenancy/companies") return Promise.resolve({ companies: [] });
      if (path === "/authority/departments?companyId=comp-1") return Promise.resolve({ departments: [] });
      if (path === "/employees/emp-1/project-allocations") return Promise.resolve({ allocations: [] });
      if (path === "/projects") return Promise.resolve({ projects: [] });
      if (path === "/admin/users") return Promise.resolve({ users: [] });
      return Promise.resolve({});
    });

    renderComponent();
    const nameInput = await screen.findByDisplayValue("Rahul Sharma");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Rahul S. Sharma");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/employees/emp-1",
        "test-token",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"fullName":"Rahul S. Sharma"'),
        })
      );
    });
  });

  it("adds a skill in the skills tab", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/employees/emp-1/skills" && init?.method === "POST") {
        return Promise.resolve({ employeeSkill: { id: "skill-1" } });
      }
      if (path === "/employees/emp-1") return Promise.resolve({ employee: EMPLOYEE });
      if (path === "/tenancy/companies") return Promise.resolve({ companies: [] });
      if (path === "/authority/departments?companyId=comp-1") return Promise.resolve({ departments: [] });
      if (path === "/employees/emp-1/project-allocations") return Promise.resolve({ allocations: [] });
      if (path === "/projects") return Promise.resolve({ projects: [] });
      if (path === "/admin/users") return Promise.resolve({ users: [] });
      return Promise.resolve({});
    });

    renderComponent();
    await screen.findByRole("heading", { name: "Rahul Sharma" });

    await userEvent.click(screen.getByRole("button", { name: /skills & certifications/i }));
    expect(await screen.findByRole("heading", { name: /competencies & skills/i })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/skill name/i), "Structural Analysis");
    await userEvent.type(screen.getByPlaceholderText(/proficiency/i), "Advanced");
    await userEvent.click(screen.getByRole("button", { name: /add skill/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/employees/emp-1/skills",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ skillName: "Structural Analysis", proficiencyNote: "Advanced" }),
        })
      );
    });
    expect(await screen.findByText("Structural Analysis")).toBeInTheDocument();
  });

  it("logs a training record in the training tab", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/employees/emp-1/training" && init?.method === "POST") {
        return Promise.resolve({ trainingRecord: { id: "tr-1" } });
      }
      if (path === "/employees/emp-1") return Promise.resolve({ employee: EMPLOYEE });
      if (path === "/tenancy/companies") return Promise.resolve({ companies: [] });
      if (path === "/authority/departments?companyId=comp-1") return Promise.resolve({ departments: [] });
      if (path === "/employees/emp-1/project-allocations") return Promise.resolve({ allocations: [] });
      if (path === "/projects") return Promise.resolve({ projects: [] });
      if (path === "/admin/users") return Promise.resolve({ users: [] });
      return Promise.resolve({});
    });

    renderComponent();
    await screen.findByRole("heading", { name: "Rahul Sharma" });

    await userEvent.click(screen.getByRole("button", { name: /training records/i }));
    expect(await screen.findByRole("heading", { name: /training history/i })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/course name/i), "Heavy Machinery Safety");
    await userEvent.type(screen.getByPlaceholderText(/result/i), "Pass");
    // completedAt is type="date"
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) await userEvent.type(dateInput, "2026-03-10");

    await userEvent.click(screen.getByRole("button", { name: /log training/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/employees/emp-1/training",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ courseName: "Heavy Machinery Safety", completedAt: "2026-03-10", result: "Pass" }),
        })
      );
    });
  });

  it("deactivates the employee", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/employees/emp-1/deactivate" && init?.method === "POST") {
        return Promise.resolve({ employee: { ...EMPLOYEE, employment_status: "offboarded" } });
      }
      if (path === "/employees/emp-1") return Promise.resolve({ employee: EMPLOYEE });
      if (path === "/tenancy/companies") return Promise.resolve({ companies: [] });
      if (path === "/authority/departments?companyId=comp-1") return Promise.resolve({ departments: [] });
      if (path === "/employees/emp-1/project-allocations") return Promise.resolve({ allocations: [] });
      if (path === "/projects") return Promise.resolve({ projects: [] });
      if (path === "/admin/users") return Promise.resolve({ users: [] });
      return Promise.resolve({});
    });

    renderComponent();
    await screen.findByRole("heading", { name: "Rahul Sharma" });

    await userEvent.click(screen.getByRole("button", { name: /offboard \/ deactivate/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/employees/emp-1/deactivate",
        "test-token",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText(/employee has been deactivated/i)).toBeInTheDocument();
  });
});
