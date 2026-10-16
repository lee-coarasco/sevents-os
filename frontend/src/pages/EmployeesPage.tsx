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
}

type EmploymentStatus = "active" | "on_leave" | "suspended" | "offboarded";

interface Employee {
  id: string;
  company_id: string;
  employee_code: string;
  full_name: string;
  department_id: string | null;
  employment_status: EmploymentStatus;
  app_user_id: string | null;
}

const statusColors: Record<EmploymentStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  on_leave: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
  offboarded: "bg-zinc-100 text-zinc-500",
};

const statusLabels: Record<EmploymentStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  suspended: "Suspended",
  offboarded: "Offboarded",
};

export function EmployeesPage() {
  const { session } = useAuth();
  const { has, loading: permissionsLoading } = usePermissions();
  const { users } = useUsers();

  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newEmployeeCode, setNewEmployeeCode] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeDepartmentId, setNewEmployeeDepartmentId] = useState("");
  const [newEmployeeAppUserId, setNewEmployeeAppUserId] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [linkingEmployeeId, setLinkingEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ companies: Company[] }>("/tenancy/companies", session.access_token)
      .then((data) => {
        setCompanies(data.companies);
        if (data.companies.length > 0) setSelectedCompanyId((prev) => prev || data.companies[0].id);
      })
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

  useEffect(() => {
    if (!session || !selectedCompanyId) {
      setEmployees(null);
      return;
    }
    const params = new URLSearchParams({ companyId: selectedCompanyId });
    if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
    apiFetch<{ employees: Employee[] }>(`/employees?${params.toString()}`, session.access_token)
      .then((data) => setEmployees(data.employees))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, selectedCompanyId, selectedDepartmentId]);

  async function handleCreateEmployee(event: FormEvent) {
    event.preventDefault();
    if (!session || !selectedCompanyId || !newEmployeeCode.trim() || !newEmployeeName.trim()) return;
    setCreatingEmployee(true);
    setError(null);
    try {
      const { employee } = await apiFetch<{ employee: Employee }>("/employees", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          employeeCode: newEmployeeCode.trim(),
          fullName: newEmployeeName.trim(),
          departmentId: newEmployeeDepartmentId || undefined,
          appUserId: newEmployeeAppUserId || undefined,
        }),
      });
      if (!selectedDepartmentId || employee.department_id === selectedDepartmentId) {
        setEmployees((prev) => [...(prev ?? []), employee]);
      }
      setNewEmployeeCode("");
      setNewEmployeeName("");
      setNewEmployeeDepartmentId("");
      setNewEmployeeAppUserId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create employee");
    } finally {
      setCreatingEmployee(false);
    }
  }

  async function handleLinkAccount(employeeId: string, appUserId: string) {
    if (!session) return;
    setError(null);
    try {
      const { employee } = await apiFetch<{ employee: Employee }>(`/employees/${employeeId}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ appUserId }),
      });
      setEmployees((prev) => prev?.map((e) => (e.id === employee.id ? employee : e)) ?? prev);
      setLinkingEmployeeId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not link this employee to an account");
    }
  }

  function appUserLabel(appUserId: string | null): string {
    if (!appUserId) return "—";
    const user = users?.find((u) => u.id === appUserId);
    return user ? user.display_name ?? user.email : "Linked";
  }

  function departmentName(departmentId: string | null): string {
    if (!departmentId) return "—";
    return departments?.find((d) => d.id === departmentId)?.name ?? "—";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Employee Directory</h1>
        <p className="mt-1 text-sm text-zinc-400">Everyone on the books, by company and department</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="font-brand text-base font-semibold text-zinc-900">Employees</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {companies && companies.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedDepartmentId("");
                  }}
                  className="mt-1.5 block w-48 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.legal_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">Department</label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="mt-1.5 block w-48 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">All departments</option>
                {(departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {companies === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {companies?.length === 0 && (
            <p className="text-sm text-zinc-400">No companies set up yet — add one on the Company page first.</p>
          )}
          {employees === null && selectedCompanyId && <p className="mb-3 text-sm text-zinc-400">Loading employees…</p>}
          {employees?.length === 0 && <p className="mb-4 text-sm text-zinc-400">No employees yet.</p>}

          {employees && employees.length > 0 && (
            <table className="mb-4 w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  <th className="py-2">Name</th>
                  <th className="py-2">Code</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Account</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-t border-zinc-100">
                    <td className="py-3 font-medium text-zinc-800">{employee.full_name}</td>
                    <td className="py-3 font-mono text-xs text-zinc-500">{employee.employee_code}</td>
                    <td className="py-3 text-zinc-600">{departmentName(employee.department_id)}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[employee.employment_status]}`}>
                        {statusLabels[employee.employment_status]}
                      </span>
                    </td>
                    <td className="py-3">
                      {linkingEmployeeId === employee.id ? (
                        <UserPicker
                          value={employee.app_user_id ?? ""}
                          onChange={(userId) => userId && handleLinkAccount(employee.id, userId)}
                          className="w-56"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => has("employee.directory.manage") && setLinkingEmployeeId(employee.id)}
                          disabled={!has("employee.directory.manage")}
                          className="text-zinc-600 underline-offset-2 hover:text-brand-dim hover:underline disabled:cursor-default disabled:text-zinc-600 disabled:no-underline"
                        >
                          {appUserLabel(employee.app_user_id)}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!permissionsLoading && has("employee.directory.manage") && selectedCompanyId && (
            <form onSubmit={handleCreateEmployee} className="flex flex-wrap gap-2">
              <input
                value={newEmployeeCode}
                onChange={(e) => setNewEmployeeCode(e.target.value)}
                placeholder="Employee code"
                className="w-36 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <input
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                placeholder="Full name"
                className="flex-1 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <select
                value={newEmployeeDepartmentId}
                onChange={(e) => setNewEmployeeDepartmentId(e.target.value)}
                className="w-48 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">No department</option>
                {(departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <UserPicker
                value={newEmployeeAppUserId}
                onChange={setNewEmployeeAppUserId}
                placeholder="Link to auth account (optional)…"
                className="w-56"
              />
              <button
                type="submit"
                disabled={creatingEmployee || !newEmployeeCode.trim() || !newEmployeeName.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
              >
                {creatingEmployee ? "Adding…" : "Add employee"}
              </button>
            </form>
          )}
          {!permissionsLoading && !has("employee.directory.manage") && (
            <p className="text-xs text-zinc-400">You don't have permission to add employees.</p>
          )}
        </div>
      </div>
    </div>
  );
}
