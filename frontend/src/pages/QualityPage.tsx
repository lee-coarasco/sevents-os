import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type TradeDiscipline = "civil" | "mep" | "structural" | "finishes" | "piling" | "facade";
export type ITPStatus = "draft" | "approved" | "archived";
export type PointType = "hold_point" | "witness_point" | "surveillance" | "review";
export type WIRStatus = "draft" | "submitted" | "in_progress" | "approved" | "conditionally_approved" | "rejected";
export type ChecklistResult = "pending" | "pass" | "fail" | "na";
export type NCRSeverity = "minor" | "major" | "critical";
export type NCRStatus = "open" | "under_review" | "containment_applied" | "capa_submitted" | "verified_closed" | "voided";
export type RootCauseCategory = "workmanship" | "material_defect" | "design_clash" | "method_deviation" | "environmental";

export interface QualityInspectionPlan {
  id: string;
  project_id: string;
  plan_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  version: string;
  status: ITPStatus;
  applicable_specifications: string | null;
  created_at: string;
  items?: ITPInspectionItem[];
}

export interface ITPInspectionItem {
  id: string;
  plan_id: string;
  item_sequence: number;
  activity_name: string;
  acceptance_criteria: string;
  point_type: PointType;
  reference_standard: string | null;
  verifying_document: string | null;
}

export interface WorkInspectionRequest {
  id: string;
  project_id: string;
  plan_id: string | null;
  plan_title?: string;
  wir_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  location_or_grid: string;
  inspection_date: string;
  status: WIRStatus;
  contractor_representative: string | null;
  inspector_name: string | null;
  inspector_remarks: string | null;
  signed_off_at: string | null;
  created_at: string;
  checklist?: WIRChecklistItem[];
}

export interface WIRChecklistItem {
  id: string;
  wir_id: string;
  item_sequence: number;
  checkpoint_description: string;
  result: ChecklistResult;
  comments: string | null;
}

export interface NonConformanceReport {
  id: string;
  project_id: string;
  wir_id: string | null;
  wir_number?: string;
  ncr_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  location_or_grid: string;
  severity: NCRSeverity;
  status: NCRStatus;
  issue_description: string;
  root_cause_category: RootCauseCategory;
  issued_by: string;
  issued_to: string;
  target_closure_date: string | null;
  containment_action: string | null;
  corrective_action_plan: string | null;
  preventive_action_plan: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closure_remarks: string | null;
  created_at: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

export function QualityPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"wirs" | "ncrs" | "itps">("wirs");

  // Data states
  const [wirs, setWirs] = useState<WorkInspectionRequest[]>([]);
  const [ncrs, setNcrs] = useState<NonConformanceReport[]>([]);
  const [itps, setItps] = useState<QualityInspectionPlan[]>([]);

  // UI / Error
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [showNewWIRModal, setShowNewWIRModal] = useState(false);
  const [showNewNCRModal, setShowNewNCRModal] = useState(false);
  const [showNewITPModal, setShowNewITPModal] = useState(false);
  const [selectedWIR, setSelectedWIR] = useState<WorkInspectionRequest | null>(null);
  const [selectedNCR, setSelectedNCR] = useState<NonConformanceReport | null>(null);

  // Sign-off / CAPA states
  const [inspectorName, setInspectorName] = useState("");
  const [inspectorRemarks, setInspectorRemarks] = useState("");
  const [signOffStatus, setSignOffStatus] = useState<"approved" | "conditionally_approved" | "rejected">("approved");
  const [autoCreateNCR, setAutoCreateNCR] = useState(true);
  const [checklistEdits, setChecklistEdits] = useState<Record<string, { result: ChecklistResult; comments: string }>>({});

  // CAPA Form
  const [capaContainment, setCapaContainment] = useState("");
  const [capaCorrective, setCapaCorrective] = useState("");
  const [capaPreventive, setCapaPreventive] = useState("");

  // Close NCR Form
  const [closeClosedBy, setCloseClosedBy] = useState("");
  const [closeRemarks, setCloseRemarks] = useState("");

