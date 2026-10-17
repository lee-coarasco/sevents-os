import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencyInput } from "./CurrencyInput";

describe("CurrencyInput", () => {
  it("shows formatted value when not focused", () => {
    render(<CurrencyInput value={1500} onChange={() => undefined} currencyCode="AED" />);
    expect(screen.getByDisplayValue(/AED.*1,500\.00/)).toBeInTheDocument();
  });

  it("shows plain number when focused", () => {
    render(<CurrencyInput value={1500} onChange={() => undefined} currencyCode="AED" />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    expect((input as HTMLInputElement).value).toBe("1500");
  });

  it("calls onChange with parsed number on blur", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={null} onChange={onChange} currencyCode="USD" />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2500.50" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(2500.5);
  });

  it("calls onChange with null for empty input on blur", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={100} onChange={onChange} currencyCode="EUR" />);
    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows placeholder with currency code when no value", () => {
    render(<CurrencyInput value={null} onChange={() => undefined} currencyCode="GBP" />);
    expect(screen.getByPlaceholderText("GBP 0.00")).toBeInTheDocument();
  });
});
