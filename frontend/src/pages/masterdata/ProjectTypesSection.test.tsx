import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectTypesSection } from "./ProjectTypesSection";

const apiFetch = vi.fn();

vi.mock("../../lib/api", () => ({
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

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}));

const commercial = { id: "pt-1", name: "Commercial", code: "COM", is_active: true };

function mockResponses() {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions: ["tenancy.project.manage"] });
    }
    if (path === "/project-types" && (!init || init.method === undefined)) {
      return Promise.resolve({ projectTypes: [commercial] });
    }
    if (path === "/project-types" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({ projectType: { id: "pt-new", is_active: true, ...body } });
    }
    if (path === "/project-types/pt-1/archive" && init?.method === "POST") {
      return Promise.resolve({ projectType: { ...commercial, is_active: false } });
    }
    return Promise.resolve({});
  });
}

describe("ProjectTypesSection", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("lists project types", async () => {
    render(<ProjectTypesSection />);
    expect(await screen.findByText("Commercial")).toBeInTheDocument();
  });

  it("creates a new project type", async () => {
    render(<ProjectTypesSection />);
    await screen.findByText("Commercial");

    await userEvent.type(screen.getByPlaceholderText("e.g. Commercial, Residential, Civil, Fit-out"), "Residential");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/project-types",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("archives a project type", async () => {
    render(<ProjectTypesSection />);
    await screen.findByText("Commercial");

    await userEvent.click(await screen.findByText("Archive"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/project-types/pt-1/archive",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
