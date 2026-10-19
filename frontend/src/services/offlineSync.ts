/**
 * Module M37: Mobile/PWA & Offline Site Mode
 * Offline Storage, Financial Guardrail & Background Sync Queue
 */

export type OfflineEntityType = "dpr" | "safety_hazard" | "quality_inspection";

export type OfflineDraftStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export interface OfflineDraft<T = Record<string, unknown>> {
  id: string;
  type: OfflineEntityType;
  title: string;
  projectId?: string;
  projectName?: string;
  payload: T;
  status: OfflineDraftStatus;
  lastSavedAt: string;
  errorMessage?: string;
  retryCount: number;
}

const STORAGE_KEY = "sevents:offline_drafts_v1";

/**
 * BRD §7 (M37) Strict Financial Policy:
 * "Do not permit offline financial approvals without explicit policy."
 */
const FORBIDDEN_OFFLINE_FINANCIAL_ENTITIES = new Set([
  "payment_application",
  "purchase_order",
  "variation_claim",
  "invoice",
  "retention_release",
  "commercial_tender_quote",
  "expense_claim_approval",
]);

export class OfflineFinancialPolicyError extends Error {
  constructor(entity: string) {
    super(
      `Offline financial and commercial approvals for "${entity}" are strictly prohibited by company policy (BRD §7 M37). Network connectivity is required.`
    );
    this.name = "OfflineFinancialPolicyError";
  }
}

export function assertNoOfflineFinancialAction(entityType: string): void {
  if (FORBIDDEN_OFFLINE_FINANCIAL_ENTITIES.has(entityType.toLowerCase())) {
    throw new OfflineFinancialPolicyError(entityType);
  }
}

/**
 * Load all offline drafts from localStorage
 */
export function getOfflineDrafts(type?: OfflineEntityType): OfflineDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const drafts: OfflineDraft[] = JSON.parse(raw);
    if (type) {
      return drafts.filter((d) => d.type === type);
    }
    return drafts;
  } catch (err) {
    console.error("[OfflineSync] Failed to read drafts from storage:", err);
    return [];
  }
}

/**
 * Save or update an offline draft
 */
export function saveOfflineDraft<T = Record<string, unknown>>(
  type: OfflineEntityType,
  title: string,
  payload: T,
  projectId?: string,
  projectName?: string,
  existingId?: string
): OfflineDraft<T> {
  // Guard against any financial entities
  assertNoOfflineFinancialAction(type);

  const drafts = getOfflineDrafts();
  const id = existingId || "draft_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const now = new Date().toISOString();

  const newDraft: OfflineDraft<T> = {
    id,
    type,
    title,
    projectId,
    projectName,
    payload,
    status: "pending",
    lastSavedAt: now,
    retryCount: 0,
  };

  const existingIndex = drafts.findIndex((d) => d.id === id);
  if (existingIndex >= 0) {
    drafts[existingIndex] = newDraft as unknown as OfflineDraft;
  } else {
    drafts.unshift(newDraft as unknown as OfflineDraft);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error("[OfflineSync] Local storage quota exceeded or failed to save:", err);
  }

  return newDraft;
}

/**
 * Remove an offline draft
 */
export function removeOfflineDraft(id: string): void {
  try {
    const drafts = getOfflineDrafts().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error("[OfflineSync] Failed to remove draft:", err);
  }
}

/**
 * Update draft status and error info
 */
export function updateDraftStatus(
  id: string,
  status: OfflineDraftStatus,
  errorMessage?: string
): void {
  try {
    const drafts = getOfflineDrafts().map((d) => {
      if (d.id === id) {
        return {
          ...d,
          status,
          errorMessage,
          retryCount: status === "failed" ? d.retryCount + 1 : d.retryCount,
        };
      }
      return d;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error("[OfflineSync] Failed to update draft status:", err);
  }
}

/**
 * Dispatches a single draft to the appropriate backend API
 */
export async function syncSingleDraft(draft: OfflineDraft, token?: string): Promise<{ success: boolean; error?: string }> {
  assertNoOfflineFinancialAction(draft.type);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let endpoint = "";
  if (draft.type === "dpr") {
    endpoint = `${apiUrl}/site/dprs`;
  } else if (draft.type === "safety_hazard") {
    endpoint = `${apiUrl}/safety/hazards`;
  } else if (draft.type === "quality_inspection") {
    endpoint = `${apiUrl}/quality/inspections`;
  } else {
    throw new Error(`Unsupported offline sync entity: ${draft.type}`);
  }

  updateDraftStatus(draft.id, "syncing");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(draft.payload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const message = errJson.message || `Sync failed with HTTP ${response.status}`;
      // Conflict detection
      if (response.status === 409) {
        updateDraftStatus(draft.id, "conflict", "Conflict: Record was modified elsewhere on the server.");
        return { success: false, error: "Conflict: Record modified on server" };
      }
      updateDraftStatus(draft.id, "failed", message);
      return { success: false, error: message };
    }

    // Success: mark synced then clean up or retain
    updateDraftStatus(draft.id, "synced");
    // Optionally remove synced items after 3 seconds
    setTimeout(() => {
      removeOfflineDraft(draft.id);
    }, 3000);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error during sync";
    updateDraftStatus(draft.id, "failed", message);
    return { success: false, error: message };
  }
}

/**
 * Attempt to sync all pending or failed drafts
 */
export async function syncAllOfflineDrafts(token?: string): Promise<{ synced: number; failed: number; remaining: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, remaining: getOfflineDrafts().length };
  }

  const drafts = getOfflineDrafts().filter((d) => d.status === "pending" || d.status === "failed");
  let synced = 0;
  let failed = 0;

  for (const draft of drafts) {
    const res = await syncSingleDraft(draft, token);
    if (res.success) {
      synced++;
    } else {
      failed++;
    }
  }

  const remaining = getOfflineDrafts().filter((d) => d.status !== "synced").length;
  return { synced, failed, remaining };
}
