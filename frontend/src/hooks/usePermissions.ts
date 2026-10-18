import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { usePermissionsContext } from "../context/PermissionsContext";

/** Reads effective permissions from the top-level PermissionsProvider when available, or falls back to local fetch (e.g. in standalone test renders). */
export function usePermissions() {
  const ctx = usePermissionsContext();
  const { session } = useAuth();
  const [localPermissions, setLocalPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    if (ctx) return;
    if (!session) {
      setLocalPermissions(null);
      return;
    }
    apiFetch<{ permissions: string[] }>("/authority/effective-permissions", session.access_token)
      .then((data) => setLocalPermissions(data.permissions))
      .catch(() => setLocalPermissions([]));
  }, [ctx, session]);

  if (ctx) return ctx;

  return {
    permissions: localPermissions,
    loading: localPermissions === null,
    has: (permissionKey: string) => localPermissions?.includes(permissionKey) ?? false,
  };
}
