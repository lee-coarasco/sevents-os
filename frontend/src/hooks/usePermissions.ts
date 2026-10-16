import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

/** Mirrors the backend's `requirePermission` guard (GET /authority/effective-permissions) so the UI hides/disables the same actions the API would reject. */
export function usePermissions() {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    if (!session) {
      setPermissions(null);
      return;
    }
    apiFetch<{ permissions: string[] }>("/authority/effective-permissions", session.access_token)
      .then((data) => setPermissions(data.permissions))
      .catch(() => setPermissions([]));
  }, [session]);

  return {
    permissions,
    loading: permissions === null,
    has: (permissionKey: string) => permissions?.includes(permissionKey) ?? false,
  };
}
