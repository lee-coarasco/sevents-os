import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type SkillLevel = "entry" | "intermediate" | "senior" | "master";
export type ManpowerStatus = "draft" | "submitted" | "approved" | "fulfilled" | "cancelled";

export interface ManpowerRequest {
  id: string;
  project_id: string;
  request_number: string;
  role_title: string;
  quantity_required: number;
  skill_level: SkillLevel;
  required_date: string;
  status: ManpowerStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export type CandidateStage = "applied" | "screening" | "interview" | "offered" | "hired" | "rejected";

export interface RecruitmentCandidate {
  id: string;
  manpower_request_id?: string | null;
  candidate_name: string;
  email: string;
  phone?: string | null;
  position_applied: string;
  current_company?: string | null;
  years_experience: number;
  stage: CandidateStage;
  rating: number;
  resume_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export type TradeType =
  | "civil_mason"
  | "steel_fixer"
  | "electrician"
  | "plumber"
  | "hvac_technician"
  | "safety_marshall"
  | "scaffolder"
  | "crane_operator";

export type CompetencyStatus = "valid" | "expiring_soon" | "expired";

export interface SiteCompetency {
  id: string;
  employee_name: string;
  trade: TradeType;
  certification_name: string;
  certifying_body: string;
  issue_date: string;
  expiry_date: string;
  status: CompetencyStatus;
  notes?: string | null;
  created_at: string;
}

export type AppraisalStatus = "draft" | "submitted" | "completed";

export interface PerformanceAppraisal {
  id: string;
  employee_name: string;
  review_period: string;
  appraiser_name: string;
  score: number;
  strengths?: string | null;
  growth_areas?: string | null;
  goals?: string | null;
  status: AppraisalStatus;
  created_at: string;
}

export function PeoplePage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "manpower";

  const [manpowerRequests, setManpowerRequests] = useState<ManpowerRequest[]>([]);
  const [candidates, setCandidates] = useState<RecruitmentCandidate[]>([]);
  const [competencies, setCompetencies] = useState<SiteCompetency[]>([]);
  const [appraisals, setAppraisals] = useState<PerformanceAppraisal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showManpowerModal, setShowManpowerModal] = useState<boolean>(false);
  const [showCandidateModal, setShowCandidateModal] = useState<boolean>(false);
  const [showCompetencyModal, setShowCompetencyModal] = useState<boolean>(false);
  const [showAppraisalModal, setShowAppraisalModal] = useState<boolean>(false);

