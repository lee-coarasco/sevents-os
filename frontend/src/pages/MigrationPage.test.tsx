import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { MigrationPage } from "./MigrationPage";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "test-token", user: { id: "user-1", email: "admin@sevents.test" } },
    loading: false,
  }),
}));

describe("Module M38: Implementation & Data Migration Page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page header and the 5 enterprise entity cards", () => {
    render(
      <BrowserRouter>
        <MigrationPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Implementation & Data Migration/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Master Work-Item Library/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Cost Breakdown Structure \(CBS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Employee Directory & Workforce/i)).toBeInTheDocument();
    expect(screen.getByText(/Approved Vendors & Subcontractors/i)).toBeInTheDocument();
    expect(screen.getByText(/Inventory & Materials Catalogue/i)).toBeInTheDocument();
  });

  it("switches to History & Rollback tab and displays audit history", async () => {
    // Mock fetch returning jobs
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: "job-1",
              entity_type: "work_items",
              file_name: "1308_catalogue.csv",
              status: "imported",
              total_rows: 1308,
              valid_rows: 1308,
              error_rows: 0,
              row_errors: [],
              created_at: new Date().toISOString(),
            },
          ],
        }),
      })
    );

    render(
      <BrowserRouter>
        <MigrationPage />
      </BrowserRouter>
    );

    const historyTab = screen.getByText(/History & Rollback/i);
    fireEvent.click(historyTab);

    expect(await screen.findByText("1308_catalogue.csv")).toBeInTheDocument();
    expect(screen.getByText("imported")).toBeInTheDocument();
  });
});
