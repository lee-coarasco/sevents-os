import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CataloguePage } from "./CataloguePage";

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

const activeItem = {
  id: "wi-1",
  disposition: "Configure workflow",
  status: "draft",
  priority: null,
  risk_tier: null,
  phase_target: null,
  capability_key: null,
  workflow_template_id: null,
  current_version: 1,
  work_item_name: "Issue purchase order",
  description: "Raise a PO for approved materials",
  who_is_responsible: "Procurement",
  source_department: "Procurement",
};

const retiredItem = {
  ...activeItem,
  id: "wi-2",
  status: "retired",
  work_item_name: "Legacy fax approval",
  source_department: "Admin",
};

function mockResponses(options: { permissions?: string[]; items?: unknown[] } = {}) {
  const permissions = options.permissions ?? ["catalogue.workitem.manage"];
  const items = options.items ?? [activeItem, retiredItem];
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/workflow/definitions/published") {
      return Promise.resolve({ definitions: [{ id: "wf-1", key: "po-approval", name: "PO Approval", capability_key: null }] });
    }
    if (path.startsWith("/catalogue/work-items") && (!init || init.method === undefined)) {
      return Promise.resolve({ workItems: items });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({ permissions });
    }
    if (path.startsWith("/catalogue/work-items/") && init?.method === "PATCH") {
      const id = path.split("/").pop();
      const body = JSON.parse(init.body as string);
      const existing = items.find((i: any) => i.id === id) ?? {};
      return Promise.resolve({ workItem: { ...existing, ...body } });
    }
    return Promise.resolve({});
  });
}

describe("CataloguePage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("lists active catalogue items and hides retired ones by default", async () => {
    render(<CataloguePage />);

    expect(await screen.findByText("Issue purchase order")).toBeInTheDocument();
    expect(screen.queryByText("Legacy fax approval")).not.toBeInTheDocument();
  });

  it("shows retired items when 'Show archived' is checked", async () => {
    render(<CataloguePage />);
    await screen.findByText("Issue purchase order");

    await userEvent.click(screen.getByLabelText("Show archived"));

    expect(await screen.findByText("Legacy fax approval")).toBeInTheDocument();
  });

  it("re-fetches with the search term", async () => {
    render(<CataloguePage />);
    await screen.findByText("Issue purchase order");

    await userEvent.type(screen.getByPlaceholderText("Search item name or description…"), "purchase");

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("search=purchase"),
        "test-token",
      ),
    );
  });

  it("edits a work item and saves the new disposition", async () => {
    render(<CataloguePage />);
    await screen.findByText("Issue purchase order");

    await userEvent.click(screen.getAllByText("Edit")[0]);
    const dispositionSelect = screen.getByDisplayValue("Configure workflow");
    await userEvent.selectOptions(dispositionSelect, "Track obligation/document");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/catalogue/work-items/wi-1",
        "test-token",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("hides edit/retire actions without catalogue.workitem.manage", async () => {
    mockResponses({ permissions: [] });
    render(<CataloguePage />);

    await screen.findByText("Issue purchase order");
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Retire")).not.toBeInTheDocument();
  });
});