  // Form states
  const [manpowerForm, setManpowerForm] = useState({
    project_id: "proj-skyline",
    request_number: "",
    role_title: "",
    quantity_required: 1,
    skill_level: "intermediate" as SkillLevel,
    required_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]!,
    notes: "",
  });

  const [candidateForm, setCandidateForm] = useState({
    manpower_request_id: "",
    candidate_name: "",
    email: "",
    phone: "",
    position_applied: "",
    current_company: "",
    years_experience: 0,
    rating: 3,
    notes: "",
  });

  const [competencyForm, setCompetencyForm] = useState({
    employee_name: "",
    trade: "civil_mason" as TradeType,
    certification_name: "",
    certifying_body: "",
    issue_date: new Date().toISOString().split("T")[0]!,
    expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]!,
    notes: "",
  });

  const [appraisalForm, setAppraisalForm] = useState({
    employee_name: "",
    review_period: "2026-H2",
    appraiser_name: "",
    score: 3.5,
    strengths: "",
    growth_areas: "",
    goals: "",
  });

  const loadData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [mRes, cRes, compRes, aRes] = await Promise.all([
        apiFetch<{ requests: ManpowerRequest[] }>("/people/manpower-requests", session.access_token),
        apiFetch<{ candidates: RecruitmentCandidate[] }>("/people/candidates", session.access_token),
        apiFetch<{ competencies: SiteCompetency[] }>("/people/competencies", session.access_token),
        apiFetch<{ appraisals: PerformanceAppraisal[] }>("/people/appraisals", session.access_token),
      ]);
      setManpowerRequests(mRes.requests || []);
      setCandidates(cRes.candidates || []);
      setCompetencies(compRes.competencies || []);
      setAppraisals(aRes.appraisals || []);
    } catch (err: any) {
      setError(err.message || "Failed to load HR and people data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.access_token]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const handleCreateManpower = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ request: ManpowerRequest }>("/people/manpower-requests", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manpowerForm),
      });
      setShowManpowerModal(false);
      setManpowerForm({
        project_id: "proj-skyline",
        request_number: "",
        role_title: "",
        quantity_required: 1,
        skill_level: "intermediate",
        required_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]!,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit manpower request");
    }
  };

  const handleApproveManpower = async (id: string) => {
    if (!session?.access_token) return;
    try {
      await apiFetch<{ request: ManpowerRequest }>(
        `/people/manpower-requests/${id}/approve`,
        session.access_token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved_by: session.user?.id || "authorized-approver" }),
        }
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to approve manpower request");
    }
  };

  const handleCreateCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ candidate: RecruitmentCandidate }>("/people/candidates", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...candidateForm,
          manpower_request_id: candidateForm.manpower_request_id || undefined,
        }),
      });
      setShowCandidateModal(false);
      setCandidateForm({
        manpower_request_id: "",
        candidate_name: "",
        email: "",
        phone: "",
        position_applied: "",
        current_company: "",
        years_experience: 0,
        rating: 3,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to add candidate");
    }
  };

  const handleUpdateCandidateStage = async (id: string, stage: CandidateStage) => {
    if (!session?.access_token) return;
    try {
      await apiFetch<{ candidate: RecruitmentCandidate }>(
        `/people/candidates/${id}/stage`,
        session.access_token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        }
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update candidate stage");
    }
  };

  const handleCreateCompetency = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ competency: SiteCompetency }>("/people/competencies", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(competencyForm),
      });
      setShowCompetencyModal(false);
      setCompetencyForm({
        employee_name: "",
        trade: "civil_mason",
        certification_name: "",
        certifying_body: "",
        issue_date: new Date().toISOString().split("T")[0]!,
        expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]!,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record certification");
    }
  };

  const handleCreateAppraisal = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ appraisal: PerformanceAppraisal }>("/people/appraisals", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appraisalForm),
      });
      setShowAppraisalModal(false);
      setAppraisalForm({
        employee_name: "",
        review_period: "2026-H2",
        appraiser_name: "",
        score: 3.5,
        strengths: "",
        growth_areas: "",
        goals: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create appraisal");
    }
  };

  const handleCompleteAppraisal = async (id: string) => {
    if (!session?.access_token) return;
    try {
      await apiFetch<{ appraisal: PerformanceAppraisal }>(
        `/people/appraisals/${id}/complete`,
        session.access_token,
        {
          method: "POST",
        }
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to complete appraisal");
    }
  };

  // KPI Calculations
  const totalManpowerRequired = manpowerRequests.reduce((sum, r) => sum + Number(r.quantity_required || 0), 0);
  const activePipelineCount = candidates.filter((c) => c.stage !== "hired" && c.stage !== "rejected").length;
  const validCertsCount = competencies.filter((c) => c.status === "valid").length;
  const expiringOrExpiredCount = competencies.filter((c) => c.status === "expiring_soon" || c.status === "expired").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">People, Recruitment &amp; Performance</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manpower mobilization requisitions, recruitment pipeline, site competency matrix &amp; training certifications, and performance appraisals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "manpower" && (
            <PermissionGate permission="people.manpower.manage">
              <button
                onClick={() => setShowManpowerModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Request Manpower
              </button>
            </PermissionGate>
          )}
          {activeTab === "recruitment" && (
            <PermissionGate permission="people.recruitment.manage">
              <button
                onClick={() => setShowCandidateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Add Candidate
              </button>
            </PermissionGate>
          )}
          {activeTab === "competency" && (
            <PermissionGate permission="people.competency.manage">
              <button
                onClick={() => setShowCompetencyModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Record Certification
              </button>
            </PermissionGate>
          )}
          {activeTab === "appraisals" && (
            <PermissionGate permission="people.appraisal.manage">
              <button
                onClick={() => setShowAppraisalModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + New Appraisal
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Manpower Demanded</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">{totalManpowerRequired.toLocaleString("en-US")} workers</p>
          <p className="mt-1 text-xs text-zinc-400">{manpowerRequests.length} project requisitions</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Talent Pipeline</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{activePipelineCount} candidates</p>
          <p className="mt-1 text-xs text-zinc-400">{candidates.filter((c) => c.stage === "interview").length} currently in interview</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Certified Site Workers</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{validCertsCount}</p>
          <p className="mt-1 text-xs text-zinc-400">{competencies.length} total recorded certifications</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Expiring / Expired Certs</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">{expiringOrExpiredCount}</p>
          <p className="mt-1 text-xs text-zinc-400">Requires renewal or safety recertification</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => handleTabChange("manpower")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "manpower"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Manpower Requisitions ({manpowerRequests.length})
          </button>
          <button
            onClick={() => handleTabChange("recruitment")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "recruitment"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Recruitment Pipeline ({candidates.length})
          </button>
          <button
            onClick={() => handleTabChange("competency")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "competency"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Site Competency Matrix ({competencies.length})
          </button>
          <button
            onClick={() => handleTabChange("appraisals")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "appraisals"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Performance Appraisals ({appraisals.length})
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          {/* TAB 1: MANPOWER REQUISITIONS */}
          {activeTab === "manpower" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Request #</th>
                    <th className="px-6 py-3">Role &amp; Skill Level</th>
                    <th className="px-6 py-3">Headcount Required</th>
                    <th className="px-6 py-3">Required Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {manpowerRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                        No manpower requisitions raised yet. Click &quot;+ Request Manpower&quot; to mobilize project resources.
                      </td>
                    </tr>
                  ) : (
                    manpowerRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-mono font-semibold text-zinc-900">{r.request_number}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{r.role_title}</p>
                          <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            {r.skill_level}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">{r.quantity_required} persons</td>
                        <td className="px-6 py-4 text-zinc-700">{r.required_date}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              r.status === "approved" || r.status === "fulfilled"
                                ? "bg-emerald-50 text-emerald-700"
                                : r.status === "cancelled"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {r.status === "draft" && (
                            <PermissionGate permission="people.manpower.approve">
                              <button
                                onClick={() => handleApproveManpower(r.id)}
                                className="rounded bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                              >
                                Approve Request
                              </button>
                            </PermissionGate>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: RECRUITMENT PIPELINE */}
          {activeTab === "recruitment" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Candidate</th>
                    <th className="px-6 py-3">Position Applied</th>
                    <th className="px-6 py-3">Experience &amp; Current Co.</th>
                    <th className="px-6 py-3">Rating</th>
                    <th className="px-6 py-3">Hiring Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                        No candidates in recruitment pipeline. Click &quot;+ Add Candidate&quot; to track applicants.
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-zinc-900">{c.candidate_name}</p>
                          <p className="text-xs text-zinc-500">{c.email}</p>
                          {c.phone && <p className="text-xs text-zinc-400">{c.phone}</p>}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-900">{c.position_applied}</td>
                        <td className="px-6 py-4 text-zinc-700">
                          <p>{c.years_experience} yrs</p>
                          <p className="text-xs text-zinc-400">{c.current_company || "Not specified"}</p>
                        </td>
                        <td className="px-6 py-4 text-amber-500 font-medium">
                          {"★".repeat(c.rating || 3)}{"☆".repeat(5 - (c.rating || 3))}
                        </td>
                        <td className="px-6 py-4">
                          <PermissionGate permission="people.recruitment.manage">
                            <select
                              value={c.stage}
                              onChange={(e) => handleUpdateCandidateStage(c.id, e.target.value as CandidateStage)}
                              className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="applied">Applied</option>
                              <option value="screening">Screening</option>
                              <option value="interview">Interview</option>
                              <option value="offered">Offered</option>
                              <option value="hired">Hired</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SITE COMPETENCIES */}
          {activeTab === "competency" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Employee Name</th>
                    <th className="px-6 py-3">Trade Specialization</th>
                    <th className="px-6 py-3">Certification &amp; Body</th>
                    <th className="px-6 py-3">Validity Window</th>
                    <th className="px-6 py-3">Compliance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {competencies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                        No site competencies registered yet. Click &quot;+ Record Certification&quot; to maintain site qualifications.
                      </td>
                    </tr>
                  ) : (
                    competencies.map((comp) => (
                      <tr key={comp.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-semibold text-zinc-900">{comp.employee_name}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                            {comp.trade.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{comp.certification_name}</p>
                          <p className="text-xs text-zinc-500">{comp.certifying_body}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-600">
                          {comp.issue_date} &rarr; {comp.expiry_date}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              comp.status === "valid"
                                ? "bg-emerald-50 text-emerald-700"
                                : comp.status === "expiring_soon"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {comp.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: PERFORMANCE APPRAISALS */}
          {activeTab === "appraisals" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Review Period</th>
                    <th className="px-6 py-3">Appraiser</th>
                    <th className="px-6 py-3">Score</th>
                    <th className="px-6 py-3">Key Highlights &amp; Goals</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {appraisals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                        No performance appraisals on record. Click &quot;+ New Appraisal&quot; to review employee objectives.
                      </td>
                    </tr>
                  ) : (
                    appraisals.map((a) => (
                      <tr key={a.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-semibold text-zinc-900">{a.employee_name}</td>
                        <td className="px-6 py-4 font-mono text-zinc-700">{a.review_period}</td>
                        <td className="px-6 py-4 text-zinc-600">{a.appraiser_name}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-amber-600">{a.score}</span>
                          <span className="text-xs text-zinc-400"> / 5.0</span>
                        </td>
                        <td className="px-6 py-4">
                          {a.strengths && <p className="text-xs text-zinc-700">★ {a.strengths}</p>}
                          {a.goals && <p className="text-xs text-zinc-500">🎯 {a.goals}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              a.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {a.status !== "completed" && (
                            <PermissionGate permission="people.appraisal.manage">
                              <button
                                onClick={() => handleCompleteAppraisal(a.id)}
                                className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                              >
                                Mark Completed
                              </button>
                            </PermissionGate>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: REQUEST MANPOWER */}
      {showManpowerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Request Manpower Mobilization</h3>
            <form onSubmit={handleCreateManpower} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Request Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MPR-2026-SITE-01"
                  value={manpowerForm.request_number}
                  onChange={(e) => setManpowerForm({ ...manpowerForm, request_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Role / Trade Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior QA/QC Inspector (Civil)"
                  value={manpowerForm.role_title}
                  onChange={(e) => setManpowerForm({ ...manpowerForm, role_title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Headcount Required</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={manpowerForm.quantity_required}
                    onChange={(e) => setManpowerForm({ ...manpowerForm, quantity_required: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Skill Level</label>
                  <select
                    value={manpowerForm.skill_level}
                    onChange={(e) => setManpowerForm({ ...manpowerForm, skill_level: e.target.value as SkillLevel })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="entry">Entry Level</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="senior">Senior Specialist</option>
                    <option value="master">Master Craftsman</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Required Mobilization Date</label>
                <input
                  type="date"
                  required
                  value={manpowerForm.required_date}
                  onChange={(e) => setManpowerForm({ ...manpowerForm, required_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowManpowerModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CANDIDATE */}
      {showCandidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Add Candidate to Pipeline</h3>
            <form onSubmit={handleCreateCandidate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Candidate Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Salim Al-Khatib"
                  value={candidateForm.candidate_name}
                  onChange={(e) => setCandidateForm({ ...candidateForm, candidate_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="salim@example.com"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Phone</label>
                  <input
                    type="text"
                    placeholder="+971 55 000 0000"
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Position Applied</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Site Structural Engineer"
                  value={candidateForm.position_applied}
                  onChange={(e) => setCandidateForm({ ...candidateForm, position_applied: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Years of Experience</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={candidateForm.years_experience}
                    onChange={(e) => setCandidateForm({ ...candidateForm, years_experience: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Rating (1-5)</label>
                  <select
                    value={candidateForm.rating}
                    onChange={(e) => setCandidateForm({ ...candidateForm, rating: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value={5}>5 Stars (Exceptional)</option>
                    <option value={4}>4 Stars (Strong)</option>
                    <option value={3}>3 Stars (Competent)</option>
                    <option value={2}>2 Stars (Marginal)</option>
                    <option value={1}>1 Star (Unsuitable)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCandidateModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD CERTIFICATION */}
      {showCompetencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Record Site Skill Certification</h3>
            <form onSubmit={handleCreateCompetency} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Worker Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={competencyForm.employee_name}
                  onChange={(e) => setCompetencyForm({ ...competencyForm, employee_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Trade Classification</label>
                  <select
                    value={competencyForm.trade}
                    onChange={(e) => setCompetencyForm({ ...competencyForm, trade: e.target.value as TradeType })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="civil_mason">Civil Mason</option>
                    <option value="steel_fixer">Steel Fixer</option>
                    <option value="electrician">Electrician</option>
                    <option value="plumber">Plumber</option>
                    <option value="hvac_technician">HVAC Technician</option>
                    <option value="safety_marshall">Safety Marshall</option>
                    <option value="scaffolder">Scaffolder</option>
                    <option value="crane_operator">Crane Operator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Certifying Authority</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PASMA / IPAF / OSHA"
                    value={competencyForm.certifying_body}
                    onChange={(e) => setCompetencyForm({ ...competencyForm, certifying_body: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Certification Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Working at Height & Fall Protection Level 2"
                  value={competencyForm.certification_name}
                  onChange={(e) => setCompetencyForm({ ...competencyForm, certification_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={competencyForm.issue_date}
                    onChange={(e) => setCompetencyForm({ ...competencyForm, issue_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={competencyForm.expiry_date}
                    onChange={(e) => setCompetencyForm({ ...competencyForm, expiry_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCompetencyModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Save Certification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: NEW APPRAISAL */}
      {showAppraisalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Record Performance Appraisal</h3>
            <form onSubmit={handleCreateAppraisal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Employee Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fatima Al-Nuaimi"
                  value={appraisalForm.employee_name}
                  onChange={(e) => setAppraisalForm({ ...appraisalForm, employee_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Review Period</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-H2 or Annual 2026"
                    value={appraisalForm.review_period}
                    onChange={(e) => setAppraisalForm({ ...appraisalForm, review_period: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Performance Score (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    required
                    value={appraisalForm.score}
                    onChange={(e) => setAppraisalForm({ ...appraisalForm, score: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Appraiser Name &amp; Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operations Director"
                  value={appraisalForm.appraiser_name}
                  onChange={(e) => setAppraisalForm({ ...appraisalForm, appraiser_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Key Strengths</label>
                <textarea
                  rows={2}
                  placeholder="Primary achievements and core strengths..."
                  value={appraisalForm.strengths}
                  onChange={(e) => setAppraisalForm({ ...appraisalForm, strengths: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Goals &amp; Development</label>
                <textarea
                  rows={2}
                  placeholder="Key performance objectives for the upcoming cycle..."
                  value={appraisalForm.goals}
                  onChange={(e) => setAppraisalForm({ ...appraisalForm, goals: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAppraisalModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Record Appraisal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
