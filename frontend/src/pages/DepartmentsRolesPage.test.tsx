import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DepartmentsRolesPage } from "./DepartmentsRolesPage";

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

describe("DepartmentsRolesPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path === "/authority/roles") {
        return Promise.resolve({ roles: [{ id: "role.storekeeper", label: "Storekeeper", is_platform_role: false }] });
      }
      if (path === "/authority/role-assignments" && !init) {
        return Promise.resolve({ roleAssignments: [] });
      }
      if (path.startsWith("/authority/departments?companyId=")) {
        return Promise.resolve({ departments: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({
          permissions: ["authority.department.manage", "authority.role_assignment.manage"],
        });
      }
      if (path === "/authority/departments" && init?.method === "POST") {
        return Promise.resolve({ department: { id: "d1", company_id: "c1", name: "Engineering", parent_id: null } });
      }
      if (path === "/authority/role-assignments" && init?.method === "POST") {
        return Promise.resolve({
          roleAssignment: { id: "ra1", user_id: "u1", role_id: "role.storekeeper", department_id: null },
        });
      }
      return Promise.resolve({});
    });
  });

  it("creates a department and shows it in the list", async () => {
    render(<DepartmentsRolesPage />);
    await waitFor(() => expect(screen.getByText("Acme Construction")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText("Department name"), "Engineering");
    await userEvent.click(screen.getByRole("button", { name: /add department/i }));

    expect(await screen.findByText("Engineering", { selector: "li" })).toBeInTheDocument();
  });

  it("creates a role assignment by picking a role from the fetched list", async () => {
    render(<DepartmentsRolesPage />);
    await waitFor(() => expect(screen.getByText("Acme Construction")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText("User id"), "u1");
    await userEvent.selectOptions(screen.getByDisplayValue("Select a role…"), "role.storekeeper");
    await userEvent.click(screen.getByRole("button", { name: /assign role/i }));

    expect(await screen.findByText(/user u1 → role Storekeeper/)).toBeInTheDocument();
  });
});
