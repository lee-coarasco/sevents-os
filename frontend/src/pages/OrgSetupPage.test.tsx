import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OrgSetupPage } from "./OrgSetupPage";

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

function mockDefaultResponses() {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/tenancy/companies") {
      return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
    }
    if (path === "/projects") {
      return Promise.resolve({ projects: [] });
    }
    if (path.startsWith("/tenancy/branches?companyId=")) {
      return Promise.resolve({ branches: [] });
    }
    if (path === "/authority/effective-permissions") {
      return Promise.resolve({
        permissions: ["tenancy.branch.manage", "tenancy.project.manage"],
      });
    }
    return Promise.resolve({});
  });
}

describe("OrgSetupPage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockDefaultResponses();
  });

  it("lists companies and selecting one reveals branch/project sections", async () => {
    render(
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Acme Construction")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Branches" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Acme Construction"));

    expect(await screen.findByRole("heading", { name: "Branches" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getAllByText("Acme Construction").length).toBeGreaterThanOrEqual(3);
  });

  it("hides the create-company form when the user lacks tenancy.company.manage", async () => {
    render(
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Acme Construction")).toBeInTheDocument());
    expect(screen.getByText("You don't have permission to create companies.")).toBeInTheDocument();
  });

  it("creates a branch and shows it in the list", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path === "/projects") {
        return Promise.resolve({ projects: [] });
      }
      if (path.startsWith("/tenancy/branches?companyId=")) {
        return Promise.resolve({ branches: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["tenancy.branch.manage"] });
      }
      if (path === "/tenancy/branches" && init?.method === "POST") {
        return Promise.resolve({ branch: { id: "b1", company_id: "c1", name: "Dubai HQ", operating_region: null } });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("Acme Construction"));
    await userEvent.type(screen.getByPlaceholderText("Branch name"), "Dubai HQ");
    await userEvent.click(screen.getByRole("button", { name: /add branch/i }));

    expect(await screen.findByText("Dubai HQ")).toBeInTheDocument();
  });

  it("updates an existing company's enterprise details", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({
          companies: [
            {
              id: "c1",
              legal_name: "Acme Construction",
              statutory_id: null,
              vat_registration_number: null,
              reporting_currency: "INR",
              fiscal_year_start_month: 4,
            },
          ],
        });
      }
      if (path === "/projects") {
        return Promise.resolve({ projects: [] });
      }
      if (path.startsWith("/tenancy/branches?companyId=")) {
        return Promise.resolve({ branches: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["tenancy.company.manage"] });
      }
      if (path === "/tenancy/companies/c1" && init?.method === "PATCH") {
        return Promise.resolve({
          company: {
            id: "c1",
            legal_name: "Apex Horizon Infrastructure Pvt. Ltd.",
            statutory_id: "CIN-U45200MH2021PTC368921",
            vat_registration_number: "27AABCU9603R1ZX",
            reporting_currency: "INR",
            fiscal_year_start_month: 4,
          },
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("Acme Construction"));

    // Click "Edit Company Details"
    const editBtn = screen.getByRole("button", { name: /edit company details/i });
    await userEvent.click(editBtn);

    // Dialog appears
    expect(screen.getByRole("heading", { name: "Edit Company Details" })).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue("Acme Construction");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Apex Horizon Infrastructure Pvt. Ltd.");

    const cinInput = screen.getByPlaceholderText("e.g. CIN-U45200MH2021PTC368921");
    await userEvent.type(cinInput, "CIN-U45200MH2021PTC368921");

    const vatInput = screen.getByPlaceholderText("e.g. 27AABCU9603R1ZX");
    await userEvent.type(vatInput, "27AABCU9603R1ZX");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // Verify updated values appear in the UI
    expect((await screen.findAllByText("Apex Horizon Infrastructure Pvt. Ltd.")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("CIN-U45200MH2021PTC368921")).toBeInTheDocument();
    expect(screen.getByText("27AABCU9603R1ZX")).toBeInTheDocument();
  });

  it("links projects directly to their project detail page", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path === "/projects") {
        return Promise.resolve({
          projects: [
            {
              id: "proj-101",
              company_id: "c1",
              name: "Highway Expansion",
              code: "PRJ-HW-01",
              status: "active",
              client_name: "Govt Authority",
              location: "Mumbai",
            },
          ],
        });
      }
      if (path.startsWith("/tenancy/branches?companyId=")) {
        return Promise.resolve({ branches: [] });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["tenancy.company.manage"] });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("Acme Construction"));

    const projectLink = await screen.findByRole("link", { name: /highway expansion/i });
    expect(projectLink).toHaveAttribute("href", "/projects/proj-101");
  });

  it("edits and updates branch details including code and address", async () => {
    apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
      if (path === "/tenancy/companies") {
        return Promise.resolve({ companies: [{ id: "c1", legal_name: "Acme Construction" }] });
      }
      if (path === "/projects") {
        return Promise.resolve({ projects: [] });
      }
      if (path.startsWith("/tenancy/branches?companyId=")) {
        return Promise.resolve({
          branches: [
            {
              id: "b1",
              company_id: "c1",
              name: "Old Branch",
              code: "BR-OLD",
              address: "Old Address",
              operating_region: "North",
            },
          ],
        });
      }
      if (path === "/authority/effective-permissions") {
        return Promise.resolve({ permissions: ["tenancy.branch.manage"] });
      }
      if (path === "/tenancy/branches/b1" && init?.method === "PATCH") {
        return Promise.resolve({
          branch: {
            id: "b1",
            company_id: "c1",
            name: "Mumbai Corporate Office",
            code: "BR-MUM-HQ",
            address: "Level 12, Horizon Towers, BKC, Mumbai 400051",
            operating_region: "West Zone",
          },
        });
      }
      return Promise.resolve({});
    });

    render(
      <MemoryRouter>
        <OrgSetupPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByText("Acme Construction"));

    // Click "Edit Branch"
    const editBtn = await screen.findByRole("button", { name: /edit branch/i });
    await userEvent.click(editBtn);

    // Edit modal appears
    expect(screen.getByRole("heading", { name: "Edit Branch / Office" })).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue("Old Branch");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Mumbai Corporate Office");

    const codeInput = screen.getByDisplayValue("BR-OLD");
    await userEvent.clear(codeInput);
    await userEvent.type(codeInput, "BR-MUM-HQ");

    const addrInput = screen.getByDisplayValue("Old Address");
    await userEvent.clear(addrInput);
    await userEvent.type(addrInput, "Level 12, Horizon Towers, BKC, Mumbai 400051");

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // Verify updated branch values appear
    expect(await screen.findByText("Mumbai Corporate Office")).toBeInTheDocument();
    expect(screen.getByText("BR-MUM-HQ")).toBeInTheDocument();
    expect(screen.getByText("Level 12, Horizon Towers, BKC, Mumbai 400051")).toBeInTheDocument();
  });
});
