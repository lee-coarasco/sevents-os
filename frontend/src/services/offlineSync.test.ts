import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveOfflineDraft,
  getOfflineDrafts,
  removeOfflineDraft,
  assertNoOfflineFinancialAction,
  OfflineFinancialPolicyError,
  syncSingleDraft,
} from "./offlineSync";

describe("Module M37: Offline Sync & Field Storage Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores and retrieves offline field drafts", () => {
    const draft = saveOfflineDraft("dpr", "Site Diary - Project Alpha", {
      weather: "Sunny 34°C",
      manpower: 45,
    }, "proj-1", "Project Alpha");

    expect(draft.id).toBeDefined();
    expect(draft.status).toBe("pending");
    expect(draft.title).toBe("Site Diary - Project Alpha");

    const allDrafts = getOfflineDrafts();
    expect(allDrafts).toHaveLength(1);
    expect(allDrafts[0].title).toBe("Site Diary - Project Alpha");

    const dprDrafts = getOfflineDrafts("dpr");
    expect(dprDrafts).toHaveLength(1);

    const hazardDrafts = getOfflineDrafts("safety_hazard");
    expect(hazardDrafts).toHaveLength(0);
  });

  it("removes an offline draft by ID", () => {
    const draft = saveOfflineDraft("safety_hazard", "Unsecured scaffolding Block B", {
      severity: "high",
    });

    expect(getOfflineDrafts()).toHaveLength(1);
    removeOfflineDraft(draft.id);
    expect(getOfflineDrafts()).toHaveLength(0);
  });

  it("enforces BRD §7 strict financial policy by blocking offline approvals", () => {
    expect(() => {
      assertNoOfflineFinancialAction("payment_application");
    }).toThrow(OfflineFinancialPolicyError);

    expect(() => {
      assertNoOfflineFinancialAction("purchase_order");
    }).toThrow(OfflineFinancialPolicyError);

    expect(() => {
      assertNoOfflineFinancialAction("invoice");
    }).toThrow(OfflineFinancialPolicyError);

    expect(() => {
      assertNoOfflineFinancialAction("variation_claim");
    }).toThrow(OfflineFinancialPolicyError);

    // Permitted field types do not throw
    expect(() => {
      assertNoOfflineFinancialAction("dpr");
    }).not.toThrow();
  });

  it("handles conflict HTTP 409 from server during sync", async () => {
    const draft = saveOfflineDraft("dpr", "Test Conflict DPR", { notes: "test" });

    // Mock fetch returning 409 Conflict
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: "Conflict detected" }),
      })
    );

    const res = await syncSingleDraft(draft, "test-token");
    expect(res.success).toBe(false);
    expect(res.error).toContain("Conflict");

    const updated = getOfflineDrafts()[0];
    expect(updated.status).toBe("conflict");
  });
});
