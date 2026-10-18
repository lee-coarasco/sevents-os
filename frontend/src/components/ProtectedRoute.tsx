import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";

interface ProtectedRouteProps {
  permission?: string | string[];
  anyPermission?: string[];
  children: ReactNode;
}

export function ProtectedRoute({
  permission,
  anyPermission,
  children,
}: ProtectedRouteProps) {
  const { has, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-400">
        Checking access permissions…
      </div>
    );
  }

  let authorized = true;
  if (permission) {
    authorized = Array.isArray(permission)
      ? permission.some((p) => has(p))
      : has(permission);
  }
  if (authorized && anyPermission) {
    authorized = anyPermission.some((p) => has(p));
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-100 bg-white p-8 text-center shadow-sm mt-12">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="font-brand text-lg font-bold text-zinc-900">Access Restricted</h2>
        <p className="mt-2 text-sm text-zinc-500">
          You don't have permission to view this section. Please contact your administrator if you need access.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
