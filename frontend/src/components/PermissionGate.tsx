import type { ReactNode } from "react";
import { usePermissions } from "../hooks/usePermissions";

interface PermissionGateProps {
  permission?: string | string[];
  anyPermission?: string[];
  children: ReactNode;
  /** Rendered instead of nothing while the permission set is still loading, or when it's missing — omit to render nothing. */
  fallback?: ReactNode;
}

/** Hides an action when the caller's effective permissions (GET /auth/effective-permissions) don't include it — never show a button that would 403. */
export function PermissionGate({
  permission,
  anyPermission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { has, loading } = usePermissions();
  if (loading) return null;

  if (permission) {
    if (Array.isArray(permission)) {
      if (!permission.some((p) => has(p))) return <>{fallback}</>;
    } else {
      if (!has(permission)) return <>{fallback}</>;
    }
  }

  if (anyPermission) {
    if (!anyPermission.some((p) => has(p))) return <>{fallback}</>;
  }

  return <>{children}</>;
}
