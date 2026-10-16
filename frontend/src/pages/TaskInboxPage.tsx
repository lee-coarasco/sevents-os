import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

type StepInstanceStatus = "pending" | "active" | "waiting" | "completed" | "skipped" | "failed";
type TaskPriority = "low" | "normal" | "high" | "urgent";

interface TaskQueueEntry {
  id: string;
  workflow_instance_id: string;
  status: StepInstanceStatus;
  due_at: string | null;
  priority: TaskPriority;
  blocked_reason: string | null;
  nodeType: string;
  nodeKey: string;
}

type Group = "to_do" | "in_progress" | "blocked" | "done";

const GROUP_LABELS: Record<Group, string> = {
  to_do: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-red-50 text-red-700",
};

function groupOf(task: TaskQueueEntry): Group {
  if (task.status === "completed" || task.status === "skipped") return "done";
  if (task.blocked_reason) return "blocked";
  if (task.status === "active") return "in_progress";
  return "to_do";
}

export function TaskInboxPage() {
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();

  const [tasks, setTasks] = useState<TaskQueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    if (!session) return;
    apiFetch<{ items: TaskQueueEntry[] }>("/tasks/my-work", session.access_token)
      .then((data) => setTasks(data.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(load, [session]);

  const selectedTask = tasks?.find((t) => t.id === selectedTaskId) ?? null;
  const canAct = has("workflow.instance.act");

  async function handleComplete() {
    if (!session || !selectedTask) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/workflow/instances/${selectedTask.workflow_instance_id}/steps/${selectedTask.id}/complete`, session.access_token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSelectedTaskId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not complete the task");
    } finally {
      setBusy(false);
    }
  }

  async function handleBlock() {
    if (!session || !selectedTask || !blockReason.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/workflow/steps/${selectedTask.id}/block`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ reason: blockReason.trim() }),
      });
      setBlockReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not block the task");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock() {
    if (!session || !selectedTask) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(`/workflow/steps/${selectedTask.id}/unblock`, session.access_token, { method: "POST" });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not unblock the task");
    } finally {
      setBusy(false);
    }
  }

  const groups: Group[] = ["to_do", "in_progress", "blocked", "done"];
  const grouped = groups.map((group) => ({
    group,
    items: (tasks ?? []).filter((t) => groupOf(t) === group),
  }));

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-8">
        <div>
          <h1 className="font-brand text-2xl font-bold text-zinc-900">My Work</h1>
          <p className="mt-1 text-sm text-zinc-400">Tasks assigned to you, across every workflow</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {tasks === null && <p className="text-sm text-zinc-400">Loading…</p>}
        {tasks?.length === 0 && <p className="text-sm text-zinc-400">No tasks assigned to you right now.</p>}

        {tasks && tasks.length > 0 && (
          <div className="space-y-6">
            {grouped.map(({ group, items }) => (
              <div key={group} className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-6 py-4">
                  <h2 className="font-brand text-base font-semibold text-zinc-900">
                    {GROUP_LABELS[group]} <span className="text-xs font-normal text-zinc-400">({items.length})</span>
                  </h2>
                </div>
                <div className="p-6">
                  {items.length === 0 && <p className="text-sm text-zinc-400">Nothing here.</p>}
                  {items.length > 0 && (
                    <div className="space-y-2">
                      {items.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setActionError(null);
                            setBlockReason("");
                          }}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                            task.id === selectedTaskId
                              ? "border-brand bg-brand-soft"
                              : "border-zinc-100 bg-stone-50 hover:border-zinc-300"
                          }`}
                        >
                          <div>
                            <span className="font-medium text-zinc-800">{task.nodeKey}</span>
                            {task.due_at && (
                              <span className="ml-2 text-xs text-zinc-400">due {new Date(task.due_at).toLocaleDateString()}</span>
                            )}
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="w-80 shrink-0 rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 className="font-brand text-base font-semibold text-zinc-900">Task detail</h2>
            <button onClick={() => setSelectedTaskId(null)} className="text-zinc-400 hover:text-zinc-600">
              ✕
            </button>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Step</p>
              <p className="mt-1 text-sm text-zinc-800">{selectedTask.nodeKey}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</p>
              <p className="mt-1 text-sm text-zinc-800">{GROUP_LABELS[groupOf(selectedTask)]}</p>
            </div>
            {selectedTask.due_at && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Due</p>
                <p className="mt-1 text-sm text-zinc-800">{new Date(selectedTask.due_at).toLocaleString()}</p>
              </div>
            )}
            {selectedTask.blocked_reason && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Blocked reason</p>
                <p className="mt-1 text-sm text-zinc-800">{selectedTask.blocked_reason}</p>
              </div>
            )}

            {actionError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>}

            {!permissionsLoading && canAct && selectedTask.status !== "completed" && selectedTask.status !== "skipped" && (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <button
                  onClick={handleComplete}
                  disabled={busy}
                  className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                >
                  Mark complete
                </button>
                {selectedTask.blocked_reason ? (
                  <button
                    onClick={handleUnblock}
                    disabled={busy}
                    className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Unblock
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Reason for blocking"
                      className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      onClick={handleBlock}
                      disabled={busy || !blockReason.trim()}
                      className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Mark blocked
                    </button>
                  </div>
                )}
              </div>
            )}
            {!permissionsLoading && !canAct && (
              <p className="text-xs text-zinc-400">You don't have permission to act on tasks.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
