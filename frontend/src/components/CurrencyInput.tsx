import { useState } from "react";

interface CurrencyInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  currencyCode: string;
  disabled?: boolean;
  className?: string;
}

function formatAmount(amount: number, currencyCode: string): string {
  return `${currencyCode} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Numeric currency input — shows formatted value when blurred, plain number when focused. Never hard-codes a currency. */
export function CurrencyInput({ value, onChange, currencyCode, disabled, className }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState(() => (value != null ? String(value) : ""));

  const displayValue = focused
    ? rawText
    : value != null
      ? formatAmount(value, currencyCode)
      : "";

  function handleFocus() {
    setRawText(value != null ? String(value) : "");
    setFocused(true);
  }

  function handleBlur() {
    setFocused(false);
    const parsed = parseFloat(rawText);
    if (rawText.trim() === "" || isNaN(parsed)) {
      onChange(null);
    } else {
      onChange(parsed);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRawText(e.target.value);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={`${currencyCode} 0.00`}
      className={
        className ??
        "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
      }
    />
  );
}
