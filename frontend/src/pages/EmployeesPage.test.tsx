import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeesPage } from "./EmployeesPage";

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

const mockSession = { access_token: "test-token", user: { email: "owner@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/tenancy/companies") {
      return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
    }
    if (path.startsWith("/authority/departments")) {
      return Promise.resolve({ departments: [{ id: "d1", company_id: "c1", name: "Civil" }] });
    }
    if (path.startsWith("/employees?")) {
      return Promise.resolve({
        employees: [
          { id: "e1", company_id: "c1", employee_code: "EMP-1", full_name: "Amir", department_id: "d1", employment_status: "active" },
        ],
      });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions: ["employee.directory.manage"] });
    }
    return Promise.resolve({});
  });
}

describe("EmployeesPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists employees for the selected company with their department and status", async () => {
    render(<EmployeesPage />);

    expect(await screen.findByText("Amir")).toBeInTheDocument();
    expect(screen.getByText("EMP-1")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Civil" })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows an empty state when there are no employees", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path.startsWith("/authority/departments")) {
        return Promise.resolve({ departments: [] });
      }
      if (path.startsWith("/employees?")) {
        return Promise.resolve({ employees: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: [] });
      }
      return Promise.resolve({});
    });

    render(<EmployeesPage />);
    expect(await screen.findByText("No employees yet.")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to add employees.")).toBeInTheDocument();
  });

  it("creates an employee and shows it in the list", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path.startsWith("/authority/departments")) {
        return Promise.resolve({ departments: [{ id: "d1", company_id: "c1", name: "Civil" }] });
      }
      if (path.startsWith("/employees?")) {
        return Promise.resolve({ employees: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["employee.directory.manage"] });
      }
      if (path === "/employees" && init?.method === "POST") {
        return Promise.resolve({
          employee: { id: "e2", company_id: "c1", employee_code: "EMP-2", full_name: "Bea", department_id: null, employment_status: "active" },
        });
      }
      return Promise.resolve({});
    });

    render(<EmployeesPage />);
    await waitFor(() => expect(screen.getByText("No employees yet.")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText("Employee code"), "EMP-2");
    await userEvent.type(screen.getByPlaceholderText("Full name"), "Bea");
    await userEvent.click(screen.getByRole("button", { name: /add employee/i }));

    expect(await screen.findByText("Bea")).toBeInTheDocument();
  });
});
