import { describe, expect, it } from "vitest";
import { computePausedSeconds, computeStepSlaState } from "./sla.js";

const SLA = { warning_threshold_seconds: 3600, breach_threshold_seconds: 7200 };

describe("computePausedSeconds", () => {
  it("returns 0 with no blocked/unblocked events", () => {
    expect(computePausedSeconds([], "2026-10-16T02:00:00.000Z")).toBe(0);
  });

  it("sums a closed blocked -> unblocked interval", () => {
    const events = [
      { event_type: "task_blocked" as const, created_at: "2026-10-16T01:00:00.000Z" },
      { event_type: "task_unblocked" as const, created_at: "2026-10-16T01:10:00.000Z" },
    ];
    expect(computePausedSeconds(events, "2026-10-16T02:00:00.000Z")).toBe(600);
  });

  it("counts a still-blocked step as paused through now", () => {
    const events = [{ event_type: "task_blocked" as const, created_at: "2026-10-16T01:00:00.000Z" }];
    expect(computePausedSeconds(events, "2026-10-16T01:30:00.000Z")).toBe(1800);
  });

  it("sums multiple pause intervals and is order-independent", () => {
    const events = [
      { event_type: "task_unblocked" as const, created_at: "2026-10-16T01:10:00.000Z" },
      { event_type: "task_blocked" as const, created_at: "2026-10-16T02:00:00.000Z" },
      { event_type: "task_blocked" as const, created_at: "2026-10-16T01:00:00.000Z" },
      { event_type: "task_unblocked" as const, created_at: "2026-10-16T02:05:00.000Z" },
    ];
    // 01:00-01:10 (600s) + 02:00-02:05 (300s) = 900s, regardless of input order.
    expect(computePausedSeconds(events, "2026-10-16T03:00:00.000Z")).toBe(900);
  });
});

describe("computeStepSlaState", () => {
  it("is not_configured when there is no sla definition", () => {
    const state = computeStepSlaState(
      { status: "active", started_at: "2026-10-16T00:00:00.000Z" },
      null,
      [],
      [],
      "2026-10-16T01:00:00.000Z",
    );
    expect(state).toEqual({ status: "not_configured", elapsedSeconds: null, pausedSeconds: null, activeRungOrder: null });
  });

  it("is not_configured for a closed step even with an sla definition", () => {
    const state = computeStepSlaState(
      { status: "completed", started_at: "2026-10-16T00:00:00.000Z" },
      SLA,
      [],
      [],
      "2026-10-17T00:00:00.000Z",
    );
    expect(state.status).toBe("not_configured");
  });

  it("is on_time before the warning threshold", () => {
    const state = computeStepSlaState(
      { status: "active", started_at: "2026-10-16T00:00:00.000Z" },
      SLA,
      [],
      [],
      "2026-10-16T00:30:00.000Z",
    );
    expect(state.status).toBe("on_time");
    expect(state.elapsedSeconds).toBe(1800);
  });

  it("is warning between the warning and breach thresholds", () => {
    const state = computeStepSlaState(
      { status: "active", started_at: "2026-10-16T00:00:00.000Z" },
      SLA,
      [],
      [],
      "2026-10-16T01:30:00.000Z",
    );
    expect(state.status).toBe("warning");
    expect(state.activeRungOrder).toBeNull();
  });

  it("is breached past the breach threshold and picks the highest reached rung", () => {
    const rungs = [
      { rung_order: 1, delay_after_breach_seconds: 0 },
      { rung_order: 2, delay_after_breach_seconds: 1800 },
      { rung_order: 3, delay_after_breach_seconds: 7200 },
    ];
    // Breach at 7200s elapsed; now is 9000s elapsed -> 1800s since breach -> rung 2 reached, rung 3 not yet.
    const state = computeStepSlaState(
      { status: "active", started_at: "2026-10-16T00:00:00.000Z" },
      SLA,
      rungs,
      [],
      "2026-10-16T02:30:00.000Z",
    );
    expect(state.status).toBe("breached");
    expect(state.activeRungOrder).toBe(2);
  });

  it("pauses the clock while the step was blocked", () => {
    // Started at 00:00, blocked 00:10-01:10 (1h pause), now 01:50 -> raw elapsed 6600s, paused 3600s -> net 3000s (on_time, under the 3600s warning threshold).
    const events = [
      { event_type: "task_blocked" as const, created_at: "2026-10-16T00:10:00.000Z" },
      { event_type: "task_unblocked" as const, created_at: "2026-10-16T01:10:00.000Z" },
    ];
    const state = computeStepSlaState(
      { status: "active", started_at: "2026-10-16T00:00:00.000Z" },
      SLA,
      [],
      events,
      "2026-10-16T01:50:00.000Z",
    );
    expect(state.status).toBe("on_time");
    expect(state.pausedSeconds).toBe(3600);
    expect(state.elapsedSeconds).toBe(3000);
  });
});
