import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

interface PermissionsContextValue {
  permissions: string[] | null;
  loading: boolean;
  has: (permissionKey: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

/** Fetches effective permissions once per session and shares them with every PermissionGate in the subtree. */
export function PermissionsProvider({ children }: { children: ReactNode }) {
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

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading: permissions === null,
        has: (permissionKey: string) => permissions?.includes(permissionKey) ?? false,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext(): PermissionsContextValue | null {
  return useContext(PermissionsContext);
}
