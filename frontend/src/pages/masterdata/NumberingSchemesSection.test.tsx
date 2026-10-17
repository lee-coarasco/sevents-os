import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberingSchemesSection } from "./NumberingSchemesSection";

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

const poScheme = { id: "ns-1", entity_type: "po", prefix: "PO-", suffix: "", next_sequence: 42, padding: 4, is_active: true };

function mockResponses() {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["master-data.manage"] });
    if (path === "/master-data/numbering-schemes" && (!init || init.method === undefined)) {
      return Promise.resolve({ numberingSchemes: [poScheme] });
    }
    if (path === "/master-data/numbering-schemes/ns-1/preview") {
      return Promise.resolve({ formatted: "PO-0042" });
    }
    if (path === "/master-data/numbering-schemes" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({
        numberingScheme: { id: "ns-new", next_sequence: 1, is_active: true, suffix: "", ...body },
      });
    }
    if (path === "/master-data/numbering-schemes/ns-1" && init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({ numberingScheme: { ...poScheme, ...body } });
    }
    return Promise.resolve({});
  });
}

describe("NumberingSchemesSection", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("lists schemes with the previewed next number", async () => {
    render(<NumberingSchemesSection />);
    expect(await screen.findByText("po")).toBeInTheDocument();
    expect(await screen.findByText("PO-0042")).toBeInTheDocument();
  });

  it("creates a new numbering scheme", async () => {
    render(<NumberingSchemesSection />);
    await screen.findByText("po");

    await userEvent.type(screen.getByPlaceholderText("e.g. project, document, po, invoice"), "invoice");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/numbering-schemes",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("archives a scheme", async () => {
    render(<NumberingSchemesSection />);
    await screen.findByText("po");

    await userEvent.click(await screen.findByText("Archive"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/numbering-schemes/ns-1",
        "test-token",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_active: false }) }),
      ),
    );
  });
});
