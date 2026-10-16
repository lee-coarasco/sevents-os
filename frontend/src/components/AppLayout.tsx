import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"}`;

export function AppLayout() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="text-xl font-semibold text-slate-900">SEVENTS</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{session?.user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="flex">
        <nav className="w-56 shrink-0 space-y-1 border-r border-slate-200 bg-white p-4">
          <NavLink to="/" className={navLinkClass} end>
            Dashboard
          </NavLink>
          <NavLink to="/org-setup" className={navLinkClass}>
            Company / Branch / Project
          </NavLink>
          <NavLink to="/departments-roles" className={navLinkClass}>
            Departments & Roles
          </NavLink>
        </nav>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
