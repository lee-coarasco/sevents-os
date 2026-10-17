interface CurrencyDisplayProps {
  amount: number | null | undefined;
  currencyCode: string;
  className?: string;
}

/** Read-only formatted currency amount. Renders "—" when amount is null/undefined. Never hard-codes a currency. */
export function CurrencyDisplay({ amount, currencyCode, className }: CurrencyDisplayProps) {
  if (amount == null) {
    return <span className={className ?? "text-zinc-600"}>—</span>;
  }
  const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span className={className ?? "text-zinc-800"}>{currencyCode} {formatted}</span>;
}
