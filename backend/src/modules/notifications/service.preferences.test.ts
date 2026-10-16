import { describe, expect, it } from "vitest";
import { FakeNotificationsRepository } from "../../test/fakeNotificationsRepository.js";
import type { NotificationSender } from "./types.js";
import {
  InvalidPreferenceError,
  InvalidScheduleSettingsError,
  dispatchNotification,
  getMyScheduleSettings,
  listMyPreferences,
  releaseDueDeferrals,
  setMyPreference,
  setMyScheduleSettings,
} from "./service.js";

const TOKEN = "admin-token";
const TENANT = "tenant-a";
const USER = "user-1";

function repoWithTemplate() {
  const repo = new FakeNotificationsRepository();
  repo.addSession(TOKEN, TENANT, USER);
  repo.templates.set("template-1", {
    id: "template-1",
    tenant_id: TENANT,
    template_key: "welcome",
    channel: "email" as const,
    subject: "Hi {{name}}",
    body: "Welcome, {{name}}!",
  });
  repo.templates.set("template-2", {
    id: "template-2",
    tenant_id: TENANT,
    template_key: "task-assigned",
    channel: "in_app" as const,
    subject: null,
    body: "You were assigned a task",
  });
  return repo;
}

function countingSender(): { sender: NotificationSender; count: () => number } {
  let count = 0;
  return {
    sender: {
      send: async () => {
        count += 1;
        return { success: true };
      },
    },
    count: () => count,
  };
}

describe("setMyPreference / listMyPreferences", () => {
  it("rejects a blank templateKey", async () => {
    const repo = repoWithTemplate();
    await expect(
      setMyPreference(repo, TOKEN, { templateKey: "  ", channel: "email", optedIn: true, deliveryMode: "immediate" }),
    ).rejects.toThrow(InvalidPreferenceError);
  });

  it("upserts and lists a caller's own preferences, self-only", async () => {
    const repo = repoWithTemplate();
    const other = "user-2";
    repo.addSession("other-token", TENANT, other);

    await setMyPreference(repo, TOKEN, { templateKey: "welcome", channel: "email", optedIn: false, deliveryMode: "digest" });
    await setMyPreference(repo, "other-token", { templateKey: "welcome", channel: "email", optedIn: true, deliveryMode: "immediate" });

    const mine = await listMyPreferences(repo, TOKEN);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.opted_in).toBe(false);
    expect(mine[0]?.delivery_mode).toBe("digest");

    const theirs = await listMyPreferences(repo, "other-token");
    expect(theirs).toHaveLength(1);
    expect(theirs[0]?.opted_in).toBe(true);
  });
});

describe("setMyScheduleSettings", () => {
  it("rejects a partial quiet-hours window", async () => {
    const repo = repoWithTemplate();
    await expect(setMyScheduleSettings(repo, TOKEN, { quietHoursStart: "22:00" })).rejects.toThrow(
      InvalidScheduleSettingsError,
    );
  });

  it("rejects a non-positive digest interval", async () => {
    const repo = repoWithTemplate();
    await expect(setMyScheduleSettings(repo, TOKEN, { digestIntervalMinutes: 0 })).rejects.toThrow(
      InvalidScheduleSettingsError,
    );
  });

  it("merges a partial update onto the existing row rather than clobbering it", async () => {
    const repo = repoWithTemplate();
    await setMyScheduleSettings(repo, TOKEN, {
      quietHoursStart: "22:00",
      quietHoursEnd: "06:00",
      quietHoursTimezone: "Asia/Dubai",
    });
    await setMyScheduleSettings(repo, TOKEN, { digestIntervalMinutes: 120 });

    const settings = await getMyScheduleSettings(repo, TOKEN);
    expect(settings?.quiet_hours_start).toBe("22:00");
    expect(settings?.digest_interval_minutes).toBe(120);
  });

  it("is absent (no-op, immediate delivery) until a caller configures it", async () => {
    const repo = repoWithTemplate();
    expect(await getMyScheduleSettings(repo, TOKEN)).toBeNull();
  });
});

describe("dispatchNotification: no-op default", () => {
  it("delivers immediately when no preference or schedule settings exist at all", async () => {
    const repo = repoWithTemplate();
    const { notification, deferred } = await dispatchNotification(repo, countingSender().sender, TENANT, {
      recipientId: USER,
      templateKey: "welcome",
      channel: "email",
      dedupKey: "k1",
      nowIso: "2026-10-16T12:00:00.000Z",
    });
    expect(deferred).toBe(false);
    expect(notification.status).toBe("sent");
  });
});

describe("dispatchNotification: opt-out", () => {
  it("is skipped, never sent, when the recipient has opted out", async () => {
    const repo = repoWithTemplate();
    await setMyPreference(repo, TOKEN, { templateKey: "welcome", channel: "email", optedIn: false, deliveryMode: "immediate" });
    const { sender, count } = countingSender();

    const { notification, deferred } = await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "welcome",
      channel: "email",
      dedupKey: "k1",
      nowIso: "2026-10-16T12:00:00.000Z",
    });
    expect(deferred).toBe(false);
    expect(notification.status).toBe("skipped");
    expect(count()).toBe(0);
  });
});

