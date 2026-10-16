/**
 * Ticket 0083 (M31c): pure quiet-hours/digest math, no repository
 * access — same split as workflow/sla.ts. service.ts gathers the
 * preference/schedule rows and calls these.
 */

function minuteOfDay(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function minutesOfDayInTimezone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export interface QuietHoursConfig {
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
}

/**
 * `quietHours` null means "not configured" — always false, never a
 * hard-coded default window (CLAUDE.md). A zero-width window
 * (start === end) is also always false rather than "always on."
 */
export function isWithinQuietHours(nowIso: string, quietHours: QuietHoursConfig | null): boolean {
  if (!quietHours) return false;
  const nowMinutes = minutesOfDayInTimezone(new Date(nowIso), quietHours.quiet_hours_timezone);
  const start = minuteOfDay(quietHours.quiet_hours_start);
  const end = minuteOfDay(quietHours.quiet_hours_end);
  if (start === end) return false;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  // Wraps past midnight, e.g. 22:00 -> 06:00.
  return nowMinutes >= start || nowMinutes < end;
}

/**
 * `null` interval means "not configured" — never due, so deferred
 * digest-preferring notifications simply wait until the caller sets
 * one (no invented default interval, per CLAUDE.md).
 */
export function isDigestDue(
  nowIso: string,
  lastDigestReleasedAt: string | null,
  digestIntervalMinutes: number | null,
): boolean {
  if (digestIntervalMinutes === null) return false;
  if (!lastDigestReleasedAt) return true;
  const elapsedMs = Date.parse(nowIso) - Date.parse(lastDigestReleasedAt);
  return elapsedMs >= digestIntervalMinutes * 60 * 1000;
}