  // Initial load: Fetch Projects
  useEffect(() => {
    async function loadProjects() {
      if (!session?.access_token) return;
      try {
        const data = await apiFetch<{ projects: ProjectOption[] }>("/projects", session.access_token);
        setProjects(data.projects || []);
        const paramProj = searchParams.get("projectId");
        if (paramProj && data.projects.some((p) => p.id === paramProj)) {
          setSelectedProjectId(paramProj);
        } else if (data.projects.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load projects");
      }
    }
    loadProjects();
  }, [session?.access_token]);

  // Sync searchParam
  useEffect(() => {
    if (selectedProjectId) {
      setSearchParams({ projectId: selectedProjectId });
    }
  }, [selectedProjectId, setSearchParams]);

  // Load module data for selected project
  useEffect(() => {
    if (!session?.access_token || !selectedProjectId) return;

    async function loadData() {
      setError(null);
      try {
        const [wirData, ncrData, itpData] = await Promise.all([
          apiFetch<{ wirs: WorkInspectionRequest[] }>(`/projects/${selectedProjectId}/quality/wirs`, session!.access_token),
          apiFetch<{ ncrs: NonConformanceReport[] }>(`/projects/${selectedProjectId}/quality/ncrs`, session!.access_token),
          apiFetch<{ plans: QualityInspectionPlan[] }>(`/projects/${selectedProjectId}/quality/plans`, session!.access_token),
        ]);

        setWirs(wirData.wirs || []);
        setNcrs(ncrData.ncrs || []);
        setItps(itpData.plans || []);
      } catch (err: any) {
        setError(err.message || "Failed to load quality data");
      }
    }

    loadData();
  }, [session?.access_token, selectedProjectId]);

  // Refresh helper
  const refreshData = async () => {
    if (!session?.access_token || !selectedProjectId) return;
    try {
      const [wirData, ncrData, itpData] = await Promise.all([
        apiFetch<{ wirs: WorkInspectionRequest[] }>(`/projects/${selectedProjectId}/quality/wirs`, session.access_token),
        apiFetch<{ ncrs: NonConformanceReport[] }>(`/projects/${selectedProjectId}/quality/ncrs`, session.access_token),
        apiFetch<{ plans: QualityInspectionPlan[] }>(`/projects/${selectedProjectId}/quality/plans`, session.access_token),
      ]);
      setWirs(wirData.wirs || []);
      setNcrs(ncrData.ncrs || []);
      setItps(itpData.plans || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Open WIR Sign-off Drawer
  const openWIRDrawer = (wir: WorkInspectionRequest) => {
    setSelectedWIR(wir);
    setInspectorName(wir.inspector_name || "");
    setInspectorRemarks(wir.inspector_remarks || "");
    setSignOffStatus("approved");
    const initCheck: Record<string, { result: ChecklistResult; comments: string }> = {};
    (wir.checklist || []).forEach((c) => {
      initCheck[c.id] = { result: c.result, comments: c.comments || "" };
    });
    setChecklistEdits(initCheck);
  };

  // Submit WIR Sign-off
  const handleWIRSignOff = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !selectedWIR) return;
    setError(null);

    const checklistUpdates = Object.entries(checklistEdits).map(([id, val]) => ({
      id,
      result: val.result,
      comments: val.comments,
    }));

    try {
      await apiFetch(`/quality/wirs/${selectedWIR.id}/sign-off`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          status: signOffStatus,
          inspectorName,
          inspectorRemarks,
          checklistUpdates,
          autoCreateNcr: autoCreateNCR,
        }),
      });
      setSelectedWIR(null);
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to execute inspection sign-off");
    }
  };

  // Submit CAPA
  const handleCAPASubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !selectedNCR) return;
    setError(null);

    try {
      await apiFetch(`/quality/ncrs/${selectedNCR.id}/capa`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          containmentAction: capaContainment,
          correctiveActionPlan: capaCorrective,
          preventiveActionPlan: capaPreventive,
        }),
      });
      setSelectedNCR(null);
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to submit CAPA response");
    }
  };

  // Close NCR
  const handleNCRClose = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !selectedNCR) return;
    setError(null);

    try {
      await apiFetch(`/quality/ncrs/${selectedNCR.id}/close`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          closedBy: closeClosedBy,
          closureRemarks: closeRemarks,
        }),
      });
      setSelectedNCR(null);
      await refreshData();
    } catch (err: any) {
      setError(err.message || "Failed to close NCR");
    }
  };

  // Helper status badges
  const renderWIRStatusBadge = (status: WIRStatus) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">✓ Approved</span>;
      case "conditionally_approved":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">⚠ Conditionally Approved</span>;
      case "rejected":
        return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">✕ Rejected</span>;
      case "in_progress":
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">In Progress</span>;
      case "submitted":
        return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">Submitted</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">Draft</span>;
    }
  };

  const renderNCRSeverityBadge = (sev: NCRSeverity) => {
    switch (sev) {
      case "critical":
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Critical</span>;
      case "major":
        return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Major</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Minor</span>;
    }
  };

  const renderNCRStatusBadge = (status: NCRStatus) => {
    switch (status) {
      case "verified_closed":
        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Verified &amp; Closed</span>;
      case "capa_submitted":
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">CAPA Submitted</span>;
      case "containment_applied":
        return <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">Containment Applied</span>;
      case "open":
        return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">Open</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      {/* Header & Project Selector */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-brand text-2xl font-bold tracking-tight text-zinc-900">
            Quality Control, Inspection &amp; NCR
          </h1>
          <p className="font-body text-sm text-zinc-500">
            QA/QC Governance: Inspection &amp; Test Plans (ITP), Site Work Inspection Requests (WIR), and Non-Conformance Management (NCR/CAPA).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="project-select" className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Project:
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total Inspections (WIR)</p>
          <p className="mt-2 font-brand text-2xl font-bold text-zinc-900">{wirs.length}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {wirs.filter((w) => w.status === "approved" || w.status === "conditionally_approved").length} passed / approved
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Open NCRs</p>
          <p className="mt-2 font-brand text-2xl font-bold text-red-600">
            {ncrs.filter((n) => n.status !== "verified_closed" && n.status !== "voided").length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {ncrs.filter((n) => n.severity === "critical" && n.status !== "verified_closed").length} critical severity
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Closed NCRs (CAPA)</p>
          <p className="mt-2 font-brand text-2xl font-bold text-emerald-600">
            {ncrs.filter((n) => n.status === "verified_closed").length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Formally signed off</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Approved ITP Plans</p>
          <p className="mt-2 font-brand text-2xl font-bold text-zinc-900">
            {itps.filter((p) => p.status === "approved").length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{itps.length} total quality plans</p>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="mb-6 flex border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab("wirs")}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "wirs"
              ? "border-brand text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Inspection Requests (WIR / RFI)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ncrs")}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "ncrs"
              ? "border-brand text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Non-Conformance Reports (NCR &amp; CAPA)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("itps")}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "itps"
              ? "border-brand text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Inspection &amp; Test Plans (ITP)
        </button>
      </div>

      {/* Tab 1: WIR / Inspection Requests */}
      {activeTab === "wirs" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-zinc-900">Work Inspection Requests (WIR / RFI)</h2>
            <PermissionGate permission="quality.inspection.manage">
              <button
                type="button"
                onClick={() => setShowNewWIRModal(true)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
              >
                + New Inspection Request
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">WIR Number</th>
                  <th className="px-4 py-3">Title &amp; Scope</th>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3">Location / Grid</th>
                  <th className="px-4 py-3">Inspection Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-body">
                {wirs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No inspection requests logged for this project.
                    </td>
                  </tr>
                ) : (
                  wirs.map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900">{w.wir_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{w.title}</div>
                        {w.plan_title && <div className="text-xs text-zinc-400">ITP: {w.plan_title}</div>}
                      </td>
                      <td className="px-4 py-3 uppercase text-xs font-semibold text-zinc-600">{w.trade_discipline}</td>
                      <td className="px-4 py-3 text-zinc-600">{w.location_or_grid}</td>
                      <td className="px-4 py-3 text-zinc-600">{w.inspection_date}</td>
                      <td className="px-4 py-3">{renderWIRStatusBadge(w.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openWIRDrawer(w)}
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Review &amp; Sign-off →
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

      {/* Tab 2: Non-Conformance Reports (NCR) */}
      {activeTab === "ncrs" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-zinc-900">Non-Conformance Reports (NCR) &amp; CAPA Register</h2>
            <PermissionGate permission="quality.ncr.manage">
              <button
                type="button"
                onClick={() => setShowNewNCRModal(true)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
              >
                + Issue NCR
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-3">NCR Number</th>
                  <th className="px-4 py-3">Issue Title &amp; Trade</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Root Cause</th>
                  <th className="px-4 py-3">Issued To</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-body">
                {ncrs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                      No NCRs logged. Excellent quality compliance!
                    </td>
                  </tr>
                ) : (
                  ncrs.map((n) => (
                    <tr key={n.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                        {n.ncr_number}
                        {n.wir_number && <div className="text-xs text-zinc-400">Ref: {n.wir_number}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{n.title}</div>
                        <div className="text-xs text-zinc-500">{n.location_or_grid} • {n.trade_discipline.toUpperCase()}</div>
                      </td>
                      <td className="px-4 py-3">{renderNCRSeverityBadge(n.severity)}</td>
                      <td className="px-4 py-3 capitalize text-xs text-zinc-600">{n.root_cause_category.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-zinc-700">{n.issued_to}</td>
                      <td className="px-4 py-3 text-zinc-600">{n.target_closure_date || "—"}</td>
                      <td className="px-4 py-3">{renderNCRStatusBadge(n.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNCR(n);
                            setCapaContainment(n.containment_action || "");
                            setCapaCorrective(n.corrective_action_plan || "");
                            setCapaPreventive(n.preventive_action_plan || "");
                            setCloseClosedBy("");
                            setCloseRemarks("");
                          }}
                          className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Manage CAPA →
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

      {/* Tab 3: Inspection & Test Plans (ITP) */}
      {activeTab === "itps" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-zinc-900">Inspection &amp; Test Plans (ITP)</h2>
            <PermissionGate permission="quality.itp.manage">
              <button
                type="button"
                onClick={() => setShowNewITPModal(true)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
              >
                + New Quality Plan
              </button>
            </PermissionGate>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {itps.length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-zinc-100 bg-white p-8 text-center text-zinc-400">
                No Quality Inspection &amp; Test Plans defined. Create your project ITP to establish hold &amp; witness checkpoints.
              </div>
            ) : (
              itps.map((p) => (
                <div key={p.id} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-zinc-500">{p.plan_number}</span>
                      <h3 className="mt-1 font-brand text-lg font-bold text-zinc-900">{p.title}</h3>
                      <p className="text-xs uppercase font-semibold text-zinc-400">
                        {p.trade_discipline} • {p.version}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      p.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                    }`}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  {p.applicable_specifications && (
                    <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs text-zinc-600">
                      <span className="font-semibold text-zinc-800">Specs: </span>
                      {p.applicable_specifications}
                    </div>
                  )}

                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                      Checkpoints ({p.items?.length || 0})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {(p.items || []).map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-zinc-50">
                          <span className="font-medium text-zinc-800 truncate mr-2">{it.activity_name}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            it.point_type === "hold_point" ? "bg-red-100 text-red-700 font-bold" : "bg-blue-100 text-blue-700"
                          }`}>
                            {it.point_type.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: NEW WIR */}
      {showNewWIRModal && (
        <NewWIRModal
          projectId={selectedProjectId}
          itps={itps}
          token={session?.access_token || ""}
          onClose={() => setShowNewWIRModal(false)}
          onSuccess={async () => {
            setShowNewWIRModal(false);
            await refreshData();
          }}
        />
      )}

      {/* MODAL 2: NEW NCR */}
      {showNewNCRModal && (
        <NewNCRModal
          projectId={selectedProjectId}
          wirs={wirs}
          token={session?.access_token || ""}
          onClose={() => setShowNewNCRModal(false)}
          onSuccess={async () => {
            setShowNewNCRModal(false);
            await refreshData();
          }}
        />
      )}

      {/* MODAL 3: NEW ITP */}
      {showNewITPModal && (
        <NewITPModal
          projectId={selectedProjectId}
          token={session?.access_token || ""}
          onClose={() => setShowNewITPModal(false)}
          onSuccess={async () => {
            setShowNewITPModal(false);
            await refreshData();
          }}
        />
      )}

      {/* DRAWER: WIR REVIEW & SIGN-OFF */}
      {selectedWIR && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div>
                <span className="font-mono text-xs font-semibold text-zinc-500">{selectedWIR.wir_number}</span>
                <h2 className="font-brand text-xl font-bold text-zinc-900">{selectedWIR.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWIR(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <div className="my-4 grid grid-cols-2 gap-3 text-xs bg-stone-50 p-3 rounded-xl border border-zinc-100">
              <div><span className="font-semibold text-zinc-500">Trade: </span>{selectedWIR.trade_discipline.toUpperCase()}</div>
              <div><span className="font-semibold text-zinc-500">Location: </span>{selectedWIR.location_or_grid}</div>
              <div><span className="font-semibold text-zinc-500">Inspection Date: </span>{selectedWIR.inspection_date}</div>
              <div><span className="font-semibold text-zinc-500">Contractor Rep: </span>{selectedWIR.contractor_representative || "—"}</div>
            </div>

            <form onSubmit={handleWIRSignOff} className="space-y-5">
              {/* Checklist */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-2">
                  Inspection Checklist Criteria
                </label>
                <div className="space-y-3">
                  {(selectedWIR.checklist || []).map((chk) => (
                    <div key={chk.id} className="rounded-lg border border-zinc-200 p-3 bg-white">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-xs font-medium text-zinc-800">{chk.checkpoint_description}</span>
                        <select
                          value={checklistEdits[chk.id]?.result || chk.result}
                          onChange={(e) =>
                            setChecklistEdits({
                              ...checklistEdits,
                              [chk.id]: {
                                result: e.target.value as ChecklistResult,
                                comments: checklistEdits[chk.id]?.comments ?? chk.comments ?? "",
                              },
                            })
                          }
                          className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold"
                        >
                          <option value="pending">Pending</option>
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                          <option value="na">N/A</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Inspector remarks / notes for this checkpoint..."
                        value={checklistEdits[chk.id]?.comments ?? chk.comments ?? ""}
                        onChange={(e) =>
                          setChecklistEdits({
                            ...checklistEdits,
                            [chk.id]: {
                              result: checklistEdits[chk.id]?.result ?? chk.result,
                              comments: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign-off verdict */}
              <div className="border-t border-zinc-100 pt-4">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-2">
                  Quality Sign-off Determination
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignOffStatus("approved")}
                    className={`rounded-lg py-2 text-xs font-semibold border ${
                      signOffStatus === "approved"
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    ✓ Pass / Approved
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignOffStatus("conditionally_approved")}
                    className={`rounded-lg py-2 text-xs font-semibold border ${
                      signOffStatus === "conditionally_approved"
                        ? "bg-amber-500 text-white border-amber-600"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    ⚠ Conditional
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignOffStatus("rejected")}
                    className={`rounded-lg py-2 text-xs font-semibold border ${
                      signOffStatus === "rejected"
                        ? "bg-red-500 text-white border-red-600"
                        : "bg-white text-zinc-700 border-zinc-200"
                    }`}
                  >
                    ✕ Reject / Fail
                  </button>
                </div>
              </div>

              {signOffStatus === "rejected" && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-800">
                  <label className="flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCreateNCR}
                      onChange={(e) => setAutoCreateNCR(e.target.checked)}
                      className="rounded text-red-600"
                    />
                    Automatically issue Non-Conformance Report (NCR) for this failed inspection
                  </label>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-1">
                  Inspector Name *
                </label>
                <input
                  type="text"
                  required
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="e.g. Robert Smith (Consultant QA/QC)"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-1">
                  Overall Inspector Remarks
                </label>
                <textarea
                  rows={3}
                  value={inspectorRemarks}
                  onChange={(e) => setInspectorRemarks(e.target.value)}
                  placeholder="Summary of findings, punch items, or clearance instructions..."
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setSelectedWIR(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <PermissionGate permission="quality.inspection.signoff">
                  <button
                    type="submit"
                    className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
                  >
                    Execute Sign-off
                  </button>
                </PermissionGate>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: NCR & CAPA MANAGEMENT */}
      {selectedNCR && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-zinc-500">{selectedNCR.ncr_number}</span>
                  {renderNCRSeverityBadge(selectedNCR.severity)}
                  {renderNCRStatusBadge(selectedNCR.status)}
                </div>
                <h2 className="font-brand text-xl font-bold text-zinc-900 mt-1">{selectedNCR.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNCR(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <div className="my-4 rounded-xl border border-zinc-100 bg-stone-50 p-4 text-xs space-y-2">
              <div><span className="font-semibold text-zinc-600">Location: </span>{selectedNCR.location_or_grid}</div>
              <div><span className="font-semibold text-zinc-600">Discipline: </span>{selectedNCR.trade_discipline.toUpperCase()}</div>
              <div><span className="font-semibold text-zinc-600">Issued To: </span>{selectedNCR.issued_to} (by {selectedNCR.issued_by})</div>
              <div><span className="font-semibold text-zinc-600">Root Cause: </span>{selectedNCR.root_cause_category.replace("_", " ")}</div>
              <div className="border-t border-zinc-200 pt-2">
                <span className="font-semibold text-zinc-800">Defect Description:</span>
                <p className="mt-1 text-zinc-700 bg-white p-2.5 rounded border border-zinc-200">{selectedNCR.issue_description}</p>
              </div>
            </div>

            {/* CAPA Submission Form */}
            {selectedNCR.status !== "verified_closed" && (
              <form onSubmit={handleCAPASubmit} className="space-y-4 border-t border-zinc-100 pt-4">
                <h3 className="font-brand text-base font-bold text-zinc-900">Corrective &amp; Preventive Action (CAPA)</h3>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-1">
                    Immediate Containment Action
                  </label>
                  <input
                    type="text"
                    value={capaContainment}
                    onChange={(e) => setCapaContainment(e.target.value)}
                    placeholder="e.g. Work stopped, area tagged, temporary propping installed"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-1">
                    Corrective Action Plan (How to fix this occurrence) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={capaCorrective}
                    onChange={(e) => setCapaCorrective(e.target.value)}
                    placeholder="Specify repair methodology, surface prep, replacement materials, or re-testing procedure..."
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 block mb-1">
                    Preventive Action Plan (How to prevent recurrence) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={capaPreventive}
                    onChange={(e) => setCapaPreventive(e.target.value)}
                    placeholder="Process changes, toolbox talk training, calibration, vendor audit..."
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>

                <div className="flex justify-end">
                  <PermissionGate permission="quality.ncr.manage">
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
                    >
                      Save / Submit CAPA
                    </button>
                  </PermissionGate>
                </div>
              </form>
            )}

            {/* Closure Verification Section */}
            {selectedNCR.status === "capa_submitted" && (
              <form onSubmit={handleNCRClose} className="mt-6 space-y-4 border-t-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 rounded-xl">
                <h3 className="font-brand text-base font-bold text-emerald-900">Verification &amp; Final Closeout</h3>
                <p className="text-xs text-emerald-700">
                  Verify re-inspection or lab test results confirming defective work has been satisfactorily rectified.
                </p>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700 block mb-1">
                    Verified &amp; Closed By *
                  </label>
                  <input
                    type="text"
                    required
                    value={closeClosedBy}
                    onChange={(e) => setCloseClosedBy(e.target.value)}
                    placeholder="e.g. Lead QA/QC Consultant"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-700 block mb-1">
                    Closure Remarks &amp; Clearance Verification *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={closeRemarks}
                    onChange={(e) => setCloseRemarks(e.target.value)}
                    placeholder="Re-inspection passed. Structural engineer certified repair."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>

                <div className="flex justify-end">
                  <PermissionGate permission="quality.ncr.close">
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      ✓ Verify &amp; Formally Close NCR
                    </button>
                  </PermissionGate>
                </div>
              </form>
            )}

            {selectedNCR.status === "verified_closed" && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1">
                <p className="font-bold">✓ This Non-Conformance Report is closed.</p>
                <p>Closed by: {selectedNCR.closed_by} on {selectedNCR.closed_at}</p>
                <p>Remarks: {selectedNCR.closure_remarks}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-MODALS
// ---------------------------------------------------------------------------

function NewWIRModal({
  projectId,
  itps,
  token,
  onClose,
  onSuccess,
}: {
  projectId: string;
  itps: QualityInspectionPlan[];
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [wirNumber, setWirNumber] = useState(`WIR-${Date.now().toString().slice(-4)}`);
  const [title, setTitle] = useState("");
  const [tradeDiscipline, setTradeDiscipline] = useState<TradeDiscipline>("civil");
  const [locationOrGrid, setLocationOrGrid] = useState("");
  const [planId, setPlanId] = useState("");
  const [contractorRepresentative, setContractorRepresentative] = useState("");
  const [checkpoints, setCheckpoints] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-populate checklist if plan selected
  const handlePlanChange = (pId: string) => {
    setPlanId(pId);
    const plan = itps.find((p) => p.id === pId);
    if (plan && plan.items && plan.items.length > 0) {
      setCheckpoints(plan.items.map((it) => `${it.activity_name}: ${it.acceptance_criteria}`));
      setTradeDiscipline(plan.trade_discipline);
    }
  };

  const handleCheckpointChange = (idx: number, text: string) => {
    const next = [...checkpoints];
    next[idx] = text;
    setCheckpoints(next);
  };

  const addCheckpoint = () => {
    setCheckpoints([...checkpoints, ""]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const checklistItems = checkpoints
      .filter((c) => c.trim().length > 0)
      .map((desc, idx) => ({
        itemSequence: idx + 1,
        checkpointDescription: desc,
      }));

    try {
      await apiFetch(`/projects/${projectId}/quality/wirs`, token, {
        method: "POST",
        body: JSON.stringify({
          wirNumber,
          title,
          tradeDiscipline,
          locationOrGrid,
          planId: planId || undefined,
          contractorRepresentative,
          checklist: checklistItems,
        }),
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.message || "Failed to create WIR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
          <h2 className="font-brand text-lg font-bold text-zinc-900">New Work Inspection Request (WIR)</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {err && <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 font-body text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">WIR Number *</label>
              <input
                type="text"
                required
                value={wirNumber}
                onChange={(e) => setWirNumber(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Trade Discipline *</label>
              <select
                value={tradeDiscipline}
                onChange={(e) => setTradeDiscipline(e.target.value as TradeDiscipline)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="civil">Civil / Concrete</option>
                <option value="mep">MEP Services</option>
                <option value="structural">Structural Steel</option>
                <option value="finishes">Architectural Finishes</option>
                <option value="piling">Piling &amp; Geotech</option>
                <option value="facade">Facade / Glazing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Inspection Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Level 3 Column Reinforcement & Formwork Inspection"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Location or Grid Reference *</label>
              <input
                type="text"
                required
                value={locationOrGrid}
                onChange={(e) => setLocationOrGrid(e.target.value)}
                placeholder="e.g. Grid C2-C5 / Level 3"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Link to Approved ITP</label>
              <select
                value={planId}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="">-- None / Standalone --</option>
                {itps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plan_number}: {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Contractor Representative</label>
            <input
              type="text"
              value={contractorRepresentative}
              onChange={(e) => setContractorRepresentative(e.target.value)}
              placeholder="e.g. Site QA Engineer Mike"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold uppercase tracking-wide text-zinc-500">Inspection Checkpoints</label>
              <button type="button" onClick={addCheckpoint} className="text-brand font-bold text-xs hover:underline">
                + Add Checkpoint
              </button>
            </div>
            <div className="space-y-2">
              {checkpoints.map((c, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Checkpoint #${i + 1} acceptance criteria...`}
                  value={c}
                  onChange={(e) => handleCheckpointChange(i, e.target.value)}
                  className="w-full rounded border border-zinc-200 px-3 py-1.5 text-xs outline-none focus:border-brand"
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand px-5 py-2 font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
            >
              {loading ? "Submitting..." : "Submit WIR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewNCRModal({
  projectId,
  wirs,
  token,
  onClose,
  onSuccess,
}: {
  projectId: string;
  wirs: WorkInspectionRequest[];
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ncrNumber, setNcrNumber] = useState(`NCR-${Date.now().toString().slice(-4)}`);
  const [title, setTitle] = useState("");
  const [tradeDiscipline, setTradeDiscipline] = useState<TradeDiscipline>("civil");
  const [locationOrGrid, setLocationOrGrid] = useState("");
  const [severity, setSeverity] = useState<NCRSeverity>("major");
  const [rootCauseCategory, setRootCauseCategory] = useState<RootCauseCategory>("workmanship");
  const [issueDescription, setIssueDescription] = useState("");
  const [issuedBy, setIssuedBy] = useState("QHSE Engineer");
  const [issuedTo, setIssuedTo] = useState("");
  const [targetClosureDate, setTargetClosureDate] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [wirId, setWirId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      await apiFetch(`/projects/${projectId}/quality/ncrs`, token, {
        method: "POST",
        body: JSON.stringify({
          ncrNumber,
          title,
          tradeDiscipline,
          locationOrGrid,
          severity,
          issueDescription,
          rootCauseCategory,
          issuedBy,
          issuedTo,
          targetClosureDate: targetClosureDate || undefined,
          containmentAction: containmentAction || undefined,
          wirId: wirId || undefined,
        }),
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.message || "Failed to issue NCR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
          <h2 className="font-brand text-lg font-bold text-zinc-900">Issue Non-Conformance Report (NCR)</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {err && <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 font-body text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">NCR Number *</label>
              <input
                type="text"
                required
                value={ncrNumber}
                onChange={(e) => setNcrNumber(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as NCRSeverity)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="minor">Minor (Workmanship / Aesthetic)</option>
                <option value="major">Major (Performance / Specification Breach)</option>
                <option value="critical">Critical (Structural / Safety Compromise)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">NCR Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inadequate concrete cover on shear wall edge"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Trade Discipline *</label>
              <select
                value={tradeDiscipline}
                onChange={(e) => setTradeDiscipline(e.target.value as TradeDiscipline)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="civil">Civil</option>
                <option value="mep">MEP</option>
                <option value="structural">Structural</option>
                <option value="finishes">Finishes</option>
                <option value="piling">Piling</option>
                <option value="facade">Facade</option>
              </select>
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Root Cause Category</label>
              <select
                value={rootCauseCategory}
                onChange={(e) => setRootCauseCategory(e.target.value as RootCauseCategory)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="workmanship">Workmanship</option>
                <option value="material_defect">Material Defect</option>
                <option value="design_clash">Design Clash</option>
                <option value="method_deviation">Method Deviation</option>
                <option value="environmental">Environmental</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Location or Grid *</label>
              <input
                type="text"
                required
                value={locationOrGrid}
                onChange={(e) => setLocationOrGrid(e.target.value)}
                placeholder="e.g. Column C3 / Ground Level"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Related WIR (Optional)</label>
              <select
                value={wirId}
                onChange={(e) => setWirId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="">-- None / Field Observation --</option>
                {wirs.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.wir_number}: {w.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Defect / Issue Description *</label>
            <textarea
              rows={3}
              required
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="State precise defect findings, measurements, deviations from drawings or specifications..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Issued By (QA/QC Inspector) *</label>
              <input
                type="text"
                required
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="e.g. QHSE Lead Inspector"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Issued To (Contractor/Party) *</label>
              <input
                type="text"
                required
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
                placeholder="e.g. Main Contractor Civil Division"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Target Closure Date</label>
            <input
              type="date"
              value={targetClosureDate}
              onChange={(e) => setTargetClosureDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Immediate Containment Action</label>
            <input
              type="text"
              value={containmentAction}
              onChange={(e) => setContainmentAction(e.target.value)}
              placeholder="e.g. Stop pour, quarantine batch, barricade opening"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-600 px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              {loading ? "Issuing..." : "Issue NCR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewITPModal({
  projectId,
  token,
  onClose,
  onSuccess,
}: {
  projectId: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [planNumber, setPlanNumber] = useState(`ITP-${Date.now().toString().slice(-4)}`);
  const [title, setTitle] = useState("");
  const [tradeDiscipline, setTradeDiscipline] = useState<TradeDiscipline>("civil");
  const [applicableSpecifications, setApplicableSpecifications] = useState("");
  const [items, setItems] = useState<Array<{ activityName: string; criteria: string; pointType: PointType }>>([
    { activityName: "", criteria: "", pointType: "hold_point" },
  ]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const addItem = () => {
    setItems([...items, { activityName: "", criteria: "", pointType: "witness_point" }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const validItems = items
      .filter((it) => it.activityName.trim().length > 0)
      .map((it, idx) => ({
        itemSequence: idx + 1,
        activityName: it.activityName,
        acceptanceCriteria: it.criteria || "As per project specifications",
        pointType: it.pointType,
      }));

    try {
      await apiFetch(`/projects/${projectId}/quality/plans`, token, {
        method: "POST",
        body: JSON.stringify({
          planNumber,
          title,
          tradeDiscipline,
          applicableSpecifications,
          items: validItems,
        }),
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.message || "Failed to create ITP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
          <h2 className="font-brand text-lg font-bold text-zinc-900">New Inspection &amp; Test Plan (ITP)</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {err && <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 font-body text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Plan Number *</label>
              <input
                type="text"
                required
                value={planNumber}
                onChange={(e) => setPlanNumber(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Discipline *</label>
              <select
                value={tradeDiscipline}
                onChange={(e) => setTradeDiscipline(e.target.value as TradeDiscipline)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
              >
                <option value="civil">Civil</option>
                <option value="mep">MEP</option>
                <option value="structural">Structural</option>
                <option value="finishes">Finishes</option>
                <option value="piling">Piling</option>
                <option value="facade">Facade</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Plan Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pre-Cast Element Erection & Joint Grouting ITP"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Applicable Standards / Specs</label>
            <input
              type="text"
              value={applicableSpecifications}
              onChange={(e) => setApplicableSpecifications(e.target.value)}
              placeholder="e.g. BS EN 13670, Project Specification Division 3"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold uppercase tracking-wide text-zinc-500">Inspection &amp; Test Points</label>
              <button type="button" onClick={addItem} className="text-brand font-bold text-xs hover:underline">
                + Add Checkpoint
              </button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-lg border border-zinc-200 p-2.5 bg-stone-50 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Activity name / step..."
                      value={it.activityName}
                      onChange={(e) => updateItem(idx, "activityName", e.target.value)}
                      className="col-span-2 rounded border border-zinc-200 px-2.5 py-1 text-xs outline-none focus:border-brand bg-white"
                    />
                    <select
                      value={it.pointType}
                      onChange={(e) => updateItem(idx, "pointType", e.target.value)}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs bg-white"
                    >
                      <option value="hold_point">Hold Point (Mandatory)</option>
                      <option value="witness_point">Witness Point</option>
                      <option value="surveillance">Surveillance</option>
                      <option value="review">Review</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Acceptance criteria / tolerance..."
                    value={it.criteria}
                    onChange={(e) => updateItem(idx, "criteria", e.target.value)}
                    className="w-full rounded border border-zinc-200 px-2.5 py-1 text-xs outline-none focus:border-brand bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand px-5 py-2 font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
            >
              {loading ? "Creating..." : "Create Quality Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
