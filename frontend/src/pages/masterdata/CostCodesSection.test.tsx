import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostCodesSection } from "./CostCodesSection";
import { ApiError } from "../../lib/api";

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

const parent = { id: "cc-1", parent_id: null, code: "100", description: "Labour", category: "labour", is_active: true };
const child = { id: "cc-2", parent_id: "cc-1", code: "100.1", description: "Site labour", category: "labour", is_active: true };

function mockResponses(options: { archiveFails?: boolean } = {}) {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["master-data.manage"] });
    if (path === "/master-data/cost-codes" && (!init || init.method === undefined)) {
      return Promise.resolve({ costCodes: [parent, child] });
    }
    if (path === "/master-data/cost-codes" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({ costCode: { id: "cc-new", is_active: true, ...body } });
    }
    if (path === "/master-data/cost-codes/cc-1/archive" && init?.method === "POST") {
      if (options.archiveFails) {
        const err = new ApiError("cost code is referenced by 2 estimate line(s) and cannot be archived", 409);
        return Promise.reject(err);
      }
      return Promise.resolve({ costCode: { ...parent, is_active: false } });
    }
    return Promise.resolve({});
  });
}

describe("CostCodesSection", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("renders the parent and indents the child", async () => {
    render(<CostCodesSection />);
    expect((await screen.findAllByText("100"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("100.1")[0]).toBeInTheDocument();
  });

  it("blocks archiving a cost code referenced by estimate lines", async () => {
    mockResponses({ archiveFails: true });
    render(<CostCodesSection />);
    await screen.findAllByText("100");

    const archiveButtons = await screen.findAllByText("Archive");
    await userEvent.click(archiveButtons[0]);

    expect(
      await screen.findByText("cost code is referenced by 2 estimate line(s) and cannot be archived"),
    ).toBeInTheDocument();
  });

  it("pre-fills the parent when 'Add child' is clicked", async () => {
    render(<CostCodesSection />);
    await screen.findAllByText("100");

    const addChildButtons = await screen.findAllByText("Add child");
    await userEvent.click(addChildButtons[0]);

    expect(await screen.findByText("Add child cost code")).toBeInTheDocument();
    await userEvent.type(screen.getAllByRole("textbox")[0], "100.2");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/cost-codes",
        "test-token",
        expect.objectContaining({ method: "POST", body: expect.stringContaining('"parent_id":"cc-1"') }),
      ),
    );
  });
});