describe("dispatchNotification + releaseDueDeferrals: quiet hours", () => {
  it("defers a non-urgent notification created during quiet hours, and releases it once quiet hours end", async () => {
    const repo = repoWithTemplate();
    await setMyScheduleSettings(repo, TOKEN, {
      quietHoursStart: "22:00",
      quietHoursEnd: "06:00",
      quietHoursTimezone: "UTC",
    });
    const { sender, count } = countingSender();

    const duringQuietHours = await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "welcome",
      channel: "email",
      dedupKey: "k1",
      nowIso: "2026-10-16T23:00:00.000Z",
    });
    expect(duringQuietHours.deferred).toBe(true);
    expect(duringQuietHours.notification.status).toBe("deferred");
    expect(count()).toBe(0);

    const stillQuiet = await releaseDueDeferrals(repo, sender, TENANT, USER, "2026-10-17T01:00:00.000Z");
    expect(stillQuiet.released).toHaveLength(0);
    expect(count()).toBe(0);

    const afterQuietHours = await releaseDueDeferrals(repo, sender, TENANT, USER, "2026-10-17T07:00:00.000Z");
    expect(afterQuietHours.released).toHaveLength(1);
    expect(afterQuietHours.released[0]?.status).toBe("sent");
    expect(count()).toBe(1);
  });

  it("bypasses quiet hours entirely for an urgent notification", async () => {
    const repo = repoWithTemplate();
    await setMyScheduleSettings(repo, TOKEN, {
      quietHoursStart: "22:00",
      quietHoursEnd: "06:00",
      quietHoursTimezone: "UTC",
    });
    const { sender, count } = countingSender();

    const { notification, deferred } = await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "welcome",
      channel: "email",
      dedupKey: "k1",
      urgent: true,
      nowIso: "2026-10-16T23:00:00.000Z",
    });
    expect(deferred).toBe(false);
    expect(notification.status).toBe("sent");
    expect(count()).toBe(1);
  });
});

describe("dispatchNotification + releaseDueDeferrals: digest", () => {
  it("defers a digest-preferring notification regardless of quiet hours, and batches release per the configured interval", async () => {
    const repo = repoWithTemplate();
    await setMyPreference(repo, TOKEN, {
      templateKey: "task-assigned",
      channel: "in_app",
      optedIn: true,
      deliveryMode: "digest",
    });
    await setMyScheduleSettings(repo, TOKEN, { digestIntervalMinutes: 60 });
    const { sender, count } = countingSender();

    const first = await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "task-assigned",
      channel: "in_app",
      dedupKey: "k1",
      nowIso: "2026-10-16T12:00:00.000Z",
    });
    const second = await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "task-assigned",
      channel: "in_app",
      dedupKey: "k2",
      nowIso: "2026-10-16T12:10:00.000Z",
    });
    expect(first.deferred).toBe(true);
    expect(second.deferred).toBe(true);

    // First release call establishes the digest clock (never released before -> due immediately).
    const firstRelease = await releaseDueDeferrals(repo, sender, TENANT, USER, "2026-10-16T12:15:00.000Z");
    expect(firstRelease.digestReleased).toBe(true);
    expect(firstRelease.released).toHaveLength(2);

    const third = await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "task-assigned",
      channel: "in_app",
      dedupKey: "k3",
      nowIso: "2026-10-16T12:20:00.000Z",
    });
    expect(third.deferred).toBe(true);

    const tooSoon = await releaseDueDeferrals(repo, sender, TENANT, USER, "2026-10-16T12:30:00.000Z");
    expect(tooSoon.digestReleased).toBe(false);
    expect(tooSoon.released).toHaveLength(0);

    const dueAgain = await releaseDueDeferrals(repo, sender, TENANT, USER, "2026-10-16T13:16:00.000Z");
    expect(dueAgain.digestReleased).toBe(true);
    expect(dueAgain.released).toHaveLength(1);
  });

  it("leaves digest-preferring notifications deferred forever if no interval is ever configured (no invented default)", async () => {
    const repo = repoWithTemplate();
    await setMyPreference(repo, TOKEN, {
      templateKey: "task-assigned",
      channel: "in_app",
      optedIn: true,
      deliveryMode: "digest",
    });
    const { sender } = countingSender();

    await dispatchNotification(repo, sender, TENANT, {
      recipientId: USER,
      templateKey: "task-assigned",
      channel: "in_app",
      dedupKey: "k1",
      nowIso: "2026-10-16T12:00:00.000Z",
    });

    const release = await releaseDueDeferrals(repo, sender, TENANT, USER, "2026-10-20T12:00:00.000Z");
    expect(release.digestReleased).toBe(false);
    expect(release.released).toHaveLength(0);
  });
});
