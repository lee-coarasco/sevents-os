import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "./PermissionGate";
import { usePermissions } from "../hooks/usePermissions";

export interface PermissionDefinition {
  id: string;
  description: string;
}

export interface RoleItem {
  id: string;
  label: string;
  is_platform_role: boolean;
  department_cluster: string | null;
}

interface RolePermissionsMatrixProps {
  roles: RoleItem[];
  selectedRoleId?: string;
  onSelectRoleId?: (roleId: string) => void;
}

interface DomainGroup {
  title: string;
  prefixes: string[];
}

const DOMAIN_GROUPS: DomainGroup[] = [
  { title: "Authority & Security", prefixes: ["authority.", "tenancy."] },
  { title: "Workflows & Automation", prefixes: ["workflow."] },
  { title: "Catalogue & Scope Matrix", prefixes: ["catalogue."] },
  { title: "Projects, WBS & Baselines", prefixes: ["project.", "baseline."] },
  { title: "Tasks & Work Orders", prefixes: ["task."] },
  { title: "Workforce & Directory", prefixes: ["workforce."] },
  { title: "Approvals & Delegations", prefixes: ["approval.", "delegation."] },
  { title: "CRM & Pipelines", prefixes: ["crm."] },
  { title: "Engineering & Documents", prefixes: ["design.", "rfi.", "as_built.", "document."] },
  { title: "Master Data & Codes", prefixes: ["master-data."] },
  { title: "Notifications & SLAs", prefixes: ["notification.", "sla."] },
  { title: "Audit & Compliance", prefixes: ["audit.", "retention.", "data_request."] },
];

