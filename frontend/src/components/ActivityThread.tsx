import { useMemo, useState } from "react";
import { useUsers } from "../hooks/useUsers";

export interface ActivityComment {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface ActivityDecision {
  id: string;
  approver_id: string;
  decision: string;
  reason: string | null;
  decided_at: string;
}

interface ActivityThreadProps {
  comments: ActivityComment[];
  decisions?: ActivityDecision[];
  decisionLabels?: Record<string, string>;
  onPostComment?: (body: string) => Promise<void>;
  canPost?: boolean;
  busy?: boolean;
}

type ThreadEntry =
  | { kind: "comment"; at: string; comment: ActivityComment }
  | { kind: "decision"; at: string; decision: ActivityDecision };

/** Shared comment + decision history, backed by whatever module already fetched its own comments/decisions (task_comments, approval_decisions) — no generic entity-keyed table exists yet, see ticket 0133/0145. */
export function ActivityThread({
  comments,
  decisions = [],
  decisionLabels = {},
  onPostComment,
  canPost = false,
  busy = false,
}: ActivityThreadProps) {
  const { users } = useUsers();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  function label(userId: string | null): string {
    if (!userId) return "Unknown";
    const user = users?.find((u) => u.id === userId);
    return user ? (user.display_name ?? user.email) : userId;
  }

  const entries = useMemo<ThreadEntry[]>(() => {
    const items: ThreadEntry[] = [
      ...comments.map((c) => ({ kind: "comment" as const, at: c.created_at, comment: c })),
      ...decisions.map((d) => ({ kind: "decision" as const, at: d.decided_at, decision: d })),
    ];
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [comments, decisions]);

  async function handlePost() {
    if (!onPostComment || !draft.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await onPostComment(draft.trim());
      setDraft("");
    } catch {
      setPostError("Could not post this comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Activity</p>
      {entries.length === 0 && <p className="text-sm text-zinc-400">No activity yet.</p>}
      {entries.length > 0 && (
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {entries.map((entry) =>
            entry.kind === "comment" ? (
              <div key={`comment-${entry.comment.id}`} className="rounded-lg bg-stone-50 px-3 py-2 text-xs">
                <div className="flex justify-between gap-2 text-zinc-400">
                  <span className="font-medium text-zinc-600">{label(entry.comment.author_id)}</span>
                  <span>{new Date(entry.comment.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-zinc-800">{entry.comment.body}</p>
              </div>
            ) : (
              <div key={`decision-${entry.decision.id}`} className="rounded-lg bg-brand-soft px-3 py-2 text-xs">
                <div className="flex justify-between gap-2 text-zinc-400">
                  <span className="font-medium text-zinc-600">{label(entry.decision.approver_id)}</span>
                  <span>{new Date(entry.decision.decided_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 font-medium text-zinc-800">{decisionLabels[entry.decision.decision] ?? entry.decision.decision}</p>
                {entry.decision.reason && <p className="mt-1 text-zinc-600">{entry.decision.reason}</p>}
              </div>
            ),
          )}
        </div>
      )}
      {canPost && onPostComment && (
        <div className="space-y-2">
          {postError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{postError}</div>}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            onClick={handlePost}
            disabled={posting || busy || !draft.trim()}
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            Post comment
          </button>
        </div>
      )}
    </div>
  );
}
