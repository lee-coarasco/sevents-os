import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrenciesSection } from "./CurrenciesSection";

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

const aed = {
  id: "cur-1",
  code: "AED",
  name: "UAE Dirham",
  symbol: "د.إ",
  is_base_currency: true,
  exchange_rate_to_base: 1,
  effective_date: null,
  is_active: true,
};

function mockResponses() {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["master-data.manage"] });
    if (path === "/master-data/currencies" && (!init || init.method === undefined)) {
      return Promise.resolve({ currencies: [aed] });
    }
    if (path === "/master-data/currencies" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve({ currency: { id: "cur-new", is_active: true, effective_date: null, ...body } });
    }
    return Promise.resolve({});
  });
}

describe("CurrenciesSection", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("shows the base currency badge", async () => {
    render(<CurrenciesSection />);
    expect(await screen.findByText("AED (د.إ)")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
  });

  it("creates a new currency and marks it as base when checked", async () => {
    render(<CurrenciesSection />);
    await screen.findByText("AED (د.إ)");

    await userEvent.type(screen.getByPlaceholderText("UAE Dirham"), "US Dollar");
    await userEvent.type(screen.getByPlaceholderText("AED"), "USD");
    await userEvent.click(screen.getByLabelText("Set as base currency"));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/currencies",
        "test-token",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"is_base_currency":true'),
        }),
      ),
    );
  });
});
