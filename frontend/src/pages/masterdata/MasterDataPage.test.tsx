import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MasterDataPage } from "./MasterDataPage";

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

describe("MasterDataPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation((path: string) => {
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["master-data.manage", "tenancy.project.manage"] });
      }
      if (path === "/master-data/uom") return Promise.resolve({ uom: [] });
      if (path === "/master-data/currencies") return Promise.resolve({ currencies: [] });
      if (path === "/master-data/cost-codes") return Promise.resolve({ costCodes: [] });
      if (path === "/master-data/document-types") return Promise.resolve({ documentTypes: [] });
      if (path === "/project-types") return Promise.resolve({ projectTypes: [] });
      if (path === "/master-data/numbering-schemes") return Promise.resolve({ numberingSchemes: [] });
      return Promise.resolve({});
    });
  });

  it("defaults to the Units of Measure tab and switches tabs on click", async () => {
    render(<MasterDataPage />);

    expect(await screen.findByText("No units of measure yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Currencies" }));
    expect(await screen.findByText("No currencies yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cost Codes" }));
    expect(await screen.findByText("No cost codes yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Document Types" }));
    expect(await screen.findByText("No document types yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Project Types" }));
    expect(await screen.findByText("No project types yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Numbering Schemes" }));
    expect(await screen.findByText("No numbering schemes yet.")).toBeInTheDocument();
  });
});
