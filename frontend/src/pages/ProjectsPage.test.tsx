import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("ProjectsPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("lists projects with client, location and contract value", async () => {
    apiFetch.mockImplementation((path: string) => (path === "/projects" ? Promise.resolve({ projects: PROJECTS }) : Promise.resolve({})));

    render(<ProjectsPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText("Marina Tower")).toBeInTheDocument();
    expect(screen.getByText("Al Futtaim")).toBeInTheDocument();
    expect(screen.getByText("Dubai Marina")).toBeInTheDocument();
    expect(screen.getByText("5,000,000 AED")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows an empty state when there are no projects", async () => {
    apiFetch.mockImplementation((path: string) => (path === "/projects" ? Promise.resolve({ projects: [] }) : Promise.resolve({})));

    render(<ProjectsPage />, { wrapper: MemoryRouter });
    expect(await screen.findByText("No projects yet.")).toBeInTheDocument();
  });
});
