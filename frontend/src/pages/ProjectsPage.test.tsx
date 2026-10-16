import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProjectsPage } from "./ProjectsPage";

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

const PROJECTS = [
  {
    id: "p1",
    name: "Marina Tower",
    code: "PRJ-001",
    status: "active",
    client_name: "Al Futtaim",
    location: "Dubai Marina",
    contract_value: 5000000,
    contract_currency: "AED",
  },
];

const COMPANIES = [{ id: "c1", legal_name: "Acme Construction" }];

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/projects" && !init) return Promise.resolve({ projects: PROJECTS });
    if (path === "/tenancy/companies") return Promise.resolve({ companies: COMPANIES });
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions: ["tenancy.project.manage"] });
    }
    if (path === "/admin/users") {
      return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
    }
    return Promise.resolve({});
  });
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists projects with client, location and contract value", async () => {
    render(<ProjectsPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Marina Tower")).toBeInTheDocument();
    expect(screen.getByText("Al Futtaim")).toBeInTheDocument();
    expect(screen.getByText("Dubai Marina")).toBeInTheDocument();
    expect(screen.getByText("5,000,000 AED")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows an empty state when there are no projects", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/projects") return Promise.resolve({ projects: [] });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: [] });
      return Promise.resolve({});
    });
    render(<ProjectsPage />, { wrapper: MemoryRouter });
    expect(await screen.findByText("No projects yet.")).toBeInTheDocument();
  });

  it("creates a project through the form", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/projects" && init?.method === "POST") {
        return Promise.resolve({ project: { ...PROJECTS[0], id: "p2", name: "New Tower" } });
      }
      if (path === "/projects") return Promise.resolve({ projects: PROJECTS });
      if (path === "/tenancy/companies") return Promise.resolve({ companies: COMPANIES });
      if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["tenancy.project.manage"] });
      if (path === "/admin/users") {
        return Promise.resolve({ users: [{ id: "u1", email: "u1@sevents.test", display_name: "Uma One" }] });
      }
      return Promise.resolve({});
    });

    render(<ProjectsPage />, { wrapper: MemoryRouter });
    await userEvent.click(await screen.findByRole("button", { name: /new project/i }));

    await userEvent.selectOptions(screen.getByRole("combobox"), "c1");
    await userEvent.type(screen.getByPlaceholderText("Project name"), "New Tower");
    await userEvent.type(screen.getByPlaceholderText("Project code"), "PRJ-002");

    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/projects",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            companyId: "c1",
            name: "New Tower",
            code: "PRJ-002",
            baselineStartDate: undefined,
            baselineEndDate: undefined,
            projectManagerId: undefined,
          }),
        }),
      ),
    );
  });
});
