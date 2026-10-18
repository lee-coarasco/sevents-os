import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RolePermissionsMatrix } from "./RolePermissionsMatrix";

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

const mockSession = { access_token: "test-token", user: { email: "admin@example.com" } };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: ["authority.role.manage"],
    loading: false,
    has: (p: string) => p === "authority.role.manage",
  }),
}));

const mockRoles = [
  { id: "role.admin", label: "Admin", is_platform_role: true, department_cluster: null },
  { id: "role.supervisor", label: "Site Supervisor", is_platform_role: false, department_cluster: "Operations" },
];

const mockAllPermissions = [
  { id: "authority.role.manage", description: "Manage roles and permissions" },
  { id: "workflow.manage", description: "Manage workflows" },
  { id: "task.create", description: "Create tasks" },
];

describe("RolePermissionsMatrix", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/authority/permissions") {
        return Promise.resolve({ permissions: mockAllPermissions });
      }
      if (path === "/authority/roles/role.admin/permissions") {
        return Promise.resolve({ permissions: ["authority.role.manage", "workflow.manage"] });
      }
      if (path === "/authority/roles/role.supervisor/permissions") {
        return Promise.resolve({ permissions: ["task.create"] });
      }
      if (path.startsWith("/authority/roles/") && init?.method === "PUT") {
        const body = JSON.parse(init.body as string);
        return Promise.resolve({ success: true, permissions: body.permissionIds });
      }
      return Promise.resolve({});
    });
  });

  it("renders the matrix with system permissions and pre-selects assigned permissions", async () => {
    render(<RolePermissionsMatrix roles={mockRoles} />);

    expect(await screen.findByText("Dynamic Role Permissions Matrix")).toBeInTheDocument();
    expect(await screen.findByText("authority.role.manage")).toBeInTheDocument();
    expect(screen.getByText("workflow.manage")).toBeInTheDocument();
    expect(screen.getByText("task.create")).toBeInTheDocument();

    // In role.admin, authority.role.manage should be checked, task.create should not
    const authorityCheckbox = screen.getByLabelText(/authority\.role\.manage/i);
    expect(authorityCheckbox).toBeChecked();

    const taskCheckbox = screen.getByLabelText(/task\.create/i);
    expect(taskCheckbox).not.toBeChecked();
  });

  it("switches permissions when a different role is selected", async () => {
    render(<RolePermissionsMatrix roles={mockRoles} />);

    await screen.findByText("Dynamic Role Permissions Matrix");

    // Select role.supervisor
    const roleSelect = screen.getByLabelText(/Selected Role:/i);
    await userEvent.selectOptions(roleSelect, "role.supervisor");

    await waitFor(() => {
      const taskCheckbox = screen.getByLabelText(/task\.create/i);
      expect(taskCheckbox).toBeChecked();
      const workflowCheckbox = screen.getByLabelText(/workflow\.manage/i);
      expect(workflowCheckbox).not.toBeChecked();
    });
  });

  it("toggles permission checkbox and enables save button", async () => {
    render(<RolePermissionsMatrix roles={mockRoles} />);

    await screen.findByText("Dynamic Role Permissions Matrix");
    const taskCheckbox = await screen.findByLabelText(/task\.create/i);
    expect(taskCheckbox).not.toBeChecked();

    await userEvent.click(taskCheckbox);
    expect(taskCheckbox).toBeChecked();

    const saveButton = screen.getByRole("button", { name: /Save Changes \*/i });
    expect(saveButton).toBeEnabled();

    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Permissions updated successfully/i)).toBeInTheDocument();
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/authority/roles/role.admin/permissions",
      "test-token",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining("task.create"),
      }),
    );
  });

  it("filters permissions by search query", async () => {
    render(<RolePermissionsMatrix roles={mockRoles} />);

    await screen.findByText("Dynamic Role Permissions Matrix");
    const searchInput = screen.getByPlaceholderText(/Search permissions…/i);

    await userEvent.type(searchInput, "workflow");

    expect(screen.getByText("workflow.manage")).toBeInTheDocument();
    expect(screen.queryByText("task.create")).not.toBeInTheDocument();
  });
});
