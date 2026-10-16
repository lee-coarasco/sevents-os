import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { usePermissions } from "../hooks/usePermissions";

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

  const departmentsForSelected = departments ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Departments & Roles</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Departments</h3>
        {companies === null && <p className="text-sm text-slate-500">Loading companies…</p>}
        {companies && companies.length > 0 && (
          <label className="mb-3 block text-sm">
            Company
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.legal_name}
                </option>
              ))}
            </select>
          </label>
        )}
        {departments === null && selectedCompanyId && (
          <p className="mb-3 text-sm text-slate-500">Loading departments…</p>
        )}
        {departments !== null && departmentsForSelected.length === 0 && (
          <p className="mb-3 text-sm text-slate-500">No departments yet.</p>
        )}
        {departmentsForSelected.length > 0 && (
          <ul className="mb-4 space-y-2">
            {departmentsForSelected.map((department) => (
              <li key={department.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                {department.name}
              </li>
            ))}
          </ul>
        )}
        {!permissionsLoading && has("authority.department.manage") && companies && companies.length > 0 && (
          <form onSubmit={handleCreateDepartment} className="flex gap-2">
            <input
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="Department name"
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creatingDepartment || !newDepartmentName.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creatingDepartment ? "Creating…" : "Add department"}
            </button>
          </form>
        )}
        {!permissionsLoading && !has("authority.department.manage") && (
          <p className="text-xs text-slate-400">You don't have permission to create departments.</p>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-3 text-sm font-medium text-slate-500">Role assignments</h3>
        <p className="mb-3 text-xs text-slate-400">
          There is still no endpoint to list users by name — enter the user id directly.
        </p>
        {roleAssignments === null && <p className="mb-3 text-sm text-slate-500">Loading…</p>}
        {roleAssignments?.length === 0 && (
          <p className="mb-3 text-sm text-slate-500">No role assignments yet.</p>
        )}
        {roleAssignments && roleAssignments.length > 0 && (
          <ul className="mb-4 space-y-2">
            {roleAssignments.map((assignment) => (
              <li key={assignment.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                user {assignment.user_id} → role {roleLabel(assignment.role_id)}
                {assignment.department_id ? ` (dept ${assignment.department_id})` : ""}
              </li>
            ))}
          </ul>
        )}
        {!permissionsLoading && has("authority.role_assignment.manage") && (
          <form onSubmit={handleCreateRoleAssignment} className="space-y-2">
            <div className="flex gap-2">
              <input
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                placeholder="User id"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={assignRoleId}
                onChange={(e) => setAssignRoleId(e.target.value)}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
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
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
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
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creatingAssignment ? "Creating…" : "Assign role"}
            </button>
          </form>
        )}
        {!permissionsLoading && !has("authority.role_assignment.manage") && (
          <p className="text-xs text-slate-400">You don't have permission to assign roles.</p>
        )}
      </section>
    </div>
  );
}
