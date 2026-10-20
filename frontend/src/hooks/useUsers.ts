import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

export interface DirectoryUser {
  id: string;
  email: string;
  display_name: string | null;
}

let cachedUsers: DirectoryUser[] | null = null;

/** Backs the shared `<UserPicker>` (GET /admin/users) — every tenant member, for assignee/reviewer/approver pickers. */
export function useUsers() {
  const { session } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[] | null>(() => cachedUsers);

  useEffect(() => {
    if (!session) {
      cachedUsers = null;
      setUsers(null);
      return;
    }
    apiFetch<{ users: DirectoryUser[] }>("/admin/users", session.access_token)
      .then((data) => {
        cachedUsers = data.users;
        setUsers(data.users);
      })
      .catch(() => {
        if (!cachedUsers) setUsers([]);
      });
  }, [session]);

  return { users, loading: users === null };
}
