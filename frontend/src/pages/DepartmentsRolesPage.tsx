import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";
import { useUsers } from "../hooks/useUsers";
import { UserPicker } from "../components/UserPicker";

interface Company {
  id: string;
  legal_name: string;
}

interface Department {
  id: string;
  company_id: string;
  name: string;
  parent_id: string | null;
}

interface RoleDefinition {
  id: string;
  label: string;
  is_platform_role: boolean;
}

interface RoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  department_id: string | null;
}

export function DepartmentsRolesPage() {
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
  const { users } = useUsers();

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [roles, setRoles] = useState<RoleDefinition[] | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[] | null>(null);

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [creatingDepartment, setCreatingDepartment] = useState(false);

  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignDepartmentId, setAssignDepartmentId] = useState("");
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ companies: Company[] }>("/tenancy/companies", session.access_token)
      .then((data) => {
        setCompanies(data.companies);
        if (data.companies.length > 0) setSelectedCompanyId((prev) => prev || data.companies[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
    apiFetch<{ roles: RoleDefinition[] }>("/authority/roles", session.access_token)
      .then((data) => setRoles(data.roles))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
    apiFetch<{ roleAssignments: RoleAssignment[] }>("/authority/role-assignments", session.access_token)
      .then((data) => setRoleAssignments(data.roleAssignments))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  useEffect(() => {
    if (!session || !selectedCompanyId) {
      setDepartments(null);
      return;
    }
    apiFetch<{ departments: Department[] }>(
      `/authority/departments?companyId=${selectedCompanyId}`,
      session.access_token,
    )
      .then((data) => setDepartments(data.departments))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, selectedCompanyId]);

  async function handleCreateDepartment(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedCompanyId || !newDepartmentName.trim()) return;
    setCreatingDepartment(true);
    setError(null);
    try {
      const { department } = await apiFetch<{ department: Department }>(
        "/authority/departments",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({ companyId: selectedCompanyId, name: newDepartmentName.trim() }),
        },
      );
      setDepartments((prev) => [...(prev ?? []), department]);
      setNewDepartmentName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create department");
    } finally {
      setCreatingDepartment(false);
    }
  }

  async function handleCreateRoleAssignment(event: FormEvent) {
    event.preventDefault();
    if (!session || !assignUserId.trim() || !assignRoleId) return;
    setCreatingAssignment(true);
    setError(null);
    try {
      const { roleAssignment } = await apiFetch<{ roleAssignment: RoleAssignment }>(
        "/authority/role-assignments",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            userId: assignUserId.trim(),
            roleId: assignRoleId,
            departmentId: assignDepartmentId || undefined,
          }),
        },
      );
      setRoleAssignments((prev) => [...(prev ?? []), roleAssignment]);
      setAssignUserId("");
      setAssignRoleId("");
      setAssignDepartmentId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create role assignment");
    } finally {
      setCreatingAssignment(false);
    }
  }

  function roleLabel(roleId: string): string {
    return roles?.find((r) => r.id === roleId)?.label ?? roleId;
  }

  function userLabel(userId: string): string {
    const user = users?.find((u) => u.id === userId);
    return user ? user.display_name ?? user.email : userId;
  }

  const departmentsForSelected = departments ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Departments &amp; Roles</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your organisation structure and permissions</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Departments */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Departments</h2>
        </div>
        <div className="p-6">
          {companies === null && <p className="text-sm text-zinc-400">Loading companies…</p>}
          {companies && companies.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Company
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="mt-2 block w-full max-w-sm rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.legal_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {departments === null && selectedCompanyId && (
            <p className="mb-3 text-sm text-zinc-400">Loading departments…</p>
          )}
          {departments !== null && departmentsForSelected.length === 0 && (
            <p className="mb-4 text-sm text-zinc-400">No departments yet.</p>
          )}
          {departmentsForSelected.length > 0 && (
            <div className="mb-4 space-y-2">
              {departmentsForSelected.map((department) => (
                <div key={department.id} className="flex items-center rounded-xl border border-zinc-100 bg-stone-50 px-4 py-3 text-sm font-medium text-zinc-800">
                  <svg className="mr-3 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {department.name}
                </div>
              ))}
            </div>
          )}
          {!permissionsLoading && has("authority.department.manage") && companies && companies.length > 0 && (
            <form onSubmit={handleCreateDepartment} className="flex gap-2">
              <input
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
                placeholder="Department name"
                className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="submit"
                disabled={creatingDepartment || !newDepartmentName.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
              >
                {creatingDepartment ? "Adding…" : "Add department"}
              </button>
            </form>
          )}
          {!permissionsLoading && !has("authority.department.manage") && (
            <p className="text-xs text-zinc-400">You don't have permission to create departments.</p>
          )}
        </div>
      </div>

      {/* Role assignments */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-brand text-base font-semibold text-zinc-900">Role assignments</h2>
        </div>
        <div className="p-6">
          {roleAssignments === null && <p className="mb-3 text-sm text-zinc-400">Loading…</p>}
          {roleAssignments?.length === 0 && (
            <p className="mb-4 text-sm text-zinc-400">No role assignments yet.</p>
          )}
          {roleAssignments && roleAssignments.length > 0 && (
            <div className="mb-4 space-y-2">
              {roleAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-stone-50 px-4 py-3 text-sm">
                  <span className="font-medium text-zinc-700">{userLabel(assignment.user_id)}</span>
                  <span className="mx-2 text-zinc-300">→</span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">
                    {roleLabel(assignment.role_id)}
                  </span>
                  {assignment.department_id && (
                    <span className="ml-2 text-xs text-zinc-400">in dept {assignment.department_id.slice(0, 8)}…</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {!permissionsLoading && has("authority.role_assignment.manage") && (
            <form onSubmit={handleCreateRoleAssignment} className="space-y-3">
              <div className="flex gap-2">
                <UserPicker value={assignUserId} onChange={setAssignUserId} className="flex-1" />
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select a role…</option>
                  {(roles ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <select
                  value={assignDepartmentId}
                  onChange={(e) => setAssignDepartmentId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">No department</option>
                  {departmentsForSelected.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingAssignment || !assignUserId.trim() || !assignRoleId}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
              >
                {creatingAssignment ? "Assigning…" : "Assign role"}
              </button>
            </form>
          )}
          {!permissionsLoading && !has("authority.role_assignment.manage") && (
            <p className="text-xs text-zinc-400">You don't have permission to assign roles.</p>
          )}
        </div>
      </div>
    </div>
  );
}
