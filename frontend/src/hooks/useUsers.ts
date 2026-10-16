import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

export interface DirectoryUser {
  id: string;
  email: string;
  display_name: string | null;
}

/** Backs the shared `<UserPicker>` (GET /admin/users) — every tenant member, for assignee/reviewer/approver pickers. */
export function useUsers() {
  const { session } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[] | null>(null);

  useEffect(() => {
    if (!session) {
      setUsers(null);
      return;
    }
    apiFetch<{ users: DirectoryUser[] }>("/admin/users", session.access_token)
      .then((data) => setUsers(data.users))
      .catch(() => setUsers([]));
  }, [session]);

  return { users, loading: users === null };
}
