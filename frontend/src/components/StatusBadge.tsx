type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  info: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

const STATUS_TONES: Record<string, Tone> = {
  // generic workflow / approval / estimate / bid statuses
  draft: "neutral",
  pending: "warning",
  pending_approval: "warning",
  under_review: "warning",
  waiting: "warning",
  active: "success",
  approved: "success",
  achieved: "success",
  completed: "success",
  won: "success",
  approved_with_conditions: "info",
  returned_for_correction: "warning",
  superseded: "neutral",
  skipped: "neutral",
  on_hold: "warning",
  on_leave: "warning",
  suspended: "danger",
  offboarded: "neutral",
  rejected: "danger",
  missed: "danger",
  failed: "danger",
  closed: "neutral",
  lost: "danger",
  // CRM opportunity stage
  lead: "neutral",
  qualified: "info",
  site_visit: "info",
  tender: "info",
  negotiation: "warning",
};

function formatLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface StatusBadgeProps {
  status: string;
  variant?: Record<string, Tone>;
  className?: string;
}

/** Shared colour-coded status pill. Unknown statuses fall back to a neutral grey pill with the raw label, never a crash. */
export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const tone = variant?.[status] ?? STATUS_TONES[status] ?? "neutral";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]} ${className ?? ""}`}
    >
      {formatLabel(status)}
    </span>
  );
}
