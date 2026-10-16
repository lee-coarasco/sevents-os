import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
    }
  }

  return (
    <div className="flex min-h-screen font-body">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between bg-zinc-900 px-12 py-14 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand">
            <span className="font-brand text-base font-bold text-zinc-900">S</span>
          </div>
          <span className="font-brand text-xl font-semibold text-white">SEVENTS</span>
        </div>

        <div>
          <p className="font-brand text-3xl font-bold leading-snug text-white">
            Construction ERP<br />
            <span className="text-brand">built for the field.</span>
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
            Workflow automation, approval chains, and project control —
            from tender to handover.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">UAE-first · Multi-tenant · ISO-ready</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-stone-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <span className="font-brand text-sm font-bold text-zinc-900">S</span>
            </div>
            <span className="font-brand text-lg font-semibold text-zinc-900">SEVENTS</span>
          </div>

          <h2 className="font-brand text-2xl font-bold text-zinc-900">Welcome back</h2>
          <p className="mt-1 text-sm text-zinc-500">Sign in to your workspace</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