export function RolePermissionsMatrix({
  roles,
  selectedRoleId: controlledRoleId,
  onSelectRoleId,
}: RolePermissionsMatrixProps) {
  const { session } = useAuth();
  const { has: hasPerm } = usePermissions();
  const canManageRoles = hasPerm("authority.role.manage");

  const [activeRoleId, setActiveRoleId] = useState<string>("");
  const [allPermissions, setAllPermissions] = useState<PermissionDefinition[] | null>(null);
  const [assignedPerms, setAssignedPerms] = useState<Set<string>>(new Set());
  const [initialPerms, setInitialPerms] = useState<Set<string>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync active role with props or default to first role
  useEffect(() => {
    if (controlledRoleId) {
      setActiveRoleId(controlledRoleId);
    } else if (!activeRoleId && roles.length > 0) {
      setActiveRoleId(roles[0].id);
    }
  }, [controlledRoleId, roles, activeRoleId]);

  // Fetch all system permissions once
  useEffect(() => {
    if (!session) return;
    apiFetch<{ permissions: PermissionDefinition[] }>("/authority/permissions", session.access_token)
      .then((data) => {
        setAllPermissions(data.permissions);
      })
      .catch((err) => {
        setFeedback({
          type: "error",
          message: err instanceof ApiError ? err.message : "Failed to load permissions list",
        });
      });
  }, [session]);

  // Fetch assigned permissions for current role
  useEffect(() => {
    if (!session || !activeRoleId) return;
    setLoadingPerms(true);
    setFeedback(null);
    apiFetch<{ permissions: string[] }>(`/authority/roles/${activeRoleId}/permissions`, session.access_token)
      .then((data) => {
        const permSet = new Set(data.permissions || []);
        setAssignedPerms(permSet);
        setInitialPerms(new Set(permSet));
      })
      .catch((err) => {
        setFeedback({
          type: "error",
          message: err instanceof ApiError ? err.message : "Failed to load role permissions",
        });
      })
      .finally(() => {
        setLoadingPerms(false);
      });
  }, [session, activeRoleId]);

  const handleRoleChange = (roleId: string) => {
    setActiveRoleId(roleId);
    if (onSelectRoleId) onSelectRoleId(roleId);
  };

  const togglePermission = (id: string) => {
    if (!canManageRoles) return;
    setAssignedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectGroup = (permIds: string[], select: boolean) => {
    if (!canManageRoles) return;
    setAssignedPerms((prev) => {
      const next = new Set(prev);
      for (const id of permIds) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (!canManageRoles || !allPermissions) return;
    if (select) {
      setAssignedPerms(new Set(allPermissions.map((p) => p.id)));
    } else {
      setAssignedPerms(new Set());
    }
  };

  const handleReset = () => {
    setAssignedPerms(new Set(initialPerms));
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!session || !activeRoleId || !canManageRoles) return;
    setSaving(true);
    setFeedback(null);
    try {
      const permissionIds = Array.from(assignedPerms);
      await apiFetch<{ success: boolean; permissions: string[] }>(
        `/authority/roles/${activeRoleId}/permissions`,
        session.access_token,
        {
          method: "PUT",
          body: JSON.stringify({ permissionIds }),
        },
      );
      setInitialPerms(new Set(assignedPerms));
      const roleObj = roles.find((r) => r.id === activeRoleId);
      setFeedback({
        type: "success",
        message: `Permissions updated successfully for ${roleObj?.label ?? activeRoleId}.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof ApiError ? err.message : "Failed to save permissions",
      });
    } finally {
      setSaving(false);
    }
  };

  // Compute dirty count (added / removed)
  const isDirty = useMemo(() => {
    if (assignedPerms.size !== initialPerms.size) return true;
    for (const p of assignedPerms) {
      if (!initialPerms.has(p)) return true;
    }
    return false;
  }, [assignedPerms, initialPerms]);

  // Group filtered permissions by domain
  const groupedPermissions = useMemo(() => {
    if (!allPermissions) return [];
    const query = searchQuery.trim().toLowerCase();
    const filtered = allPermissions.filter((p) => {
      if (!query) return true;
      return p.id.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query));
    });

    const groups: { title: string; permissions: PermissionDefinition[] }[] = [];
    const assignedIds = new Set<string>();

    for (const group of DOMAIN_GROUPS) {
      const perms = filtered.filter((p) => group.prefixes.some((prefix) => p.id.startsWith(prefix)));
      if (perms.length > 0) {
        groups.push({ title: group.title, permissions: perms });
        for (const p of perms) assignedIds.add(p.id);
      }
    }

    const otherPerms = filtered.filter((p) => !assignedIds.has(p.id));
    if (otherPerms.length > 0) {
      groups.push({ title: "General & Other", permissions: otherPerms });
    }

    return groups;
  }, [allPermissions, searchQuery]);

  const selectedRole = roles.find((r) => r.id === activeRoleId);

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-zinc-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-brand text-base font-semibold text-zinc-900">Dynamic Role Permissions Matrix</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Dynamically grant or revoke granular permissions per role. Changes take effect across the entire system immediately.
          </p>
        </div>

        {/* Global Save / Reset controls */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Reset
            </button>
          )}

          <PermissionGate
            permission="authority.role.manage"
            fallback={
              <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
                Read-only view
              </span>
            }
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : isDirty ? "Save Changes *" : "Saved"}
            </button>
          </PermissionGate>
        </div>
      </div>

      {feedback && (
        <div
          className={`mx-6 mt-4 rounded-xl border p-3 text-xs ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Role Picker & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 bg-stone-50/50 px-6 py-3">
        <div className="flex items-center gap-2">
          <label htmlFor="role-select" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Selected Role:
          </label>
          <select
            id="role-select"
            value={activeRoleId}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label} {role.is_platform_role ? "(Platform)" : "(Custom)"}
              </option>
            ))}
          </select>
        </div>

        {selectedRole && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
              {assignedPerms.size} of {allPermissions?.length ?? 0} granted
            </span>
            {isDirty && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 animate-pulse">
                Unsaved edits
              </span>
            )}
          </div>
        )}

        <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:max-w-xs">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search permissions…"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {canManageRoles && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Deselect all
            </button>
          </div>
        )}
      </div>

      {/* Permissions Body */}
      <div className="p-6">
        {loadingPerms && <p className="text-sm text-zinc-400">Loading role permissions…</p>}

        {!loadingPerms && (!allPermissions || allPermissions.length === 0) && (
          <p className="text-sm text-zinc-400">No system permissions found.</p>
        )}

        {!loadingPerms && allPermissions && groupedPermissions.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-400">No permissions match "{searchQuery}".</p>
        )}

        {!loadingPerms && (
          <div className="space-y-6">
            {groupedPermissions.map((group) => {
              const groupPermIds = group.permissions.map((p) => p.id);
              const groupSelectedCount = groupPermIds.filter((id) => assignedPerms.has(id)).length;
              const allGroupSelected = groupSelectedCount === groupPermIds.length;

              return (
                <div key={group.title} className="rounded-xl border border-zinc-100 bg-stone-50/30 p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-800">{group.title}</h3>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                        {groupSelectedCount} / {groupPermIds.length}
                      </span>
                    </div>

                    {canManageRoles && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(groupPermIds, !allGroupSelected)}
                          className="font-medium text-brand-dim hover:underline"
                        >
                          {allGroupSelected ? "Deselect group" : "Select group"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.permissions.map((perm) => {
                      const isChecked = assignedPerms.has(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition ${
                            isChecked
                              ? "border-brand/40 bg-brand-soft/20 shadow-xs"
                              : "border-zinc-100 bg-white hover:border-zinc-200"
                          } ${!canManageRoles ? "cursor-default opacity-80" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!canManageRoles}
                            onChange={() => togglePermission(perm.id)}
                            className="mt-0.5 h-4 w-4 rounded-sm border-zinc-300 text-brand focus:ring-brand"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-semibold text-zinc-800 break-all">{perm.id}</p>
                            {perm.description && (
                              <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{perm.description}</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
