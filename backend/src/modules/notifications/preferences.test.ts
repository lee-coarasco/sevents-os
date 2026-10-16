import { describe, expect, it } from "vitest";
import { isDigestDue, isWithinQuietHours } from "./preferences.js";

describe("isWithinQuietHours", () => {
  it("is false when quiet hours are not configured", () => {
    expect(isWithinQuietHours("2026-10-16T12:00:00.000Z", null)).toBe(false);
  });

  it("is true inside a same-day window", () => {
    const window = { quiet_hours_start: "09:00", quiet_hours_end: "17:00", quiet_hours_timezone: "UTC" };
    expect(isWithinQuietHours("2026-10-16T12:00:00.000Z", window)).toBe(true);
  });

  it("is false outside a same-day window", () => {
    const window = { quiet_hours_start: "09:00", quiet_hours_end: "17:00", quiet_hours_timezone: "UTC" };
    expect(isWithinQuietHours("2026-10-16T20:00:00.000Z", window)).toBe(false);
  });

  it("handles a window that wraps past midnight", () => {
    const window = { quiet_hours_start: "22:00", quiet_hours_end: "06:00", quiet_hours_timezone: "UTC" };
    expect(isWithinQuietHours("2026-10-16T23:00:00.000Z", window)).toBe(true);
    expect(isWithinQuietHours("2026-10-16T02:00:00.000Z", window)).toBe(true);
    expect(isWithinQuietHours("2026-10-16T12:00:00.000Z", window)).toBe(false);
  });

  it("is false for a zero-width window instead of 'always on'", () => {
    const window = { quiet_hours_start: "09:00", quiet_hours_end: "09:00", quiet_hours_timezone: "UTC" };
    expect(isWithinQuietHours("2026-10-16T09:00:00.000Z", window)).toBe(false);
  });

  it("interprets the window in the configured timezone, not UTC", () => {
    // 09:00 Asia/Dubai (UTC+4) is 05:00 UTC.
    const window = { quiet_hours_start: "09:00", quiet_hours_end: "17:00", quiet_hours_timezone: "Asia/Dubai" };
    expect(isWithinQuietHours("2026-10-16T05:30:00.000Z", window)).toBe(true);
    expect(isWithinQuietHours("2026-10-16T04:30:00.000Z", window)).toBe(false);
  });
});

describe("isDigestDue", () => {
  it("is false when no interval is configured", () => {
    expect(isDigestDue("2026-10-16T12:00:00.000Z", null, null)).toBe(false);
  });

  it("is due immediately if a digest has never been released", () => {
    expect(isDigestDue("2026-10-16T12:00:00.000Z", null, 60)).toBe(true);
  });

  it("is not due before the interval elapses", () => {
    expect(isDigestDue("2026-10-16T12:30:00.000Z", "2026-10-16T12:00:00.000Z", 60)).toBe(false);
  });

  it("is due once the interval elapses", () => {
    expect(isDigestDue("2026-10-16T13:00:00.000Z", "2026-10-16T12:00:00.000Z", 60)).toBe(true);
  });
});
