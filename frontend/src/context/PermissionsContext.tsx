import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

const PERMISSIONS_STORAGE_KEY_PREFIX = "sevents:permissions:";

export function clearPermissionsCache(userId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(`${PERMISSIONS_STORAGE_KEY_PREFIX}${userId}`);
    } else {
      // Clear any stored permissions keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PERMISSIONS_STORAGE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {
    // ignore
  }
}

interface PermissionsContextValue {
  permissions: string[] | null;
  loading: boolean;
  has: (permissionKey: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

/**
 * Provides user permissions with immediate localStorage hydration on page reload,
 * followed by a non-blocking background refresh to guarantee zero sidebar delay.
 */
export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id || session?.user?.email;
  const storageKey = userId ? `${PERMISSIONS_STORAGE_KEY_PREFIX}${userId}` : null;

  // Synchronously initialize permissions from localStorage so UI renders immediately
  const [permissions, setPermissions] = useState<string[] | null>(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    if (!session || !storageKey) {
      setPermissions(null);
      return;
    }

    let isCancelled = false;
    apiFetch<{ permissions: string[] }>("/authority/effective-permissions", session.access_token)
      .then((data) => {
        if (!isCancelled) {
          const fresh = data.permissions || [];
          setPermissions(fresh);
          try {
            localStorage.setItem(storageKey, JSON.stringify(fresh));
          } catch {
            // ignore localStorage quota errors
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          // If we had no cached permissions, resolve loading with empty list
          setPermissions((prev) => prev ?? []);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [session, storageKey]);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        loading: permissions === null,
        has: (permissionKey: string) => {
          if (!permissions) return false;
          if (permissions.includes("*")) return true;
          return permissions.includes(permissionKey);
        },
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext(): PermissionsContextValue | null {
  return useContext(PermissionsContext);
}
