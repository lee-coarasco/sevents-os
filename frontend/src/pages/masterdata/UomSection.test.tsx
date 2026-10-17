import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UomSection } from "./UomSection";

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

const activeUom = { id: "uom-1", code: "m²", description: "Square metre", is_active: true };
const archivedUom = { id: "uom-2", code: "ls", description: "Lump sum", is_active: false };

function mockResponses(options: { permissions?: string[]; items?: unknown[] } = {}) {
  const permissions = options.permissions ?? ["master-data.manage"];
  const items = options.items ?? [activeUom, archivedUom];
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions });
    if (path === "/master-data/uom" && (!init || init.method === undefined)) {
      return Promise.resolve({ uom: items });
    }
    if (path === "/master-data/uom" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({ uom: { id: "uom-new", is_active: true, ...body } });
    }
    if (path.match(/\/master-data\/uom\/.+\/archive/) && init?.method === "POST") {
      const id = path.split("/")[3];
      return Promise.resolve({ uom: { ...(items as any[]).find((i) => i.id === id), is_active: false } });
    }
    if (path.startsWith("/master-data/uom/") && init?.method === "PATCH") {
      const id = path.split("/").pop();
      const body = JSON.parse(init.body as string);
      const existing = (items as any[]).find((i) => i.id === id) ?? {};
      return Promise.resolve({ uom: { ...existing, ...body } });
    }
    return Promise.resolve({});
  });
}

describe("UomSection", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("lists active units and hides archived ones by default", async () => {
    render(<UomSection />);
    expect(await screen.findByText("m²")).toBeInTheDocument();
    expect(screen.queryByText("ls")).not.toBeInTheDocument();
  });

  it("shows archived units when 'Show archived' is checked", async () => {
    render(<UomSection />);
    await screen.findByText("m²");
    await userEvent.click(screen.getByLabelText("Show archived"));
    expect(await screen.findByText("ls")).toBeInTheDocument();
  });

  it("creates a new unit of measure", async () => {
    render(<UomSection />);
    await screen.findByText("m²");

    await userEvent.type(screen.getByPlaceholderText("e.g. m², kg, nr"), "kg");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/uom",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("archives an active unit", async () => {
    render(<UomSection />);
    await screen.findByText("m²");

    await userEvent.click(await screen.findByText("Archive"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/uom/uom-1/archive",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("restores an archived unit", async () => {
    render(<UomSection />);
    await screen.findByText("m²");
    await userEvent.click(screen.getByLabelText("Show archived"));
    await screen.findByText("ls");

    await userEvent.click(await screen.findByText("Restore"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/uom/uom-2",
        "test-token",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_active: true }) }),
      ),
    );
  });

  it("hides write actions and the add form without master-data.manage", async () => {
    mockResponses({ permissions: [] });
    render(<UomSection />);

    await screen.findByText("m²");
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
  });
});
