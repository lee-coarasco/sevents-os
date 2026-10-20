import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { UserPicker } from "../components/UserPicker";
import { ActivityThread } from "../components/ActivityThread";
import { usePermissions } from "../hooks/usePermissions";

type StepInstanceStatus = "pending" | "active" | "waiting" | "completed" | "skipped" | "failed";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type ApprovalChainDecision = "approved" | "approved_with_conditions" | "rejected" | "returned_for_correction";

interface TaskQueueEntry {
  id: string;
  workflow_instance_id: string;
  status: StepInstanceStatus;
  due_at: string | null;
  priority: TaskPriority;
  nodeType: string;
  nodeKey: string;
}

interface ApprovalDecisionRecord {
  id: string;
  approver_id: string;
  decision: ApprovalChainDecision;
  reason: string | null;
  decided_at: string;
}

interface TaskComment {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

interface ApprovalDetail {
  stepInstance: TaskQueueEntry;
  decisions: ApprovalDecisionRecord[];
  requestContext: Record<string, unknown>;
  comments: TaskComment[];
  authorityCheck: { configured: boolean; withinLimit: boolean | null };
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

const decisionLabels: Record<ApprovalChainDecision, string> = {
  approved: "Approved",
  approved_with_conditions: "Approved with conditions",
  rejected: "Rejected",
  returned_for_correction: "Returned for correction",
};

export function ApprovalQueuePage() {
  const { session } = useAuth();
  const { has } = usePermissions();

  const [approvals, setApprovals] = useState<TaskQueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [delegateUserId, setDelegateUserId] = useState("");
  const [delegateReason, setDelegateReason] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    if (!session) return;
    apiFetch<{ items: TaskQueueEntry[] }>("/tasks/waiting-approval", session.access_token)
      .catch(() => apiFetch<{ items: TaskQueueEntry[] }>("/tasks/my-work", session.access_token))
      .then((data) => setApprovals((data?.items ?? []).filter((t) => t.nodeType === "request_approval")))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(load, [session]);

  function loadDetail() {
    if (!session || !selectedId) {
      setDetail(null);
      return;
    }
    setDetailError(null);
    apiFetch<{ detail: ApprovalDetail }>(`/approvals/${selectedId}`, session.access_token)
      .then((data) => setDetail(data.detail))
      .catch((err) => setDetailError(err instanceof ApiError ? err.message : "Could not load this approval"));
  }

  useEffect(() => {
    setDetail(null);
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, selectedId]);

  async function postComment(body: string) {
    if (!session || !selectedId) return;
    await apiFetch(`/workflow/steps/${selectedId}/comments`, session.access_token, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    loadDetail();
  }

  function selectApproval(id: string) {
    setSelectedId(id);
    setReason("");
    setDelegateUserId("");
    setDelegateReason("");
  }

  async function decide(decision: ApprovalChainDecision) {
    if (!session || !selectedId) return;
    if (decision !== "approved" && !reason.trim()) {
      setDetailError("A reason is required to reject or return for correction.");
      return;
    }
    setBusy(true);
    setDetailError(null);
    try {
      await apiFetch(`/approvals/${selectedId}/decide`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ decision, reason: reason.trim() || null }),
      });
      setSelectedId(null);
      load();
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Could not record this decision");
    } finally {
      setBusy(false);
    }
  }

  async function delegate() {
    if (!session || !selectedId || !delegateUserId.trim()) return;
    setBusy(true);
    setDetailError(null);
    try {
      await apiFetch(`/tasks/${selectedId}/delegate`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ delegateUserId: delegateUserId.trim(), reason: delegateReason.trim() || null }),
      });
      setSelectedId(null);
      load();
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Could not delegate this approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="font-brand text-2xl font-bold text-zinc-900">Approval Queue</h1>
          <p className="mt-1 text-sm text-zinc-400">Approvals waiting on your decision</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {approvals === null && <p className="text-sm text-zinc-400">Loading…</p>}
        {approvals?.length === 0 && <p className="text-sm text-zinc-400">No approvals are waiting on you right now.</p>}

        {approvals && approvals.length > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="space-y-2 p-6">
              {approvals.map((approval) => (
                <button
                  key={approval.id}
                  onClick={() => selectApproval(approval.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                    approval.id === selectedId
                      ? "border-brand bg-brand-soft"
                      : "border-zinc-100 bg-stone-50 hover:border-zinc-300"
                  }`}
                >
                  <div>
                    <span className="font-medium text-zinc-800">{approval.nodeKey}</span>
                    {approval.due_at && (
                      <span className="ml-2 text-xs text-zinc-400">due {new Date(approval.due_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[approval.priority]}`}>
                    {approval.priority}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="w-96 shrink-0 rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="font-brand text-base font-semibold text-zinc-900">Approval detail</h2>
            <button onClick={() => setSelectedId(null)} className="text-zinc-400 hover:text-zinc-600">
              ✕
            </button>
          </div>
          <div className="space-y-4 p-6">
            {detail === null && !detailError && <p className="text-sm text-zinc-400">Loading…</p>}
            {detailError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{detailError}</div>}

            {detail && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Step</p>
                  <p className="mt-1 text-sm text-zinc-800">{detail.stepInstance.nodeKey}</p>
                </div>

                {detail.authorityCheck.configured && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Authority limit</p>
                    <p className="mt-1 text-sm text-zinc-800">
                      {detail.authorityCheck.withinLimit === null
                        ? "Could not be checked"
                        : detail.authorityCheck.withinLimit
                          ? "Within your limit"
                          : "Exceeds your approval limit"}
                    </p>
                  </div>
                )}

                {Object.keys(detail.requestContext).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Request details</p>
                    <dl className="mt-1 space-y-1">
                      {Object.entries(detail.requestContext).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2 text-sm">
                          <dt className="text-zinc-400">{key}</dt>
                          <dd className="truncate text-zinc-800">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                <ActivityThread
                  comments={detail.comments}
                  decisions={detail.decisions}
                  decisionLabels={decisionLabels}
                  onPostComment={postComment}
                  canPost={has("workflow.instance.act")}
                  busy={busy}
                />

                <div className="space-y-2 border-t border-zinc-100 pt-4">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Comment (required if rejecting)"
                    rows={3}
                    className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide("approved")}
                      disabled={busy}
                      className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide("rejected")}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide("approved_with_conditions")}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Approve with conditions
                    </button>
                    <button
                      onClick={() => decide("returned_for_correction")}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Return for correction
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Delegate</p>
                  <UserPicker value={delegateUserId} onChange={setDelegateUserId} placeholder="Delegate to…" />
                  <input
                    value={delegateReason}
                    onChange={(e) => setDelegateReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    onClick={delegate}
                    disabled={busy || !delegateUserId.trim()}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Delegate this approval
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
