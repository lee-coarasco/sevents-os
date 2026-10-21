import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowPicker } from "./WorkflowPicker";

const DEFINITIONS = [
  { id: "wf-1", name: "Standard Estimation Approval", key: "wf.est.std", capability_key: "estimate_approval" },
  { id: "wf-2", name: "High-Value Commercial Review", key: "wf.est.high", capability_key: "estimate_approval" },
  { id: "wf-3", name: "Document Release Approval", key: "wf.doc.release", capability_key: "document_release" },
];

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test-token" } }),
}));

describe("WorkflowPicker", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders with placeholder and opens search dropdown on click", async () => {
    const onChange = vi.fn();
    render(
      <WorkflowPicker
        contextKey="estimate_approval"
        value=""
        onChange={onChange}
        definitions={DEFINITIONS}
      />
    );

    const trigger = screen.getByTestId("workflow-picker-trigger");
    expect(trigger).toHaveTextContent("Select approval workflow…");

    await userEvent.click(trigger);
    expect(screen.getByPlaceholderText("Type to search workflows…")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-item-wf-1")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-item-wf-2")).toBeInTheDocument();
  });

  it("filters options when typing search query", async () => {
    const onChange = vi.fn();
    render(
      <WorkflowPicker
        contextKey="estimate_approval"
        value=""
        onChange={onChange}
        definitions={DEFINITIONS}
      />
    );

    await userEvent.click(screen.getByTestId("workflow-picker-trigger"));
    await userEvent.type(screen.getByPlaceholderText("Type to search workflows…"), "High-Value");

    expect(screen.getByTestId("workflow-item-wf-2")).toBeInTheDocument();
    expect(screen.queryByTestId("workflow-item-wf-1")).not.toBeInTheDocument();
  });

  it("calls onChange when an option is selected", async () => {
    const onChange = vi.fn();
    render(
      <WorkflowPicker
        contextKey="estimate_approval"
        value=""
        onChange={onChange}
        definitions={DEFINITIONS}
      />
    );

    await userEvent.click(screen.getByTestId("workflow-picker-trigger"));
    await userEvent.click(screen.getByTestId("workflow-item-wf-1"));

    expect(onChange).toHaveBeenCalledWith("wf-1", DEFINITIONS[0]);
  });

  it("saves default workflow to localStorage when 'Set default' is clicked and auto-preselects it", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <WorkflowPicker
        contextKey="estimate_approval"
        value="wf-2"
        onChange={onChange}
        definitions={DEFINITIONS}
      />
    );

    // Click "☆ Set as default" button
    const setDefaultBtn = screen.getByText("☆ Set as default");
    await userEvent.click(setDefaultBtn);

    expect(localStorage.getItem("sevents_default_wf_estimate_approval")).toBe("wf-2");
    expect(screen.getByText("★ Default workflow")).toBeInTheDocument();

    // Rerender with empty value should auto-trigger onChange with default
    rerender(
      <WorkflowPicker
        contextKey="estimate_approval"
        value=""
        onChange={onChange}
        definitions={DEFINITIONS}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("wf-2", DEFINITIONS[1]);
    });
  });

  it("supports accessible select change for test runners", async () => {
    const onChange = vi.fn();
    render(
      <WorkflowPicker
        contextKey="estimate_approval"
        value=""
        onChange={onChange}
        definitions={DEFINITIONS}
      />
    );

    await userEvent.selectOptions(screen.getByDisplayValue("Select approval workflow…"), "wf-1");
    expect(onChange).toHaveBeenCalledWith("wf-1", DEFINITIONS[0]);
  });
});
