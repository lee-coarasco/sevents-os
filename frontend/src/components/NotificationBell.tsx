import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";

interface Notification {
  id: string;
  rendered_subject: string | null;
  rendered_body: string;
  read_at: string | null;
  delivered_at: string | null;
}

const POLL_INTERVAL_MS = 30_000;

/** Header notification bell + inbox, backed by M31's self-service GET/POST /notifications endpoints. */
export function NotificationBell() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function refetch() {
    if (!session) return;
    apiFetch<{ notifications: Notification[] }>("/notifications", session.access_token)
      .then((data) => setNotifications(data.notifications))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    refetch();
    if (!session) return;
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open) refetch();
  }

  async function handleMarkRead(notification: Notification) {
    if (!session || notification.read_at) return;
    setNotifications(
      (prev) => prev?.map((n) => (n.id === notification.id ? { ...n, read_at: new Date(0).toISOString() } : n)) ?? prev,
    );
    try {
      await apiFetch<{ notification: Notification }>(`/notifications/${notification.id}/read`, session.access_token, {
        method: "POST",
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark this notification read");
      refetch();
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-zinc-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-zinc-100 bg-white shadow-lg">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h3 className="font-brand text-sm font-semibold text-zinc-900">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {error && <p className="px-4 py-3 text-xs text-red-700">{error}</p>}
            {!error && notifications === null && <p className="px-4 py-3 text-sm text-zinc-400">Loading…</p>}
            {!error && notifications?.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-400">No notifications yet.</p>
            )}
            {notifications?.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleMarkRead(notification)}
                className={`block w-full border-b border-zinc-50 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-stone-50 ${
                  notification.read_at ? "text-zinc-400" : "bg-brand-soft text-zinc-800"
                }`}
              >
                {notification.rendered_subject && (
                  <p className={`font-medium ${notification.read_at ? "text-zinc-500" : "text-zinc-900"}`}>
                    {notification.rendered_subject}
                  </p>
                )}
                <p className="mt-0.5">{notification.rendered_body}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
