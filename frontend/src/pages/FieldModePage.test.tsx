import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { OfflineSyncProvider } from "../context/OfflineSyncContext";
import { FieldModePage } from "./FieldModePage";

// Mock AuthContext
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "test-token", user: { id: "user-1", email: "site@sevents.test" } },
    loading: false,
  }),
}));

describe("Module M37: FieldModePage & Offline Capture UI", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders mobile field banner and tab buttons", () => {
    render(
      <BrowserRouter>
        <OfflineSyncProvider>
          <FieldModePage />
        </OfflineSyncProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/Field Mode & Mobile Site Capture/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Progress \(DPR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety Hazard Log/i)).toBeInTheDocument();
    expect(screen.getByText(/Quality Inspection/i)).toBeInTheDocument();
  });

  it("saves a DPR into offline draft queue", () => {
    render(
      <BrowserRouter>
        <OfflineSyncProvider>
          <FieldModePage />
        </OfflineSyncProvider>
      </BrowserRouter>
    );

    const textarea = screen.getByPlaceholderText(/Level 12 rebar reinforcement 100% complete/i);
    fireEvent.change(textarea, { target: { value: "Completed pour for slab B2" } });

    const submitBtn = screen.getByText(/Save DPR to Offline Queue/i);
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Daily Progress Report saved to offline queue!/i)).toBeInTheDocument();
    expect(screen.getByText(/DPR - Burj Crown Tower/i)).toBeInTheDocument();
  });

  it("switches to Safety Hazard form and saves an observation", () => {
    render(
      <BrowserRouter>
        <OfflineSyncProvider>
          <FieldModePage />
        </OfflineSyncProvider>
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText(/Safety Hazard Log/i));

    expect(screen.getByText(/Field Safety Hazard Observation/i)).toBeInTheDocument();
    const locationInput = screen.getByPlaceholderText(/Tower B - Floor 14 east perimeter edge/i);
    fireEvent.change(locationInput, { target: { value: "Shaft A level 4" } });

    const submitBtn = screen.getByText(/Log Hazard to Offline Queue/i);
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Safety hazard observation stored in offline queue!/i)).toBeInTheDocument();
  });
});
