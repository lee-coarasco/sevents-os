import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { useUsers } from "../hooks/useUsers";
import { UserPicker } from "../components/UserPicker";
import { PermissionGate } from "../components/PermissionGate";

type EmploymentStatus = "active" | "on_leave" | "suspended" | "offboarded";

interface Employee {
  id: string;
  company_id: string;
  employee_code: string;
  full_name: string;
  department_id: string | null;
  reporting_role_id: string | null;
  employment_status: EmploymentStatus;
  app_user_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  onboarded_at: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Company {
  id: string;
  legal_name: string;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface ProjectAllocation {
  id: string;
  employee_id: string;
  project_id: string;
  site_assignment: string | null;
  valid_from: string;
  valid_to: string | null;
}

interface AddedSkill {
  id: string;
  skillName: string;
  proficiencyNote: string | null;
}

interface AddedCertification {
  id: string;
  certificationName: string;
  issuingBody: string | null;
  issuedAt: string;
  expiresAt: string | null;
}

interface AddedTraining {
  id: string;
  courseName: string;
  completedAt: string;
  result: string | null;
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

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { users } = useUsers();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<ProjectAllocation[]>([]);
  const [skills, setSkills] = useState<AddedSkill[]>([]);
  const [certifications, setCertifications] = useState<AddedCertification[]>([]);
  const [trainings, setTrainings] = useState<AddedTraining[]>([]);

  const [tab, setTab] = useState<"profile" | "skills" | "training" | "allocations">("profile");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states for profile edit
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>("active");
  const [appUserId, setAppUserId] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Form states for skill
  const [skillName, setSkillName] = useState("");
  const [proficiencyNote, setProficiencyNote] = useState("");

  // Form states for certification
  const [certName, setCertName] = useState("");
  const [certBody, setCertBody] = useState("");
  const [certIssuedAt, setCertIssuedAt] = useState("");
  const [certExpiresAt, setCertExpiresAt] = useState("");

  // Form states for training
  const [courseName, setCourseName] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [trainingResult, setTrainingResult] = useState("");

  // Form states for allocation
  const [allocProjectId, setAllocProjectId] = useState("");
  const [siteAssignment, setSiteAssignment] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  function loadEmployee() {
    if (!session || !id) return;
    setError(null);
    apiFetch<{ employee: Employee }>(`/employees/${id}`, session.access_token)
      .then((data) => {
        setEmployee(data.employee);
        setFullName(data.employee.full_name);
        setDepartmentId(data.employee.department_id ?? "");
        setEmploymentStatus(data.employee.employment_status);
        setAppUserId(data.employee.app_user_id ?? "");
        setEmergencyName(data.employee.emergency_contact_name ?? "");
        setEmergencyPhone(data.employee.emergency_contact_phone ?? "");

        if (data.employee.company_id) {
          apiFetch<{ companies: Company[] }>("/tenancy/companies", session.access_token)
            .then((res) => {
              const comp = res.companies.find((c) => c.id === data.employee.company_id);
              if (comp) setCompany(comp);
            })
            .catch(() => {});

          apiFetch<{ departments: Department[] }>(
            `/authority/departments?companyId=${data.employee.company_id}`,
            session.access_token,
          )
            .then((res) => setDepartments(res.departments))
            .catch(() => {});
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load employee details"));

    apiFetch<{ allocations: ProjectAllocation[] }>(`/employees/${id}/project-allocations`, session.access_token)
      .then((data) => setAllocations(data.allocations ?? []))
      .catch(() => {});

    apiFetch<{ projects: Project[] }>("/projects", session.access_token)
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    loadEmployee();
  }, [session, id]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!session || !id) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch<{ employee: Employee }>(`/employees/${id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: fullName.trim(),
          departmentId: departmentId || null,
          employmentStatus,
          appUserId: appUserId || null,
          emergencyContactName: emergencyName.trim() || null,
          emergencyContactPhone: emergencyPhone.trim() || null,
        }),
      });
      setEmployee(res.employee);
      setActionSuccess("Employee profile updated successfully");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!session || !id) return;
    if (!window.confirm("Are you sure you want to offboard/deactivate this employee?")) return;
    setSaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch<{ employee: Employee }>(`/employees/${id}/deactivate`, session.access_token, {
        method: "POST",
      });
      setEmployee(res.employee);
      setEmploymentStatus(res.employee.employment_status);
      setActionSuccess("Employee has been deactivated / offboarded");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not deactivate employee");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSkill(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !skillName.trim()) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch<{ employeeSkill: { id: string } }>(`/employees/${id}/skills`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          skillName: skillName.trim(),
          proficiencyNote: proficiencyNote.trim() || null,
        }),
      });
      setSkills((prev) => [
        ...prev,
        {
          id: res.employeeSkill?.id ?? String(Date.now()),
          skillName: skillName.trim(),
          proficiencyNote: proficiencyNote.trim() || null,
        },
      ]);
      setSkillName("");
      setProficiencyNote("");
      setActionSuccess("Skill added successfully");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add skill");
    }
  }

  async function handleAddCertification(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !certName.trim() || !certIssuedAt) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch<{ employeeCertification: { id: string } }>(
        `/employees/${id}/certifications`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            certificationName: certName.trim(),
            issuingBody: certBody.trim() || null,
            issuedAt: certIssuedAt,
            expiresAt: certExpiresAt || null,
          }),
        },
      );
      setCertifications((prev) => [
        ...prev,
        {
          id: res.employeeCertification?.id ?? String(Date.now()),
          certificationName: certName.trim(),
          issuingBody: certBody.trim() || null,
          issuedAt: certIssuedAt,
          expiresAt: certExpiresAt || null,
        },
      ]);
      setCertName("");
      setCertBody("");
      setCertIssuedAt("");
      setCertExpiresAt("");
      setActionSuccess("Certification added successfully");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add certification");
    }
  }

  async function handleAddTraining(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !courseName.trim() || !completedAt) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch<{ trainingRecord: { id: string } }>(`/employees/${id}/training`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          courseName: courseName.trim(),
          completedAt,
          result: trainingResult.trim() || null,
        }),
      });
      setTrainings((prev) => [
        ...prev,
        {
          id: res.trainingRecord?.id ?? String(Date.now()),
          courseName: courseName.trim(),
          completedAt,
          result: trainingResult.trim() || null,
        },
      ]);
      setCourseName("");
      setCompletedAt("");
      setTrainingResult("");
      setActionSuccess("Training record added successfully");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add training record");
    }
  }

  async function handleAddAllocation(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !allocProjectId) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch(`/employees/${id}/project-allocations`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          projectId: allocProjectId,
          siteAssignment: siteAssignment.trim() || null,
          validFrom: validFrom || new Date().toISOString(),
          validTo: validTo || null,
        }),
      });
      setAllocProjectId("");
      setSiteAssignment("");
      setValidFrom("");
      setValidTo("");
      setActionSuccess("Project allocation created");
      // reload allocations
      apiFetch<{ allocations: ProjectAllocation[] }>(`/employees/${id}/project-allocations`, session.access_token)
        .then((data) => setAllocations(data.allocations ?? []))
        .catch(() => {});
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not allocate project");
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-brand text-zinc-900 font-semibold" : "text-zinc-500 hover:bg-stone-100"
    }`;

  const assignedDepartment = departments.find((d) => d.id === employee?.department_id)?.name ?? "—";
  const userAccount = users?.find((u) => u.id === employee?.app_user_id)?.display_name ?? employee?.app_user_id ?? "Unlinked";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/employees" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to Employees Directory
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!employee && !error && <p className="text-sm text-zinc-400">Loading employee details…</p>}

      {employee && (
        <>
          {/* Header Card */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-brand text-2xl font-bold text-zinc-900">{employee.full_name}</h1>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[employee.employment_status]}`}>
                    {statusLabels[employee.employment_status]}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-zinc-400">
                  Code: <span className="font-semibold text-zinc-700">{employee.employee_code}</span> &bull; Company: {company?.legal_name ?? "—"}
                </p>
              </div>

              <PermissionGate permission="employee.directory.manage">
                {employee.employment_status !== "offboarded" && (
                  <button
                    onClick={handleDeactivate}
                    disabled={saving}
                    className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    Offboard / Deactivate
                  </button>
                )}
              </PermissionGate>
            </div>

            <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-100 text-xs">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Department</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">{assignedDepartment}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Auth Account</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">{userAccount}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Emergency Contact</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">{employee.emergency_contact_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Emergency Phone</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">{employee.emergency_contact_phone ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
          {actionSuccess && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionSuccess}</div>}

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-zinc-200 pb-2">
            <button onClick={() => setTab("profile")} className={tabClass(tab === "profile")}>
              Profile &amp; Settings
            </button>
            <button onClick={() => setTab("skills")} className={tabClass(tab === "skills")}>
              Skills &amp; Certifications
            </button>
            <button onClick={() => setTab("training")} className={tabClass(tab === "training")}>
              Training Records
            </button>
            <button onClick={() => setTab("allocations")} className={tabClass(tab === "allocations")}>
              Project Allocations
            </button>
          </div>

          {/* Tab 1: Profile Form */}
          {tab === "profile" && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <h2 className="font-brand text-base font-semibold text-zinc-900 mb-4">Edit Employee Information</h2>
              <PermissionGate
                permission="employee.directory.manage"
                fallback={<p className="text-xs text-zinc-400">You do not have permission to edit employees.</p>}
              >
                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                      Full Name
                    </label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                      Department
                    </label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="">No department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                      Employment Status
                    </label>
                    <select
                      value={employmentStatus}
                      onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}
                      className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="active">Active</option>
                      <option value="on_leave">On leave</option>
                      <option value="suspended">Suspended</option>
                      <option value="offboarded">Offboarded</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                      Link User Account
                    </label>
                    <UserPicker
                      value={appUserId}
                      onChange={setAppUserId}
                      placeholder="Assign auth login user…"
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                        Emergency Contact Name
                      </label>
                      <input
                        value={emergencyName}
                        onChange={(e) => setEmergencyName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                        Emergency Contact Phone
                      </label>
                      <input
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="e.g. +91 9876543210"
                        className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saving || !fullName.trim()}
                      className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </form>
              </PermissionGate>
            </div>
          )}

          {/* Tab 2: Skills & Certifications */}
          {tab === "skills" && (
            <div className="space-y-6">
              {/* Skills */}
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                <h2 className="font-brand text-base font-semibold text-zinc-900 mb-4">Competencies &amp; Skills</h2>
                <form onSubmit={handleAddSkill} className="flex flex-wrap gap-2 mb-4">
                  <input
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Skill name (e.g. Rebar fixing, CAD)"
                    className="flex-1 min-w-[200px] rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    value={proficiencyNote}
                    onChange={(e) => setProficiencyNote(e.target.value)}
                    placeholder="Proficiency (e.g. Advanced / 5 yrs)"
                    className="w-56 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="submit"
                    disabled={!skillName.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim transition disabled:opacity-50"
                  >
                    Add Skill
                  </button>
                </form>

                {skills.length === 0 ? (
                  <p className="text-xs text-zinc-400">No skills logged yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-800">
                        <span>{s.skillName}</span>
                        {s.proficiencyNote && <span className="text-zinc-400">({s.proficiencyNote})</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Certifications */}
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                <h2 className="font-brand text-base font-semibold text-zinc-900 mb-4">Certifications &amp; Licences</h2>
                <form onSubmit={handleAddCertification} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                  <input
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    placeholder="Certification (e.g. NEBOSH IGC)"
                    className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    value={certBody}
                    onChange={(e) => setCertBody(e.target.value)}
                    placeholder="Issuing authority (optional)"
                    className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    type="date"
                    value={certIssuedAt}
                    onChange={(e) => setCertIssuedAt(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <input
                    type="date"
                    value={certExpiresAt}
                    onChange={(e) => setCertExpiresAt(e.target.value)}
                    placeholder="Expires (optional)"
                    className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="submit"
                    disabled={!certName.trim() || !certIssuedAt}
                    className="sm:col-span-4 w-fit rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim transition disabled:opacity-50"
                  >
                    Add Certification
                  </button>
                </form>

                {certifications.length === 0 ? (
                  <p className="text-xs text-zinc-400">No certifications recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {certifications.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 text-xs">
                        <div>
                          <p className="font-semibold text-zinc-800">{c.certificationName}</p>
                          <p className="text-zinc-500">{c.issuingBody ?? "Unknown Issuer"}</p>
                        </div>
                        <div className="text-right text-zinc-500">
                          <p>Issued: {c.issuedAt}</p>
                          {c.expiresAt && <p>Expires: {c.expiresAt}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Training */}
          {tab === "training" && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <h2 className="font-brand text-base font-semibold text-zinc-900 mb-4">Training History</h2>
              <form onSubmit={handleAddTraining} className="flex flex-wrap gap-2 mb-4">
                <input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Course name (e.g. Scaffolding Safety)"
                  className="flex-1 min-w-[200px] rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  value={trainingResult}
                  onChange={(e) => setTrainingResult(e.target.value)}
                  placeholder="Result (e.g. Pass / 95%)"
                  className="w-48 rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="submit"
                  disabled={!courseName.trim() || !completedAt}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim transition disabled:opacity-50"
                >
                  Log Training
                </button>
              </form>

              {trainings.length === 0 ? (
                <p className="text-xs text-zinc-400">No training records found.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                      <th className="py-2">Course Name</th>
                      <th className="py-2">Completed Date</th>
                      <th className="py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainings.map((t) => (
                      <tr key={t.id} className="border-t border-zinc-100 text-xs">
                        <td className="py-3 font-medium text-zinc-800">{t.courseName}</td>
                        <td className="py-3 text-zinc-500">{t.completedAt}</td>
                        <td className="py-3 text-zinc-600">{t.result ?? "Completed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab 4: Project Allocations */}
          {tab === "allocations" && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <h2 className="font-brand text-base font-semibold text-zinc-900 mb-4">Project &amp; Site Allocations</h2>
              <form onSubmit={handleAddAllocation} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                <select
                  value={allocProjectId}
                  onChange={(e) => setAllocProjectId(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select Project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                <input
                  value={siteAssignment}
                  onChange={(e) => setSiteAssignment(e.target.value)}
                  placeholder="Site Assignment / Zone (e.g. Tower B)"
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  placeholder="Valid From"
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="date"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                  placeholder="Valid To (optional)"
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="submit"
                  disabled={!allocProjectId}
                  className="sm:col-span-4 w-fit rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim transition disabled:opacity-50"
                >
                  Allocate to Project
                </button>
              </form>

              {allocations.length === 0 ? (
                <p className="text-xs text-zinc-400">No active project allocations.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
                      <th className="py-2">Project</th>
                      <th className="py-2">Site / Zone</th>
                      <th className="py-2">Valid From</th>
                      <th className="py-2">Valid To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => {
                      const proj = projects.find((p) => p.id === a.project_id);
                      return (
                        <tr key={a.id} className="border-t border-zinc-100 text-xs">
                          <td className="py-3 font-medium text-zinc-800">
                            {proj ? `${proj.name} (${proj.code})` : a.project_id}
                          </td>
                          <td className="py-3 text-zinc-600">{a.site_assignment ?? "General"}</td>
                          <td className="py-3 text-zinc-500">{a.valid_from ? a.valid_from.slice(0, 10) : "—"}</td>
                          <td className="py-3 text-zinc-500">{a.valid_to ? a.valid_to.slice(0, 10) : "Indefinite"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
