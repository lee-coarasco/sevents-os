import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WorkflowDefinitionsPage } from "./WorkflowDefinitionsPage";

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

const definition = {
  id: "d1",
  key: "material_request",
  name: "Material Request",
  description: "PO approval flow",
  capability_key: null,
  status: "published",
  current_version: 2,
  created_by: null,
  updated_by: null,
};

function mockResponses(options: { permissions?: string[] } = {}) {
  const permissions = options.permissions ?? ["workflow.definition.manage"];
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions });
    if (path.startsWith("/workflow/definitions") && (!init || init.method === undefined)) {
      return Promise.resolve({ definitions: [definition] });
    }
    if (path === "/workflow/definitions" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({ definition: { ...definition, ...body, id: "d2", status: "draft", current_version: null } });
    }
    return Promise.resolve({});
  });
}

describe("WorkflowDefinitionsPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("lists workflow definitions with name, key and status", async () => {
    mockResponses();
    render(
      <MemoryRouter>
        <WorkflowDefinitionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Material Request")).toBeInTheDocument();
    expect(screen.getByText("material_request")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("hides the New Definition button without workflow.definition.manage", async () => {
    mockResponses({ permissions: [] });
    render(
      <MemoryRouter>
        <WorkflowDefinitionsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Material Request");
    expect(screen.queryByText("New Definition")).not.toBeInTheDocument();
  });

  it("creates a new definition and refreshes the list", async () => {
    mockResponses();
    render(
      <MemoryRouter>
        <WorkflowDefinitionsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Material Request");

    await userEvent.click(screen.getByText("New Definition"));
    await userEvent.type(screen.getByPlaceholderText("Key (e.g. material_request)"), "site_issue");
    await userEvent.type(screen.getByPlaceholderText("Name"), "Site Issue");
    await userEvent.click(screen.getByText("Create"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/workflow/definitions",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
