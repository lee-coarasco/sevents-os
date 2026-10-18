import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type PermitType =
  | "hot_work"
  | "working_at_height"
  | "confined_space"
  | "lifting_operations"
  | "deep_excavation"
  | "electrical_isolation";

export type PermitStatus = "draft" | "pending_approval" | "active" | "suspended" | "closed" | "cancelled";

export type IncidentType =
  | "near_miss"
  | "first_aid"
  | "medical_treatment"
  | "lost_time_injury"
  | "dangerous_occurrence"
  | "environmental_spill";

export type IncidentSeverity = "minor" | "moderate" | "major" | "critical" | "fatal";
export type IncidentStatus = "reported" | "under_investigation" | "capa_assigned" | "closed";

export type ObservationType = "unsafe_condition" | "unsafe_act" | "positive_intervention";
export type RiskLevel = "low" | "medium" | "high" | "imminent_danger";
export type HazardStatus = "open" | "in_progress" | "rectified" | "closed";

export type TradeDiscipline = "civil" | "mep" | "structural" | "finishes" | "piling" | "facade" | "general";

export interface SafetyPermitToWork {
  id: string;
  project_id: string;
  permit_number: string;
  permit_type: PermitType;
  title: string;
  location_or_grid: string;
  start_time: string;
  expiry_time: string;
  status: PermitStatus;
  contractor_name: string;
  supervisor_name: string;
  safety_officer_name: string | null;
  precautions_taken: string | null;
  gas_test_required: boolean;
  gas_test_results: string | null;
  created_at: string;
}

export interface SafetyIncident {
  id: string;
  project_id: string;
  incident_number: string;
  incident_date: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location_or_grid: string;
  description: string;
  injured_person_name: string | null;
  injury_details: string | null;
  lost_workdays: number;
  immediate_action_taken: string | null;
  root_cause_analysis: string | null;
  corrective_preventive_action: string | null;
  reported_by: string;
  investigated_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface SafetyHazardObservation {
  id: string;
  project_id: string;
  observation_number: string;
  observation_type: ObservationType;
  risk_level: RiskLevel;
  stop_work_issued: boolean;
  location_or_grid: string;
  description: string;
  action_required: string;
  status: HazardStatus;
  reported_by: string;
  assigned_to: string | null;
  rectification_evidence: string | null;
  target_rectification_date: string | null;
  rectified_at: string | null;
  created_at: string;
}

export interface SafetyToolboxTalk {
  id: string;
  project_id: string;
  tbt_number: string;
  talk_date: string;
  topic: string;
  conducted_by: string;
  trade_discipline: TradeDiscipline;
  attendee_count: number;
  key_points_discussed: string | null;
  notes: string | null;
  created_at: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

export function SafetyPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ptw" | "incidents" | "hazards" | "tbt">("ptw");

