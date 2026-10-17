import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders a formatted label for a known status", () => {
    render(<StatusBadge status="pending_approval" />);
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });

  it("colours success statuses distinctly from danger statuses", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText("Approved")).toHaveClass("bg-emerald-50");

    render(<StatusBadge status="rejected" />);
    expect(screen.getByText("Rejected")).toHaveClass("bg-red-50");
  });

  it("falls back to a neutral grey pill with the raw label for an unknown status", () => {
    render(<StatusBadge status="some_unmapped_status" />);
    const badge = screen.getByText("Some Unmapped Status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-zinc-100");
  });

  it("lets a caller override the palette with a custom variant map", () => {
    render(<StatusBadge status="draft" variant={{ draft: "danger" }} />);
    expect(screen.getByText("Draft")).toHaveClass("bg-red-50");
  });
});
