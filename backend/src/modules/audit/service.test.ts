import { describe, expect, it } from "vitest";
import { InvalidAuditFilterError, filterAndPaginate } from "./service.js";
import type { AuditLogEntry } from "./types.js";

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: "auth_audit_log:1",
    source: "auth_audit_log",
    actorType: "human",
    actorId: "user-1",
    action: "sign_in",
    entityType: "user",
    entityId: "user-1",
    occurredAt: "2026-10-16T00:00:00.000Z",
    detail: {},
    correlationId: null,
    ...overrides,
  };
}

describe("filterAndPaginate", () => {
  it("sorts newest first and reports total before pagination", () => {
    const page = filterAndPaginate(
      [
        entry({ id: "a", occurredAt: "2026-10-16T00:00:00.000Z" }),
        entry({ id: "b", occurredAt: "2026-10-16T02:00:00.000Z" }),
        entry({ id: "c", occurredAt: "2026-10-16T01:00:00.000Z" }),
      ],
      {},
    );

    expect(page.entries.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(page.total).toBe(3);
  });

  it("filters by entityType and actorId", () => {
    const entries = [
      entry({ id: "a", entityType: "user", actorId: "user-1" }),
      entry({ id: "b", entityType: "workflow_instance", actorId: null }),
      entry({ id: "c", entityType: "user", actorId: "user-2" }),
    ];

    expect(filterAndPaginate(entries, { entityType: "user" }).entries.map((e) => e.id)).toEqual(["a", "c"]);
    expect(filterAndPaginate(entries, { actorId: "user-1" }).entries.map((e) => e.id)).toEqual(["a"]);
    // workflow_events rows carry no actor column; filtering by any actorId must exclude them, not match on null.
    expect(filterAndPaginate(entries, { actorId: "user-2" }).entries.map((e) => e.id)).toEqual(["c"]);
  });

  it("filters by an inclusive from/to range on occurredAt", () => {
    const entries = [
      entry({ id: "a", occurredAt: "2026-10-14T00:00:00.000Z" }),
      entry({ id: "b", occurredAt: "2026-10-15T00:00:00.000Z" }),
      entry({ id: "c", occurredAt: "2026-10-16T00:00:00.000Z" }),
    ];

    const page = filterAndPaginate(entries, { from: "2026-10-15T00:00:00.000Z", to: "2026-10-15T23:59:59.000Z" });
    expect(page.entries.map((e) => e.id)).toEqual(["b"]);
  });

  it("rejects an unparseable from/to filter instead of silently ignoring it", () => {
    expect(() => filterAndPaginate([], { from: "not-a-date" })).toThrow(InvalidAuditFilterError);
  });

  it("clamps limit to [1, MAX_LIMIT] and never fabricates actorType or correlationId", () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry({ id: `e${i}`, occurredAt: `2026-10-16T0${i}:00:00.000Z` }));

    const page = filterAndPaginate(entries, { limit: 0 });
    expect(page.limit).toBe(1);
    expect(page.entries).toHaveLength(1);

    const overLimit = filterAndPaginate(entries, { limit: 10_000 });
    expect(overLimit.limit).toBe(200);

    for (const e of page.entries) {
      expect(e.actorType).toBe("human");
      expect(e.correlationId).toBeNull();
    }
  });

  it("paginates with offset", () => {
    const entries = Array.from({ length: 5 }, (_, i) => entry({ id: `e${i}`, occurredAt: `2026-10-16T0${i}:00:00.000Z` }));
    const page = filterAndPaginate(entries, { limit: 2, offset: 2 });
    // Newest-first order: e4, e3, e2, e1, e0 — offset 2, limit 2 -> e2, e1.
    expect(page.entries.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(page.total).toBe(5);
  });
});