  // Data states
  const [permits, setPermits] = useState<SafetyPermitToWork[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [hazards, setHazards] = useState<SafetyHazardObservation[]>([]);
  const [toolboxTalks, setToolboxTalks] = useState<SafetyToolboxTalk[]>([]);

  // UI / Error
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [showNewPermitModal, setShowNewPermitModal] = useState(false);
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [showNewHazardModal, setShowNewHazardModal] = useState(false);
  const [showNewTbtModal, setShowNewTbtModal] = useState(false);

  const [selectedPermit, setSelectedPermit] = useState<SafetyPermitToWork | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<SafetyHazardObservation | null>(null);

  // Load projects list
  useEffect(() => {
    async function fetchProjects() {
      if (!session?.access_token) return;
      try {
        const data = await apiFetch<any>("/projects", session.access_token);
        const list = Array.isArray(data) ? data : data.projects || [];
        setProjects(list);
        const queryProjectId = searchParams.get("projectId");
        if (queryProjectId && list.some((p: ProjectOption) => p.id === queryProjectId)) {
          setSelectedProjectId(queryProjectId);
        } else if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
          setSearchParams((prev) => {
            prev.set("projectId", list[0].id);
            return prev;
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load projects");
      }
    }
    fetchProjects();
  }, [session?.access_token]);

  // Load project safety data when selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId || !session?.access_token) return;
    refreshData(selectedProjectId);
  }, [selectedProjectId, session?.access_token]);

  async function refreshData(projectId: string) {
    if (!session?.access_token) return;
    try {
      setError(null);
      const [ptwRes, incRes, hazRes, tbtRes] = await Promise.all([
        apiFetch<any>(`/projects/${projectId}/safety/permits`, session.access_token),
        apiFetch<any>(`/projects/${projectId}/safety/incidents`, session.access_token),
        apiFetch<any>(`/projects/${projectId}/safety/hazards`, session.access_token),
        apiFetch<any>(`/projects/${projectId}/safety/toolbox-talks`, session.access_token),
      ]);
      setPermits(Array.isArray(ptwRes) ? ptwRes : ptwRes.permits || []);
      setIncidents(Array.isArray(incRes) ? incRes : incRes.incidents || []);
      setHazards(Array.isArray(hazRes) ? hazRes : hazRes.hazards || []);
      setToolboxTalks(Array.isArray(tbtRes) ? tbtRes : tbtRes.toolboxTalks || []);
    } catch (err: any) {
      setError(err.message || "Failed to load safety records");
    }
  }

  const handleProjectSelect = (pid: string) => {
    setSelectedProjectId(pid);
    setSearchParams((prev) => {
      prev.set("projectId", pid);
      return prev;
    });
  };

  const hasActiveStopWork = hazards.some(
    (h) => h.stop_work_issued && (h.status === "open" || h.status === "in_progress")
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Safety, Incidents &amp; Compliance</h1>
          <p className="text-sm text-zinc-500">
            QHSE Governance: High-Risk Permits to Work (PTW), Incident Investigations, Hazard &amp; Stop-Work Directives, and Daily Toolbox Talks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="project-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm focus:border-brand focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stop Work Warning Banner */}
      {hasActiveStopWork && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-600 p-2 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-900">ACTIVE STOP-WORK ORDER IN EFFECT</h3>
              <p className="text-xs text-red-700">
                One or more hazard observations have triggered an immediate stop-work directive. All related activities must pause until authorized rectification and clearance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold text-red-800 underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("ptw")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "ptw"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Permits to Work (PTW)</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {permits.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "incidents"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Incidents &amp; Lost Workdays</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {incidents.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("hazards")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "hazards"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Hazard Observations &amp; Stop-Work</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {hazards.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("tbt")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "tbt"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Toolbox Talks (TBT)</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {toolboxTalks.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Permits to Work (PTW) */}
      {activeTab === "ptw" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              High-risk gating permits require human Safety Officer authorization and gas test validation where mandatory.
            </p>
            <PermissionGate permission="safety.ptw.manage">
              <button
                onClick={() => setShowNewPermitModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Issue Permit to Work
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Permit #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Title &amp; Location</th>
                  <th className="px-4 py-3">Contractor / Supervisor</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3">Gas Test</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {permits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No permits to work recorded for this project.
                    </td>
                  </tr>
                ) : (
                  permits.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{p.permit_number}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200 uppercase">
                          {p.permit_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{p.title}</div>
                        <div className="text-xs text-zinc-500">{p.location_or_grid}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{p.contractor_name}</div>
                        <div className="text-xs text-zinc-500">Sup: {p.supervisor_name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        <div>From: {new Date(p.start_time).toLocaleDateString()} {new Date(p.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>Exp: {new Date(p.expiry_time).toLocaleDateString()} {new Date(p.expiry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-3">
                        {p.gas_test_required ? (
                          p.gas_test_results ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200" title={p.gas_test_results}>
                              Pass ({p.gas_test_results})
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                              Missing Results
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-zinc-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "pending_approval"
                              ? "bg-amber-100 text-amber-800"
                              : p.status === "suspended"
                              ? "bg-red-100 text-red-800"
                              : p.status === "closed"
                              ? "bg-zinc-100 text-zinc-700"
                              : "bg-zinc-100 text-zinc-800"
                          }`}
                        >
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedPermit(p)}
                          className="font-medium text-zinc-900 hover:text-brand underline text-xs"
                        >
                          Review / Sign-off
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Safety Incidents */}
      {activeTab === "incidents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Log incident reports, track lost workdays, assign Root Cause Analysis (RCA), and implement CAPA actions.
            </p>
            <PermissionGate permission="safety.incident.manage">
              <button
                onClick={() => setShowNewIncidentModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Report Safety Incident
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Incident #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Description &amp; Location</th>
                  <th className="px-4 py-3">Lost Workdays</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No safety incidents reported. Zero-incident record maintained!
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{inc.incident_number}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{new Date(inc.incident_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
                          {inc.incident_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            inc.severity === "critical" || inc.severity === "fatal"
                              ? "bg-red-100 text-red-800 font-bold"
                              : inc.severity === "major"
                              ? "bg-orange-100 text-orange-800"
                              : inc.severity === "moderate"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-medium text-zinc-900 truncate" title={inc.description}>{inc.description}</div>
                        <div className="text-xs text-zinc-500">{inc.location_or_grid}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {inc.lost_workdays > 0 ? (
                          <span className="text-red-600">{inc.lost_workdays} days</span>
                        ) : (
                          <span className="text-zinc-400">0 days</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            inc.status === "closed"
                              ? "bg-emerald-100 text-emerald-800"
                              : inc.status === "capa_assigned"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {inc.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedIncident(inc)}
                          className="font-medium text-zinc-900 hover:text-brand underline text-xs"
                        >
                          Investigate / Close
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Hazard Observations & Stop Work */}
      {activeTab === "hazards" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Unsafe condition/act reporting with immediate Stop-Work directive authority on high-risk &amp; imminent danger conditions.
            </p>
            <PermissionGate permission="safety.hazard.manage">
              <button
                onClick={() => setShowNewHazardModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Log Hazard Observation
              </button>
            </PermissionGate>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hazards.length === 0 ? (
              <div className="col-span-full py-8 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                No hazard observations reported.
              </div>
            ) : (
              hazards.map((haz) => (
                <div
                  key={haz.id}
                  className={`rounded-xl border p-4 bg-white shadow-sm flex flex-col justify-between ${
                    haz.stop_work_issued ? "border-red-300 ring-1 ring-red-300" : "border-zinc-200"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-zinc-900">{haz.observation_number}</span>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          haz.risk_level === "imminent_danger"
                            ? "bg-red-600 text-white font-bold"
                            : haz.risk_level === "high"
                            ? "bg-orange-100 text-orange-800 font-semibold"
                            : haz.risk_level === "medium"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {haz.risk_level.replace(/_/g, " ")}
                      </span>
                    </div>

                    {haz.stop_work_issued && (
                      <div className="rounded-md bg-red-50 p-1.5 text-xs font-semibold text-red-700 flex items-center gap-1.5">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        STOP-WORK ORDER ISSUED
                      </div>
                    )}

                    <div className="text-sm font-semibold text-zinc-900">{haz.description}</div>
                    <div className="text-xs text-zinc-500">Location: {haz.location_or_grid}</div>
                    <div className="text-xs text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                      <span className="font-semibold text-zinc-700">Action Required: </span>
                      {haz.action_required}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                        haz.status === "rectified" || haz.status === "closed"
                          ? "bg-emerald-100 text-emerald-800"
                          : haz.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {haz.status.replace(/_/g, " ")}
                    </span>
                    <button
                      onClick={() => setSelectedHazard(haz)}
                      className="font-medium text-zinc-900 hover:text-brand underline"
                    >
                      Rectification &amp; Clearance
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Toolbox Talks (TBT) */}
      {activeTab === "tbt" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Daily safety briefings, topic discussions, and trade attendee registers.
            </p>
            <PermissionGate permission="safety.tbt.manage">
              <button
                onClick={() => setShowNewTbtModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Record Toolbox Talk
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">TBT #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Trade Discipline</th>
                  <th className="px-4 py-3">Conducted By</th>
                  <th className="px-4 py-3">Attendees</th>
                  <th className="px-4 py-3">Key Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {toolboxTalks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      No toolbox talks recorded for this project yet.
                    </td>
                  </tr>
                ) : (
                  toolboxTalks.map((tbt) => (
                    <tr key={tbt.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{tbt.tbt_number}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{new Date(tbt.talk_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{tbt.topic}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 uppercase">
                          {tbt.trade_discipline}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{tbt.conducted_by}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{tbt.attendee_count} workers</td>
                      <td className="px-4 py-3 max-w-sm text-xs text-zinc-600 truncate" title={tbt.key_points_discussed || ""}>
                        {tbt.key_points_discussed || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Permit */}
      {showNewPermitModal && (
        <CreatePermitModal
          projectId={selectedProjectId}
          onClose={() => setShowNewPermitModal(false)}
          onSuccess={() => {
            setShowNewPermitModal(false);
            refreshData(selectedProjectId);
          }}
        />
      )}

      {/* MODAL 2: Create Incident */}
      {showNewIncidentModal && (
        <CreateIncidentModal
          projectId={selectedProjectId}
          onClose={() => setShowNewIncidentModal(false)}
          onSuccess={() => {
            setShowNewIncidentModal(false);
            refreshData(selectedProjectId);
          }}
        />
      )}

      {/* MODAL 3: Create Hazard */}
      {showNewHazardModal && (
        <CreateHazardModal
          projectId={selectedProjectId}
          onClose={() => setShowNewHazardModal(false)}
          onSuccess={() => {
            setShowNewHazardModal(false);
            refreshData(selectedProjectId);
          }}
        />
      )}

      {/* MODAL 4: Create Toolbox Talk */}
      {showNewTbtModal && (
        <CreateTbtModal
          projectId={selectedProjectId}
          onClose={() => setShowNewTbtModal(false)}
          onSuccess={() => {
            setShowNewTbtModal(false);
            refreshData(selectedProjectId);
          }}
        />
      )}

      {/* DRAWER 1: Review/Authorize Permit */}
      {selectedPermit && (
        <PermitAuthorizationDrawer
          permit={selectedPermit}
          onClose={() => setSelectedPermit(null)}
          onSuccess={() => {
            setSelectedPermit(null);
            refreshData(selectedProjectId);
          }}
        />
      )}

      {/* DRAWER 2: Incident Investigation & Closure */}
      {selectedIncident && (
        <IncidentInvestigationDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onSuccess={() => {
            setSelectedIncident(null);
            refreshData(selectedProjectId);
          }}
        />
      )}

      {/* DRAWER 3: Hazard Rectification */}
      {selectedHazard && (
        <HazardRectificationDrawer
          hazard={selectedHazard}
          onClose={() => setSelectedHazard(null)}
          onSuccess={() => {
            setSelectedHazard(null);
            refreshData(selectedProjectId);
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// Subcomponents & Modals
// ==========================================

function CreatePermitModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [permitNumber, setPermitNumber] = useState(`PTW-${Date.now().toString().slice(-6)}`);
  const [permitType, setPermitType] = useState<PermitType>("hot_work");
  const [title, setTitle] = useState("");
  const [locationOrGrid, setLocationOrGrid] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [expiryTime, setExpiryTime] = useState(
    new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [gasTestRequired, setGasTestRequired] = useState(false);
  const [gasTestResults, setGasTestResults] = useState("");
  const [precautionsTaken, setPrecautionsTaken] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/projects/${projectId}/safety/permits`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            permitNumber,
            permitType,
            title,
            locationOrGrid,
            contractorName,
            supervisorName,
            startTime: new Date(startTime).toISOString(),
            expiryTime: new Date(expiryTime).toISOString(),
            gasTestRequired,
            gasTestResults: gasTestRequired ? gasTestResults : undefined,
            precautionsTaken,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create permit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Issue Permit to Work (PTW)</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Permit #</label>
              <input
                type="text"
                required
                value={permitNumber}
                onChange={(e) => setPermitNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Permit Type</label>
              <select
                value={permitType}
                onChange={(e) => {
                  const val = e.target.value as PermitType;
                  setPermitType(val);
                  if (val === "confined_space" || val === "deep_excavation") {
                    setGasTestRequired(true);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="hot_work">Hot Work (Welding/Grinding)</option>
                <option value="working_at_height">Working at Height</option>
                <option value="confined_space">Confined Space Entry</option>
                <option value="lifting_operations">Heavy Lifting Operations</option>
                <option value="deep_excavation">Deep Excavation &gt; 1.5m</option>
                <option value="electrical_isolation">High Voltage / Isolation</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Activity Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Structural steel welding on Grid C-4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Location / Grid Reference</label>
            <input
              type="text"
              required
              placeholder="e.g. Level 4 Slab, Zone B"
              value={locationOrGrid}
              onChange={(e) => setLocationOrGrid(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Subcontractor</label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Steel Works"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Site Supervisor</label>
              <input
                type="text"
                required
                placeholder="e.g. Mark Vance"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Start Time</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Expiry Time</label>
              <input
                type="datetime-local"
                required
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
              <input
                type="checkbox"
                checked={gasTestRequired}
                onChange={(e) => setGasTestRequired(e.target.checked)}
                className="rounded border-zinc-300 text-brand focus:ring-brand"
              />
              Mandatory Multi-Gas Atmospheric Test Required
            </label>
            {gasTestRequired && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600">Gas Test Measurement Results</label>
                <input
                  type="text"
                  placeholder="e.g. O2: 20.9%, LEL: 0%, H2S: 0ppm, CO: 0ppm (Calibrated sensor #881)"
                  value={gasTestResults}
                  onChange={(e) => setGasTestResults(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Mandatory Precautions &amp; PPE</label>
            <textarea
              rows={2}
              placeholder="e.g. Fire watch posted, 9kg dry powder extinguisher within 5m, full-body safety harness tied off to certified lifeline"
              value={precautionsTaken}
              onChange={(e) => setPrecautionsTaken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Permit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PermitAuthorizationDrawer({
  permit,
  onClose,
  onSuccess,
}: {
  permit: SafetyPermitToWork;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decision, setDecision] = useState<"active" | "suspended" | "closed" | "cancelled">("active");
  const [safetyOfficerName, setSafetyOfficerName] = useState(permit.safety_officer_name || session?.user.email || "");
  const [precautionsTaken, setPrecautionsTaken] = useState(permit.precautions_taken || "");

  const handleAuthorize = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/safety/permits/${permit.id}/authorize`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            status: decision,
            safetyOfficerName,
            precautionsTaken,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to update permit authorization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-zinc-500">{permit.permit_number}</span>
            <h2 className="text-lg font-bold text-zinc-900">Safety Officer Sign-off</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <div className="rounded-lg bg-zinc-50 p-3 space-y-2 border border-zinc-200 text-xs text-zinc-700">
          <div><span className="font-semibold">Type:</span> {permit.permit_type.replace(/_/g, " ")}</div>
          <div><span className="font-semibold">Title:</span> {permit.title}</div>
          <div><span className="font-semibold">Location:</span> {permit.location_or_grid}</div>
          <div><span className="font-semibold">Contractor:</span> {permit.contractor_name}</div>
          <div><span className="font-semibold">Supervisor:</span> {permit.supervisor_name}</div>
          <div><span className="font-semibold">Current Status:</span> {permit.status}</div>
          <div>
            <span className="font-semibold">Gas Testing:</span>{" "}
            {permit.gas_test_required
              ? permit.gas_test_results
                ? `Passed (${permit.gas_test_results})`
                : "Required but missing!"
              : "Not required"}
          </div>
        </div>

        <PermissionGate permission="safety.ptw.approve">
          <form onSubmit={handleAuthorize} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Authorization Action</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="active">Authorize &amp; Activate Permit</option>
                <option value="suspended">Suspend Permit (Halt Operations)</option>
                <option value="closed">Close Permit (Work Completed)</option>
                <option value="cancelled">Cancel Permit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">
                Safety Officer Name (Digital Signature)
              </label>
              <input
                type="text"
                required
                value={safetyOfficerName}
                onChange={(e) => setSafetyOfficerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">
                Additional Safety Directives / Endorsements
              </label>
              <textarea
                rows={3}
                value={precautionsTaken}
                onChange={(e) => setPrecautionsTaken(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Confirm Safety Authorization"}
            </button>
          </form>
        </PermissionGate>
      </div>

      <div className="pt-4 border-t">
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
}

function CreateIncidentModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incidentNumber, setIncidentNumber] = useState(`INC-${Date.now().toString().slice(-6)}`);
  const [incidentType, setIncidentType] = useState<IncidentType>("near_miss");
  const [severity, setSeverity] = useState<IncidentSeverity>("minor");
  const [locationOrGrid, setLocationOrGrid] = useState("");
  const [description, setDescription] = useState("");
  const [injuredPersonName, setInjuredPersonName] = useState("");
  const [injuryDetails, setInjuryDetails] = useState("");
  const [lostWorkdays, setLostWorkdays] = useState(0);
  const [immediateActionTaken, setImmediateActionTaken] = useState("");
  const [reportedBy, setReportedBy] = useState(session?.user.email || "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/projects/${projectId}/safety/incidents`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            incidentNumber,
            incidentType,
            severity,
            locationOrGrid,
            description,
            injuredPersonName: injuredPersonName || undefined,
            injuryDetails: injuryDetails || undefined,
            lostWorkdays: Number(lostWorkdays) || 0,
            immediateActionTaken: immediateActionTaken || undefined,
            reportedBy,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to log incident");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Report Safety Incident</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Incident #</label>
              <input
                type="text"
                required
                value={incidentNumber}
                onChange={(e) => setIncidentNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="near_miss">Near Miss</option>
                <option value="first_aid">First Aid Case</option>
                <option value="medical_treatment">Medical Treatment Injury</option>
                <option value="lost_time_injury">Lost Time Injury (LTI)</option>
                <option value="dangerous_occurrence">Dangerous Occurrence</option>
                <option value="environmental_spill">Environmental Spill</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
                <option value="fatal">Fatal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Location / Grid</label>
              <input
                type="text"
                required
                placeholder="e.g. Basement 1 Pump Room"
                value={locationOrGrid}
                onChange={(e) => setLocationOrGrid(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Incident Description</label>
            <textarea
              rows={2}
              required
              placeholder="What happened? Describe sequence of events..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Injured Person (if any)</label>
              <input
                type="text"
                placeholder="Name of worker"
                value={injuredPersonName}
                onChange={(e) => setInjuredPersonName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Lost Workdays</label>
              <input
                type="number"
                min="0"
                value={lostWorkdays}
                onChange={(e) => setLostWorkdays(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Injury Details</label>
            <input
              type="text"
              placeholder="e.g. Laceration to left forearm, required 3 stitches"
              value={injuryDetails}
              onChange={(e) => setInjuryDetails(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Immediate Action Taken</label>
            <input
              type="text"
              placeholder="e.g. First aid applied on site, area cordoned off"
              value={immediateActionTaken}
              onChange={(e) => setImmediateActionTaken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Reported By</label>
            <input
              type="text"
              required
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Log Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IncidentInvestigationDrawer({
  incident,
  onClose,
  onSuccess,
}: {
  incident: SafetyIncident;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [investigatorName, setInvestigatorName] = useState(incident.investigated_by || session?.user.email || "");
  const [rootCause, setRootCause] = useState(incident.root_cause_analysis || "");
  const [capa, setCapa] = useState(incident.corrective_preventive_action || "");
  const [lostWorkdays, setLostWorkdays] = useState(incident.lost_workdays || 0);

  const handleInvestigate = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/safety/incidents/${incident.id}/investigate`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            investigatedBy: investigatorName,
            rootCauseAnalysis: rootCause,
            correctivePreventiveAction: capa,
            lostWorkdays: Number(lostWorkdays),
            status: "capa_assigned",
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to update investigation");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseIncident = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/safety/incidents/${incident.id}/close`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            closedBy: session.user.email || "Safety Officer",
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to close incident");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-zinc-500">{incident.incident_number}</span>
            <h2 className="text-lg font-bold text-zinc-900">Incident Investigation</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <div className="rounded-lg bg-zinc-50 p-3 space-y-1.5 border border-zinc-200 text-xs text-zinc-700">
          <div><span className="font-semibold">Type:</span> {incident.incident_type.replace(/_/g, " ")}</div>
          <div><span className="font-semibold">Severity:</span> {incident.severity}</div>
          <div><span className="font-semibold">Description:</span> {incident.description}</div>
          <div><span className="font-semibold">Location:</span> {incident.location_or_grid}</div>
          {incident.injured_person_name && (
            <div><span className="font-semibold">Injured Person:</span> {incident.injured_person_name} ({incident.injury_details || "N/A"})</div>
          )}
          <div><span className="font-semibold">Status:</span> {incident.status}</div>
        </div>

        <PermissionGate permission="safety.incident.investigate">
          <form onSubmit={handleInvestigate} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Lead Investigator</label>
              <input
                type="text"
                required
                value={investigatorName}
                onChange={(e) => setInvestigatorName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Lost Workdays</label>
              <input
                type="number"
                min="0"
                value={lostWorkdays}
                onChange={(e) => setLostWorkdays(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">
                Root Cause Analysis (5-Whys / Fishbone)
              </label>
              <textarea
                rows={3}
                required
                placeholder="Identify underlying direct and latent causes..."
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">
                Corrective &amp; Preventive Actions (CAPA)
              </label>
              <textarea
                rows={3}
                required
                placeholder="Action plan to prevent recurrence..."
                value={capa}
                onChange={(e) => setCapa(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save RCA & CAPA Assignment"}
            </button>
          </form>

          {incident.status !== "closed" && (
            <div className="pt-3 border-t">
              <button
                type="button"
                onClick={handleCloseIncident}
                disabled={loading || !incident.root_cause_analysis}
                className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                title={!incident.root_cause_analysis ? "RCA must be recorded before closure" : undefined}
              >
                Verify CAPA &amp; Formally Close Incident
              </button>
            </div>
          )}
        </PermissionGate>
      </div>

      <div className="pt-4 border-t">
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
}

function CreateHazardModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [obsNumber, setObsNumber] = useState(`HAZ-${Date.now().toString().slice(-6)}`);
  const [obsType, setObsType] = useState<ObservationType>("unsafe_condition");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [stopWork, setStopWork] = useState(false);
  const [locationOrGrid, setLocationOrGrid] = useState("");
  const [description, setDescription] = useState("");
  const [actionRequired, setActionRequired] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/projects/${projectId}/safety/hazards`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            observationNumber: obsNumber,
            observationType: obsType,
            riskLevel,
            stopWorkIssued: riskLevel === "imminent_danger" ? true : stopWork,
            locationOrGrid,
            description,
            actionRequired,
            assignedTo: assignedTo || undefined,
            reportedBy: session.user.email || "QHSE Officer",
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to log hazard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Log Hazard Observation</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Observation #</label>
              <input
                type="text"
                required
                value={obsNumber}
                onChange={(e) => setObsNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Type</label>
              <select
                value={obsType}
                onChange={(e) => setObsType(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="unsafe_condition">Unsafe Condition</option>
                <option value="unsafe_act">Unsafe Act</option>
                <option value="positive_intervention">Positive Intervention</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Risk Level</label>
              <select
                value={riskLevel}
                onChange={(e) => {
                  const val = e.target.value as RiskLevel;
                  setRiskLevel(val);
                  if (val === "imminent_danger") {
                    setStopWork(true);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-semibold"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
                <option value="imminent_danger">Imminent Danger (Stop-Work Required)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Location / Grid</label>
              <input
                type="text"
                required
                placeholder="e.g. Roof parapet edge"
                value={locationOrGrid}
                onChange={(e) => setLocationOrGrid(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-red-900">
              <input
                type="checkbox"
                checked={stopWork || riskLevel === "imminent_danger"}
                disabled={riskLevel === "imminent_danger"}
                onChange={(e) => setStopWork(e.target.checked)}
                className="rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              Issue Immediate Stop-Work Directive
            </label>
            <p className="text-[11px] text-red-700 mt-1">
              Halt activities in the vicinity until rectified. Imminent danger hazards mandate an automatic stop-work order.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Hazard Description</label>
            <textarea
              rows={2}
              required
              placeholder="Detail the observed condition or unsafe behavior..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Action Required</label>
            <textarea
              rows={2}
              required
              placeholder="Immediate remediation instruction..."
              value={actionRequired}
              onChange={(e) => setActionRequired(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Assigned To (Trade / Contractor)</label>
            <input
              type="text"
              placeholder="e.g. Scaffolding Gang #2"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Record Observation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HazardRectificationDrawer({
  hazard,
  onClose,
  onSuccess,
}: {
  hazard: SafetyHazardObservation;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rectificationEvidence, setRectificationEvidence] = useState(hazard.rectification_evidence || "");
  const [status, setStatus] = useState<"rectified" | "closed">("rectified");

  const handleRectify = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/safety/hazards/${hazard.id}/rectify`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            rectificationEvidence,
            status,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit rectification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-zinc-500">{hazard.observation_number}</span>
            <h2 className="text-lg font-bold text-zinc-900">Hazard Rectification</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <div className="rounded-lg bg-zinc-50 p-3 space-y-1.5 border border-zinc-200 text-xs text-zinc-700">
          <div><span className="font-semibold">Risk Level:</span> {hazard.risk_level.replace(/_/g, " ")}</div>
          <div><span className="font-semibold">Description:</span> {hazard.description}</div>
          <div><span className="font-semibold">Location:</span> {hazard.location_or_grid}</div>
          <div><span className="font-semibold">Action Required:</span> {hazard.action_required}</div>
          {hazard.stop_work_issued && (
            <div className="text-red-700 font-bold">Stop-Work directive currently active</div>
          )}
        </div>

        <PermissionGate permission="safety.hazard.manage">
          <form onSubmit={handleRectify} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Status Update</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="rectified">Rectified (Awaiting Final Closure)</option>
                <option value="closed">Formally Closed &amp; Stop-Work Lifted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">
                Rectification Evidence &amp; Verification
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe actions taken, verification photos, barrier installation, etc..."
                value={rectificationEvidence}
                onChange={(e) => setRectificationEvidence(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Submit Rectification & Lift Gating"}
            </button>
          </form>
        </PermissionGate>
      </div>

      <div className="pt-4 border-t">
        <button
          onClick={onClose}
          className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
}

function CreateTbtModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tbtNumber, setTbtNumber] = useState(`TBT-${Date.now().toString().slice(-6)}`);
  const [topic, setTopic] = useState("");
  const [tradeDiscipline, setTradeDiscipline] = useState<TradeDiscipline>("civil");
  const [conductedBy, setConductedBy] = useState(session?.user.email || "");
  const [attendeeCount, setAttendeeCount] = useState(10);
  const [keyPoints, setKeyPoints] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/projects/${projectId}/safety/toolbox-talks`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            tbtNumber,
            topic,
            tradeDiscipline,
            conductedBy,
            attendeeCount: Number(attendeeCount) || 1,
            keyPointsDiscussed: keyPoints || undefined,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to record toolbox talk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Record Daily Toolbox Talk (TBT)</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">TBT #</label>
              <input
                type="text"
                required
                value={tbtNumber}
                onChange={(e) => setTbtNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Trade Discipline</label>
              <select
                value={tradeDiscipline}
                onChange={(e) => setTradeDiscipline(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="civil">Civil &amp; Concreting</option>
                <option value="structural">Structural Steel</option>
                <option value="mep">MEP &amp; HVAC</option>
                <option value="finishes">Finishes &amp; Drywall</option>
                <option value="piling">Piling &amp; Shoring</option>
                <option value="facade">Facade &amp; Glazing</option>
                <option value="general">General Site Safety</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Briefing Topic</label>
            <input
              type="text"
              required
              placeholder="e.g. Scaffolding Tagging & 100% Tie-Off"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Conducted By</label>
              <input
                type="text"
                required
                placeholder="Supervisor / Safety Officer name"
                value={conductedBy}
                onChange={(e) => setConductedBy(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Trade Attendees Count</label>
              <input
                type="number"
                min="1"
                required
                value={attendeeCount}
                onChange={(e) => setAttendeeCount(parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Key Safety Points Discussed</label>
            <textarea
              rows={3}
              placeholder="Outline specific hazard controls reviewed with the gang..."
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Record Toolbox Talk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
