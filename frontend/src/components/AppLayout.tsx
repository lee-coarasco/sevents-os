import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand text-zinc-900"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

export function AppLayout() {
  const { session } = useAuth();
  const initials = session?.user.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="flex min-h-screen bg-stone-50 font-body">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-zinc-900">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <span className="font-brand text-sm font-bold text-zinc-900">S</span>
          </div>
          <span className="font-brand text-base font-semibold tracking-wide text-white">
            SEVENTS
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 pb-4">
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Overview
          </p>
          <NavLink to="/" className={navLinkClass} end>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </NavLink>

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Configuration
          </p>
          <NavLink to="/org-setup" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Company / Branch / Project
          </NavLink>
          <NavLink to="/departments-roles" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Departments &amp; Roles
          </NavLink>

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Work
          </p>
          <NavLink to="/my-work" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            My Work
          </NavLink>
          <NavLink to="/approvals" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approvals
          </NavLink>

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Projects
          </p>
          <NavLink to="/projects" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Projects
          </NavLink>

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Workforce
          </p>
          <NavLink to="/employees" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Employee Directory
          </NavLink>
        </nav>

        {/* User footer */}
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-300">{session?.user.email}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              title="Sign out"
              className="rounded p-1 text-zinc-500 hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-100 bg-white px-8">
          <div />
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
              Feedback
            </button>
          </div>
        </header>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
