import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  status: "pending" | "active" | "deactivated";
  invited_at: string;
}

interface RoleDefinition {
  id: string;
  name: string;
}

interface RoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  role?: { name: string };
}

export function AdminUsersPage() {
  const { session } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  // Edit display name
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Assign role
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiFetch<{ users: AppUser[] }>("/admin/users", session.access_token),
      apiFetch<{ roles: RoleDefinition[] }>("/authority/roles", session.access_token).catch(() => ({ roles: [] })),
      apiFetch<{ roleAssignments: RoleAssignment[] }>("/authority/role-assignments", session.access_token).catch(
        () => ({ roleAssignments: [] }),
      ),
    ])
      .then(([usersData, rolesData, assignmentsData]) => {
        setUsers(usersData.users);
        setRoles(rolesData.roles);
        setAssignments(assignmentsData.roleAssignments);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load users"))
      .finally(() => setLoading(false));
  }, [session]);

  function getRoleForUser(userId: string): string {
    const assignment = assignments.find((a) => a.user_id === userId);
    if (!assignment) return "—";
    const role = roles.find((r) => r.id === assignment.role_id);
    return role?.name ?? assignment.role_id;
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!session || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const { user } = await apiFetch<{ user: AppUser }>("/identity/invite", session.access_token, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), displayName: inviteName.trim() || undefined }),
      });
      setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
      setInviteEmail("");
      setInviteName("");
      setSuccess(`Invitation sent to ${user.email}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleSaveName(userId: string) {
    if (!session) return;
    setSavingEdit(true);
    setError(null);
    try {
      const { user } = await apiFetch<{ user: AppUser }>(`/admin/users/${userId}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ displayName: editName.trim() || null }),
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeactivate(user: AppUser) {
    if (!session) return;
    setError(null);
    try {
      const { user: updated } = await apiFetch<{ user: AppUser }>("/identity/deactivate", session.access_token, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccess(`${user.email} deactivated`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deactivate user");
    }
  }

  async function handlePasswordReset(user: AppUser) {
    if (!session) return;
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(`/admin/users/${user.id}/reset-password`, session.access_token, {
        method: "POST",
      });
      setSuccess(`Password reset email sent to ${user.email}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send password reset");
    }
  }

  async function handleAssignRole(userId: string) {
    if (!session || !assignRoleId) return;
    setSavingRole(true);
    setError(null);
    try {
      const { roleAssignment } = await apiFetch<{ roleAssignment: RoleAssignment }>(
        "/authority/role-assignments",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({ userId, roleId: assignRoleId }),
        },
      );
      setAssignments((prev) => [...prev.filter((a) => a.user_id !== userId), roleAssignment]);
      setAssigningUserId(null);
      setAssignRoleId("");
      setSuccess("Role assigned");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign role");
    } finally {
      setSavingRole(false);
    }
  }

  const statusColor = (status: AppUser["status"]) => {
    if (status === "active") return "bg-emerald-50 text-emerald-700";
    if (status === "pending") return "bg-brand-soft text-brand-dim";
    return "bg-zinc-100 text-zinc-500";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">User Management</h1>
        <p className="mt-1 text-sm text-zinc-400">Invite users, assign roles, and manage access</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      {/* Invite form */}
      <PermissionGate permission="identity.user.invite">
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="font-brand text-base font-semibold text-zinc-900">Invite a new user</h2>
          </div>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 p-6">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Email address</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Display name (optional)
              </label>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1.5 block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
        </div>
      </PermissionGate>

      {/* Users table */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">All users</h2>
        </div>
        <div className="overflow-x-auto">
          {loading && <p className="p-6 text-sm text-zinc-400">Loading…</p>}
          {!loading && users.length === 0 && <p className="p-6 text-sm text-zinc-400">No users found.</p>}
          {!loading && users.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="px-6 py-3">Name / Email</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Invited</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-zinc-100 align-top">
                    <td className="px-6 py-3">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-brand"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveName(user.id)}
                            className="text-xs font-medium text-brand hover:underline"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-zinc-800">{user.display_name ?? "—"}</div>
                          <div className="text-xs text-zinc-400">{user.email}</div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {assigningUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={assignRoleId}
                            onChange={(e) => setAssignRoleId(e.target.value)}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-brand"
                          >
                            <option value="">Choose role…</option>
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={savingRole || !assignRoleId}
                            onClick={() => handleAssignRole(user.id)}
                            className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
                          >
                            {savingRole ? "Saving…" : "Assign"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssigningUserId(null)}
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-600">{getRoleForUser(user.id)}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-xs text-zinc-400">
                      {new Date(user.invited_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <PermissionGate permission="identity.user.invite">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditName(user.display_name ?? "");
                            }}
                            className="text-xs text-zinc-500 underline-offset-2 hover:text-brand hover:underline"
                          >
                            Edit name
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningUserId(user.id);
                              setAssignRoleId("");
                            }}
                            className="text-xs text-zinc-500 underline-offset-2 hover:text-brand hover:underline"
                          >
                            Assign role
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasswordReset(user)}
                            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
                          >
                            Reset pw
                          </button>
                          {user.status !== "deactivated" && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(user)}
                              className="text-xs text-red-500 underline-offset-2 hover:text-red-700 hover:underline"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
