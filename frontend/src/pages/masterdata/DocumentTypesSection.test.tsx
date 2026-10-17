import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentTypesSection } from "./DocumentTypesSection";
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

const drg = { id: "dt-1", code: "DRG", label: "Drawing", is_active: true };

function mockResponses(options: { archiveStatus?: number } = {}) {
  apiFetch.mockImplementation((path: string, _token: string, init?: RequestInit) => {
    if (path === "/authority/effective-permissions") return Promise.resolve({ permissions: ["master-data.manage"] });
    if (path === "/master-data/document-types" && (!init || init.method === undefined)) {
      return Promise.resolve({ documentTypes: [drg] });
    }
    if (path === "/master-data/document-types/dt-1/archive" && init?.method === "POST") {
      if (options.archiveStatus === 409) {
        return Promise.reject(
          new ApiError("document type is referenced by 3 document(s) and cannot be archived", 409),
        );
      }
      return Promise.resolve({ documentType: { ...drg, is_active: false } });
    }
    return Promise.resolve({});
  });
}

describe("DocumentTypesSection", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    mockResponses();
  });

  it("lists document types", async () => {
    render(<DocumentTypesSection />);
    expect(await screen.findByText("DRG")).toBeInTheDocument();
    expect(screen.getByText("Drawing")).toBeInTheDocument();
  });

  it("shows the referencing-count error when archive is blocked", async () => {
    mockResponses({ archiveStatus: 409 });
    render(<DocumentTypesSection />);
    await screen.findByText("DRG");

    await userEvent.click(await screen.findByText("Archive"));

    expect(
      await screen.findByText("document type is referenced by 3 document(s) and cannot be archived"),
    ).toBeInTheDocument();
  });

  it("archives when nothing references it", async () => {
    render(<DocumentTypesSection />);
    await screen.findByText("DRG");

    await userEvent.click(await screen.findByText("Archive"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/master-data/document-types/dt-1/archive",
        "test-token",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
