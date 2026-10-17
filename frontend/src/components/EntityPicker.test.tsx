import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityPicker } from "./EntityPicker";

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

describe("EntityPicker", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("lists projects by name and code, and returns the selected id", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/projects") {
        return Promise.resolve({
          projects: [{ id: "p1", name: "Tower A", code: "TWR-A" }],
        });
      }
      return Promise.resolve({});
    });
    const onChange = vi.fn();
    render(<EntityPicker type="project" value="" onChange={onChange} />);

    await userEvent.click(screen.getByRole("textbox"));
    expect(await screen.findByText("Tower A (TWR-A)")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Tower A (TWR-A)"));
    expect(onChange).toHaveBeenCalledWith("p1");
  });

  it("queries the server with ?search= for client-side-search-backed types, debounced", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith("/crm/clients")) {
        return Promise.resolve({ clients: [{ id: "c1", name: "Acme Construction" }] });
      }
      return Promise.resolve({});
    });
    render(<EntityPicker type="client" value="" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("textbox"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Acme" } });

    await waitFor(
      () => expect(apiFetch).toHaveBeenCalledWith("/crm/clients?search=Acme", "test-token"),
      { timeout: 3000 },
    );
  });

  it("shows a 'no matches' state for an empty result set", async () => {
    apiFetch.mockImplementation(() => Promise.resolve({ costCodes: [] }));
    render(<EntityPicker type="cost-code" value="" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("textbox"));
    expect(await screen.findByText("No matches.")).toBeInTheDocument();
  });

  it("displays the label of the currently selected value when closed", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/master-data/uom") {
        return Promise.resolve({ uom: [{ id: "u1", code: "KG", description: "Kilogram" }] });
      }
      return Promise.resolve({});
    });
    render(<EntityPicker type="uom" value="u1" onChange={() => {}} />);

    expect(await screen.findByDisplayValue("KG — Kilogram")).toBeInTheDocument();
  });
});
