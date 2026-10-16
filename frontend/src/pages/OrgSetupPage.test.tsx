import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgSetupPage } from "./OrgSetupPage";

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
    if (path === "/projects") {
      return Promise.resolve({ projects: [] });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({
        permissions: ["tenancy.branch.manage", "tenancy.project.manage"],
      });
    }
    return Promise.resolve({});
  });
}

describe("OrgSetupPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists companies and selecting one reveals branch/project sections", async () => {
    render(<OrgSetupPage />);

    await waitFor(() => expect(screen.getByText("Acme Construction")).toBeInTheDocument());
    expect(screen.queryByText(/Branches —/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Acme Construction"));

    expect(await screen.findByText("Branches — Acme Construction")).toBeInTheDocument();
    expect(screen.getByText("Projects — Acme Construction")).toBeInTheDocument();
  });

  it("hides the create-company form when the user lacks tenancy.company.manage", async () => {
    render(<OrgSetupPage />);
    await waitFor(() => expect(screen.getByText("Acme Construction")).toBeInTheDocument());
    expect(screen.getByText("You don't have permission to create companies.")).toBeInTheDocument();
  });

  it("creates a branch and shows it in the session list", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path === "/projects") {
        return Promise.resolve({ projects: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["tenancy.branch.manage"] });
      }
      if (path === "/tenancy/branches" && init?.method === "POST") {
        return Promise.resolve({ branch: { id: "b1", company_id: "c1", name: "Dubai HQ", operating_region: null } });
      }
      return Promise.resolve({});
    });

    render(<OrgSetupPage />);
    await userEvent.click(await screen.findByText("Acme Construction"));
    await userEvent.type(screen.getByPlaceholderText("Branch name"), "Dubai HQ");
    await userEvent.click(screen.getByRole("button", { name: /add branch/i }));

    expect(await screen.findByText("Dubai HQ")).toBeInTheDocument();
  });
});
