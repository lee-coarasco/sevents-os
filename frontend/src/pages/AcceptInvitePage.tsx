import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";

/**
 * Handles Supabase invite email links, which arrive as:
 *   <APP_URL>/accept-invite#access_token=TOKEN&refresh_token=...&type=invite
 *
 * Steps:
 * 1. Supabase JS client auto-detects the hash and signs the user in.
 * 2. We prompt them to set a password (invited users have no password).
 * 3. After password is set, call POST /identity/accept-invite so the
 *    backend marks them active in app_users.
 * 4. Redirect to the app dashboard.
 */
export function AcceptInvitePage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Supabase auto-parses #access_token from the hash on getSession()/onAuthStateChange.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        setSessionReady(true);
      } else {
        setError("Invalid or expired invite link. Please ask your administrator to resend the invitation.");
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw new Error(updateErr.message);

      // Activate the app_users row via the backend.
      if (accessToken) {
        await apiFetch("/identity/accept-invite", accessToken, { method: "POST" });
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 font-body">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
            <span className="font-brand text-sm font-bold text-zinc-900">S</span>
          </div>
          <span className="font-brand text-xl font-semibold text-zinc-900">SEVENTS</span>
        </div>

        <h1 className="font-brand text-xl font-bold text-zinc-900">Accept your invitation</h1>
        <p className="mt-1 text-sm text-zinc-500">Set a password to activate your account.</p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!sessionReady && !error && (
          <p className="mt-6 text-sm text-zinc-400">Verifying invite link…</p>
        )}

        {sessionReady && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
            >
              {submitting ? "Activating…" : "Set password & continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
