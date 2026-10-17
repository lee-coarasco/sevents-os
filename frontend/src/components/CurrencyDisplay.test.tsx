import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyDisplay } from "./CurrencyDisplay";

describe("CurrencyDisplay", () => {
  it("renders formatted amount with currency code", () => {
    render(<CurrencyDisplay amount={1250000} currencyCode="AED" />);
    expect(screen.getByText(/AED.*1,250,000\.00/)).toBeInTheDocument();
  });

  it("renders — for null amount", () => {
    render(<CurrencyDisplay amount={null} currencyCode="USD" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders — for undefined amount", () => {
    render(<CurrencyDisplay amount={undefined} currencyCode="EUR" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("formats zero correctly", () => {
    render(<CurrencyDisplay amount={0} currencyCode="GBP" />);
    expect(screen.getByText(/GBP.*0\.00/)).toBeInTheDocument();
  });
});
