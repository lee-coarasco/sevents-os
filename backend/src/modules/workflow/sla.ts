import type { EscalationRung, SlaDefinition, WorkflowEvent, WorkflowStepInstance } from "./types.js";

/**
 * Ticket 0081 (M31a): pure SLA/escalation math, no repository access —
 * same split as approvals.ts/validation.ts/simulation.ts/migration.ts.
 * service.ts gathers the step/definition/rungs/events and hands them
 * here.
 */

export const SLA_STATES = ["not_configured", "on_time", "warning", "breached"] as const;
export type SlaState = (typeof SLA_STATES)[number];

export interface StepSlaState {
  status: SlaState;
  /** Elapsed, unpaused seconds since the step started — null when not_configured. */
  elapsedSeconds: number | null;
  /** Total seconds this step has spent blocked (SLA clock paused) — null when not_configured. */
  pausedSeconds: number | null;
  /** The highest escalation rung whose delay has elapsed, if any — null when on_time/warning/not_configured. */
  activeRungOrder: number | null;
}

/**
 * Sums every `task_blocked` -> following `task_unblocked` interval for
 * this step, using each event's own `created_at`. A step still blocked
 * at `nowIso` (a `task_blocked` with no following `task_unblocked`)
 * counts as paused through `nowIso`. Events for other steps/types must
 * already be filtered out by the caller.
 */
export function computePausedSeconds(events: Pick<WorkflowEvent, "event_type" | "created_at">[], nowIso: string): number {
  const sorted = [...events].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  let pausedMs = 0;
  let blockedAtMs: number | null = null;
  for (const event of sorted) {
    if (event.event_type === "task_blocked") {
      blockedAtMs = Date.parse(event.created_at);
    } else if (event.event_type === "task_unblocked" && blockedAtMs !== null) {
      pausedMs += Date.parse(event.created_at) - blockedAtMs;
      blockedAtMs = null;
    }
  }
  if (blockedAtMs !== null) {
    pausedMs += Date.parse(nowIso) - blockedAtMs;
  }
  return pausedMs / 1000;
}

/**
 * A closed step (completed/skipped/failed) is never on_time/warning/
 * breached — it stopped accruing SLA time the moment it closed.
 */
const CLOSED_STATUSES = new Set(["completed", "skipped", "failed"]);

export function computeStepSlaState(
  step: Pick<WorkflowStepInstance, "status" | "started_at">,
  slaDefinition: Pick<SlaDefinition, "warning_threshold_seconds" | "breach_threshold_seconds"> | null,
  rungs: Pick<EscalationRung, "rung_order" | "delay_after_breach_seconds">[],
  pauseEvents: Pick<WorkflowEvent, "event_type" | "created_at">[],
  nowIso: string,
): StepSlaState {
  if (!slaDefinition || CLOSED_STATUSES.has(step.status)) {
    return { status: "not_configured", elapsedSeconds: null, pausedSeconds: null, activeRungOrder: null };
  }

  const pausedSeconds = computePausedSeconds(pauseEvents, nowIso);
  const elapsedSeconds = (Date.parse(nowIso) - Date.parse(step.started_at)) / 1000 - pausedSeconds;

  if (elapsedSeconds < slaDefinition.warning_threshold_seconds) {
    return { status: "on_time", elapsedSeconds, pausedSeconds, activeRungOrder: null };
  }
  if (elapsedSeconds < slaDefinition.breach_threshold_seconds) {
    return { status: "warning", elapsedSeconds, pausedSeconds, activeRungOrder: null };
  }

  const secondsSinceBreach = elapsedSeconds - slaDefinition.breach_threshold_seconds;
  const reachedRungs = rungs
    .filter((r) => r.delay_after_breach_seconds <= secondsSinceBreach)
    .sort((a, b) => b.rung_order - a.rung_order);
  return {
    status: "breached",
    elapsedSeconds,
    pausedSeconds,
    activeRungOrder: reachedRungs[0]?.rung_order ?? null,
  };
}
