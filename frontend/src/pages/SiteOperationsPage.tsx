import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type DprStatus = "draft" | "submitted" | "approved" | "rejected";
export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "sunny"
  | "rain"
  | "heavy_rain"
  | "dust_storm"
  | "extreme_heat"
  | "other";
export type WeatherImpact = "none" | "minor_delay" | "work_stoppage";
export type BlockerCategory =
  | "material_shortage"
  | "drawing_delay"
  | "inspection_pending"
  | "access_blocked"
  | "weather"
  | "subcontractor_default"
  | "safety_stop"
  | "other";
export type BlockerStatus = "open" | "resolved";
export type SiteInstructionPriority = "low" | "normal" | "urgent";
export type SiteInstructionStatus = "open" | "in_progress" | "completed" | "acknowledged";

export interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

export interface DailyProgressReport {
  id: string;
  tenant_id: string;
  project_id: string;
  report_date: string;
  status: DprStatus;
  weather_condition: WeatherCondition;
  temperature_celsius: number | null;
  weather_impact: WeatherImpact | null;
  general_notes: string | null;
  site_engineer_id: string | null;
  supervisor_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DprManpowerEntry {
  id: string;
  tenant_id: string;
  dpr_id: string;
  trade: string;
  headcount: number;
  hours_worked: number;
  subcontractor_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface DprEquipmentEntry {
  id: string;
  tenant_id: string;
  dpr_id: string;
  equipment_type: string;
  quantity: number;
  operating_hours: number;
  idle_hours: number;
  notes: string | null;
  created_at: string;
}

export interface DprWorkProgressEntry {
  id: string;
  tenant_id: string;
  dpr_id: string;
  schedule_activity_id: string | null;
  location_or_grid: string | null;
  description: string;
  quantity_executed: number | null;
  uom: string | null;
  notes: string | null;
  created_at: string;
}

export interface DprBlocker {
  id: string;
  tenant_id: string;
  dpr_id: string;
  category: BlockerCategory;
  description: string;
  impact_hours: number;
  resolution_action: string | null;
  status: BlockerStatus;
  created_at: string;
}

export interface DprSiteInstruction {
  id: string;
  tenant_id: string;
  project_id: string;
  dpr_id: string | null;
  instruction_number: string;
  issued_by: string;
  recipient: string;
  instruction_text: string;
  priority: SiteInstructionPriority;
  status: SiteInstructionStatus;
  target_completion_date: string | null;
  issued_at: string;
}

export interface DprDetail {
  report: DailyProgressReport;
  manpowerEntries: DprManpowerEntry[];
  equipmentEntries: DprEquipmentEntry[];
  workProgressEntries: DprWorkProgressEntry[];
  blockers: DprBlocker[];
}

const statusBadgeColors: Record<DprStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  submitted: "bg-blue-50 text-blue-700 border border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200",
};

const weatherEmojis: Record<WeatherCondition, string> = {
  clear: "☀️ Clear",
  partly_cloudy: "⛅ Partly Cloudy",
  sunny: "🌞 Bright Sun",
  rain: "🌧️ Rain",
  heavy_rain: "⛈️ Heavy Rain",
  dust_storm: "🌪️ Dust Storm",
  extreme_heat: "🌡️ Extreme Heat",
  other: "🌤️ Other",
};

const priorityBadges: Record<SiteInstructionPriority, string> = {
  low: "bg-zinc-100 text-zinc-600",
  normal: "bg-blue-50 text-blue-700",
  urgent: "bg-rose-50 text-rose-700 font-semibold",
};

const instructionStatusBadges: Record<SiteInstructionStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  acknowledged: "bg-purple-50 text-purple-700",
};

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-zinc-50 disabled:text-zinc-400";

export function SiteOperationsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get("projectId") || "");
  const [mainTab, setMainTab] = useState<"dpr" | "instructions">("dpr");

  // DPR List state
  const [dprs, setDprs] = useState<DailyProgressReport[]>([]);
  const [dprFilterStatus, setDprFilterStatus] = useState<string>("all");
  const [loadingDprs, setLoadingDprs] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Selected DPR Detail state
  const [selectedDprId, setSelectedDprId] = useState<string | null>(null);
  const [dprDetail, setDprDetail] = useState<DprDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // New DPR Form modal/drawer
  const [showNewDprModal, setShowNewDprModal] = useState<boolean>(false);
  const [newReportDate, setNewReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newWeatherCondition, setNewWeatherCondition] = useState<WeatherCondition>("clear");
  const [newTemperature, setNewTemperature] = useState<string>("");
  const [newWeatherImpact, setNewWeatherImpact] = useState<WeatherImpact>("none");
  const [newGeneralNotes, setNewGeneralNotes] = useState<string>("");
  const [creatingDpr, setCreatingDpr] = useState<boolean>(false);
  const [dprFormError, setDprFormError] = useState<string | null>(null);

  // DPR Workspace Sub-tabs
  const [workspaceTab, setWorkspaceTab] = useState<"manpower" | "equipment" | "work_progress" | "blockers">("manpower");

  // Child Forms
  const [mpTrade, setMpTrade] = useState<string>("");
  const [mpHeadcount, setMpHeadcount] = useState<string>("1");
  const [mpHours, setMpHours] = useState<string>("8.0");
  const [mpSubcontractor, setMpSubcontractor] = useState<string>("");
  const [mpNotes, setMpNotes] = useState<string>("");

  const [eqType, setEqType] = useState<string>("");
  const [eqQuantity, setEqQuantity] = useState<string>("1");
  const [eqOperatingHours, setEqOperatingHours] = useState<string>("8.0");
  const [eqIdleHours, setEqIdleHours] = useState<string>("0");
  const [eqNotes, setEqNotes] = useState<string>("");

  const [wpDescription, setWpDescription] = useState<string>("");
  const [wpLocation, setWpLocation] = useState<string>("");
  const [wpQuantity, setWpQuantity] = useState<string>("");
  const [wpUom, setWpUom] = useState<string>("");
  const [wpNotes, setWpNotes] = useState<string>("");

  const [blCategory, setBlCategory] = useState<BlockerCategory>("material_shortage");
  const [blDescription, setBlDescription] = useState<string>("");
  const [blImpactHours, setBlImpactHours] = useState<string>("0");
  const [blResolution, setBlResolution] = useState<string>("");

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Site Instructions state
  const [instructions, setInstructions] = useState<DprSiteInstruction[]>([]);
  const [loadingInstructions, setLoadingInstructions] = useState<boolean>(false);
  const [showInstructionModal, setShowInstructionModal] = useState<boolean>(false);
  const [insNumber, setInsNumber] = useState<string>("");
  const [insIssuedBy, setInsIssuedBy] = useState<string>("");
  const [insRecipient, setInsRecipient] = useState<string>("");
  const [insText, setInsText] = useState<string>("");
  const [insPriority, setInsPriority] = useState<SiteInstructionPriority>("normal");
  const [insTargetDate, setInsTargetDate] = useState<string>("");

  // Load Projects on Mount
  useEffect(() => {
    if (!session) return;
    apiFetch<{ projects: Project[] }>("/projects", session.access_token)
      .then((res) => {
        setProjects(res.projects || []);
        if (!selectedProjectId && res.projects && res.projects.length > 0) {
          const firstId = res.projects[0].id;
          setSelectedProjectId(firstId);
          setSearchParams({ projectId: firstId });
        }
      })
      .catch((err) => {
        setPageError(err instanceof ApiError ? err.message : "Failed to load projects");
      });
  }, [session]);

  // Load DPRs when project changes
  useEffect(() => {
    if (!session || !selectedProjectId) return;
    loadDprs();
    loadInstructions();
  }, [session, selectedProjectId]);

  // Load DPR Detail when selected
  useEffect(() => {
    if (!session || !selectedDprId) {
      setDprDetail(null);
      return;
    }
    loadDprDetail(selectedDprId);
  }, [session, selectedDprId]);

  async function loadDprs() {
    if (!session || !selectedProjectId) return;
    setLoadingDprs(true);
    setPageError(null);
    try {
      const res = await apiFetch<{ dprs: DailyProgressReport[] }>(
        `/projects/${selectedProjectId}/site/dprs`,
        session.access_token,
      );
      setDprs(res.dprs || []);
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Failed to load DPRs");
    } finally {
      setLoadingDprs(false);
    }
  }

  async function loadDprDetail(id: string) {
    if (!session) return;
    setLoadingDetail(true);
    try {
      const res = await apiFetch<{ dpr: DprDetail }>(`/site/dprs/${id}`, session.access_token);
      setDprDetail(res.dpr);
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Failed to load DPR detail");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadInstructions() {
    if (!session || !selectedProjectId) return;
    setLoadingInstructions(true);
    try {
      const res = await apiFetch<{ instructions: DprSiteInstruction[] }>(
        `/projects/${selectedProjectId}/site/instructions`,
        session.access_token,
      );
      setInstructions(res.instructions || []);
    } catch (err) {
      // Non-blocking
    } finally {
      setLoadingInstructions(false);
    }
  }

  function handleProjectChange(id: string) {
    setSelectedProjectId(id);
    setSelectedDprId(null);
    setSearchParams({ projectId: id });
  }

  // DPR creation
  async function handleCreateDpr(e: FormEvent) {
    e.preventDefault();
    if (!session || !selectedProjectId) return;
    setCreatingDpr(true);
    setDprFormError(null);
    try {
      const res = await apiFetch<{ dpr: DailyProgressReport }>(
        `/projects/${selectedProjectId}/site/dprs`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            reportDate: newReportDate,
            weatherCondition: newWeatherCondition,
            temperatureCelsius: newTemperature ? parseFloat(newTemperature) : null,
            weatherImpact: newWeatherImpact,
            generalNotes: newGeneralNotes.trim() || null,
          }),
        },
      );
      setShowNewDprModal(false);
      setNewGeneralNotes("");
      setNewTemperature("");
      loadDprs();
      setSelectedDprId(res.dpr.id);
    } catch (err) {
      setDprFormError(err instanceof ApiError ? err.message : "Could not create DPR");
    } finally {
      setCreatingDpr(false);
    }
  }

  // DPR Lifecycle Actions
  async function handleSubmitDpr() {
    if (!session || !dprDetail) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/submit`, session.access_token, {
        method: "POST",
      });
      loadDprDetail(dprDetail.report.id);
      loadDprs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not submit DPR");
    }
  }

  async function handleApproveDpr() {
    if (!session || !dprDetail) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/approve`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ approvedBy: session.user.email || "Supervisor" }),
      });
      loadDprDetail(dprDetail.report.id);
      loadDprs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not approve DPR");
    }
  }

  async function handleRejectDpr() {
    if (!session || !dprDetail || !rejectionReason.trim()) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/reject`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      setShowRejectModal(false);
      setRejectionReason("");
      loadDprDetail(dprDetail.report.id);
      loadDprs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not reject DPR");
    }
  }

  async function handleDeleteDpr(id: string) {
    if (!session) return;
    if (!confirm("Are you sure you want to delete this draft DPR?")) return;
    try {
      await apiFetch(`/site/dprs/${id}`, session.access_token, {
        method: "DELETE",
      });
      if (selectedDprId === id) setSelectedDprId(null);
      loadDprs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete DPR");
    }
  }

  // Child entries addition
  async function handleAddManpower(e: FormEvent) {
    e.preventDefault();
    if (!session || !dprDetail || !mpTrade.trim()) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/manpower`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          trade: mpTrade.trim(),
          headcount: parseInt(mpHeadcount, 10) || 1,
          hoursWorked: parseFloat(mpHours) || 8.0,
          subcontractorName: mpSubcontractor.trim() || null,
          notes: mpNotes.trim() || null,
        }),
      });
      setMpTrade("");
      setMpHeadcount("1");
      setMpSubcontractor("");
      setMpNotes("");
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not add manpower");
    }
  }

  async function handleDeleteManpower(entryId: string) {
    if (!session || !dprDetail) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/manpower/${entryId}`, session.access_token, {
        method: "DELETE",
      });
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not remove entry");
    }
  }

  async function handleAddEquipment(e: FormEvent) {
    e.preventDefault();
    if (!session || !dprDetail || !eqType.trim()) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/equipment`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          equipmentType: eqType.trim(),
          quantity: parseInt(eqQuantity, 10) || 1,
          operatingHours: parseFloat(eqOperatingHours) || 8.0,
          idleHours: parseFloat(eqIdleHours) || 0,
          notes: eqNotes.trim() || null,
        }),
      });
      setEqType("");
      setEqQuantity("1");
      setEqIdleHours("0");
      setEqNotes("");
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not add equipment");
    }
  }

  async function handleDeleteEquipment(entryId: string) {
    if (!session || !dprDetail) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/equipment/${entryId}`, session.access_token, {
        method: "DELETE",
      });
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not remove entry");
    }
  }

  async function handleAddWorkProgress(e: FormEvent) {
    e.preventDefault();
    if (!session || !dprDetail || !wpDescription.trim()) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/work-progress`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          description: wpDescription.trim(),
          locationOrGrid: wpLocation.trim() || null,
          quantityExecuted: wpQuantity ? parseFloat(wpQuantity) : null,
          uom: wpUom.trim() || null,
          notes: wpNotes.trim() || null,
        }),
      });
      setWpDescription("");
      setWpLocation("");
      setWpQuantity("");
      setWpUom("");
      setWpNotes("");
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not add work progress");
    }
  }

  async function handleDeleteWorkProgress(entryId: string) {
    if (!session || !dprDetail) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/work-progress/${entryId}`, session.access_token, {
        method: "DELETE",
      });
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not remove entry");
    }
  }

  async function handleAddBlocker(e: FormEvent) {
    e.preventDefault();
    if (!session || !dprDetail || !blDescription.trim()) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/blockers`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          category: blCategory,
          description: blDescription.trim(),
          impactHours: parseFloat(blImpactHours) || 0,
          resolutionAction: blResolution.trim() || null,
        }),
      });
      setBlDescription("");
      setBlImpactHours("0");
      setBlResolution("");
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not add blocker");
    }
  }

  async function handleToggleBlockerStatus(blocker: DprBlocker) {
    if (!session || !dprDetail) return;
    const nextStatus: BlockerStatus = blocker.status === "open" ? "resolved" : "open";
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/blockers/${blocker.id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not update blocker");
    }
  }

  async function handleDeleteBlocker(blockerId: string) {
    if (!session || !dprDetail) return;
    try {
      await apiFetch(`/site/dprs/${dprDetail.report.id}/blockers/${blockerId}`, session.access_token, {
        method: "DELETE",
      });
      loadDprDetail(dprDetail.report.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not delete blocker");
    }
  }

  // Site instruction creation
  async function handleCreateInstruction(e: FormEvent) {
    e.preventDefault();
    if (!session || !selectedProjectId || !insNumber.trim() || !insText.trim()) return;
    try {
      await apiFetch(`/projects/${selectedProjectId}/site/instructions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          instructionNumber: insNumber.trim(),
          issuedBy: insIssuedBy.trim() || "Site Management",
          recipient: insRecipient.trim() || "Main Contractor",
          instructionText: insText.trim(),
          priority: insPriority,
          targetCompletionDate: insTargetDate || null,
          dprId: selectedDprId || null,
        }),
      });
      setShowInstructionModal(false);
      setInsNumber("");
      setInsIssuedBy("");
      setInsRecipient("");
      setInsText("");
      setInsTargetDate("");
      loadInstructions();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not issue instruction");
    }
  }

  async function handleUpdateInstructionStatus(id: string, newStatus: SiteInstructionStatus) {
    if (!session) return;
    try {
      await apiFetch(`/site/instructions/${id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadInstructions();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not update instruction status");
    }
  }

  // Derived filter list
  const filteredDprs = dprs.filter((d) => {
    if (dprFilterStatus !== "all" && d.status !== dprFilterStatus) return false;
    return true;
  });

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  // Total metrics
  const totalHeadcount = dprDetail?.manpowerEntries.reduce((sum, e) => sum + e.headcount, 0) ?? 0;
  const totalOperatingHours = dprDetail?.equipmentEntries.reduce((sum, e) => sum + Number(e.operating_hours), 0) ?? 0;
  const openBlockersCount = dprDetail?.blockers.filter((b) => b.status === "open").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Project Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl font-bold tracking-tight text-zinc-900">
            Site Operations &amp; DPR
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Field capture, Daily Progress Reports (DPR), manpower, equipment logs, and site instructions.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pageError && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {pageError}
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => {
            setMainTab("dpr");
          }}
          className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
            mainTab === "dpr"
              ? "border-brand text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Daily Progress Reports ({dprs.length})
        </button>
        <button
          onClick={() => {
            setMainTab("instructions");
          }}
          className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
            mainTab === "instructions"
              ? "border-brand text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Site Instructions Register ({instructions.length})
        </button>
      </div>

      {/* =========================================================================
          TAB 1: DAILY PROGRESS REPORTS
          ========================================================================= */}
      {mainTab === "dpr" && (
        <div className="space-y-6">
          {/* Action Bar & Stats */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {["all", "draft", "submitted", "approved", "rejected"].map((st) => (
                <button
                  key={st}
                  onClick={() => setDprFilterStatus(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    dprFilterStatus === st
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <PermissionGate permission="site.dpr.manage">
                <button
                  onClick={() => setShowNewDprModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-brand-dim"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New DPR
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* If No DPR is Selected -> Show DPR List Table */}
          {!selectedDprId && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4">
                <h2 className="font-brand text-base font-semibold text-zinc-900">
                  DPR Log for {activeProject?.name || "Project"}
                </h2>
                <span className="text-xs text-zinc-400">
                  Showing {filteredDprs.length} reports
                </span>
              </div>

              {loadingDprs ? (
                <div className="py-12 text-center text-sm text-zinc-400">Loading daily progress reports…</div>
              ) : filteredDprs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center">
                  <p className="text-sm font-medium text-zinc-600">No Daily Progress Reports found.</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Click &ldquo;New DPR&rdquo; above to record today&apos;s site activities.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Weather</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Weather Impact</th>
                        <th className="py-3 px-4">Notes</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {filteredDprs.map((report) => (
                        <tr key={report.id} className="hover:bg-zinc-50/70 transition">
                          <td className="py-3 px-4 font-semibold text-zinc-900 whitespace-nowrap">
                            {report.report_date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-zinc-700">
                            {weatherEmojis[report.weather_condition]}
                            {report.temperature_celsius !== null && (
                              <span className="ml-2 text-xs text-zinc-400">
                                {report.temperature_celsius}°C
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeColors[report.status]}`}>
                              {report.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-zinc-600 whitespace-nowrap">
                            {report.weather_impact ? report.weather_impact.replace("_", " ") : "None"}
                          </td>
                          <td className="py-3 px-4 text-xs text-zinc-600 max-w-xs truncate">
                            {report.general_notes || "—"}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedDprId(report.id)}
                                className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 hover:bg-brand hover:text-zinc-900 transition"
                              >
                                Open Workspace →
                              </button>
                              {report.status === "draft" && (
                                <PermissionGate permission="site.dpr.manage">
                                  <button
                                    onClick={() => handleDeleteDpr(report.id)}
                                    className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                                  >
                                    Delete
                                  </button>
                                </PermissionGate>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* If DPR IS Selected -> DPR WORKSPACE */}
          {selectedDprId && loadingDetail && (
            <div className="py-12 text-center text-sm text-zinc-400">Loading DPR workspace…</div>
          )}
          {selectedDprId && !loadingDetail && dprDetail && (
            <div className="space-y-6">
              {/* Back to List & Header Bar */}
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedDprId(null)}
                      className="rounded-xl border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 transition"
                      title="Back to DPR log"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                    </button>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-brand text-xl font-bold text-zinc-900">
                          DPR for {dprDetail.report.report_date}
                        </h2>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold capitalize ${statusBadgeColors[dprDetail.report.status]}`}>
                          {dprDetail.report.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {weatherEmojis[dprDetail.report.weather_condition]}
                        {dprDetail.report.temperature_celsius !== null && ` · ${dprDetail.report.temperature_celsius}°C`}
                        {dprDetail.report.weather_impact && ` · Impact: ${dprDetail.report.weather_impact.replace("_", " ")}`}
                      </p>
                    </div>
                  </div>

                  {/* Header Workflow Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Submit for Approval */}
                    {(dprDetail.report.status === "draft" || dprDetail.report.status === "rejected") && (
                      <PermissionGate permission="site.dpr.manage">
                        <button
                          onClick={handleSubmitDpr}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                        >
                          Submit DPR for Approval
                        </button>
                      </PermissionGate>
                    )}

                    {/* Supervisor Approval & Rejection */}
                    {dprDetail.report.status === "submitted" && (
                      <PermissionGate permission="site.dpr.approve">
                        <button
                          onClick={handleApproveDpr}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                        >
                          ✓ Approve DPR
                        </button>
                        <button
                          onClick={() => setShowRejectModal(true)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                        >
                          ✕ Return / Reject
                        </button>
                      </PermissionGate>
                    )}
                  </div>
                </div>

                {/* Rejection notice banner */}
                {dprDetail.report.status === "rejected" && dprDetail.report.rejection_reason && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                    <span className="font-bold">Supervisor Returned for Revision: </span>
                    {dprDetail.report.rejection_reason}
                  </div>
                )}

                {/* Approval record info */}
                {dprDetail.report.status === "approved" && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
                    <span className="font-bold">Approved by {dprDetail.report.approved_by || "Supervisor"} </span>
                    {dprDetail.report.approved_at && `on ${new Date(dprDetail.report.approved_at).toLocaleString()}`}.
                    This DPR is locked and archived as official site evidence.
                  </div>
                )}

                {/* Metrics Summary Cards */}
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl bg-stone-50 p-4 border border-zinc-100">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Manpower</dt>
                    <dd className="mt-1 text-2xl font-bold text-zinc-900">{totalHeadcount} <span className="text-xs font-normal text-zinc-400">workers</span></dd>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-4 border border-zinc-100">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Equipment Running</dt>
                    <dd className="mt-1 text-2xl font-bold text-zinc-900">{totalOperatingHours} <span className="text-xs font-normal text-zinc-400">operating hrs</span></dd>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-4 border border-zinc-100">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Work Items</dt>
                    <dd className="mt-1 text-2xl font-bold text-zinc-900">{dprDetail.workProgressEntries.length} <span className="text-xs font-normal text-zinc-400">locations</span></dd>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-4 border border-zinc-100">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Site Blockers</dt>
                    <dd className={`mt-1 text-2xl font-bold ${openBlockersCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {openBlockersCount} <span className="text-xs font-normal text-zinc-400">open</span>
                    </dd>
                  </div>
                </div>

                {dprDetail.report.general_notes && (
                  <div className="mt-4 text-xs text-zinc-600 bg-stone-50 p-3 rounded-lg border border-zinc-100">
                    <span className="font-semibold text-zinc-700">Site Notes: </span>
                    {dprDetail.report.general_notes}
                  </div>
                )}
              </div>

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b border-zinc-200">
                <button
                  onClick={() => setWorkspaceTab("manpower")}
                  className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
                    workspaceTab === "manpower"
                      ? "border-brand text-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Manpower Log ({dprDetail.manpowerEntries.length})
                </button>
                <button
                  onClick={() => setWorkspaceTab("equipment")}
                  className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
                    workspaceTab === "equipment"
                      ? "border-brand text-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Equipment Log ({dprDetail.equipmentEntries.length})
                </button>
                <button
                  onClick={() => setWorkspaceTab("work_progress")}
                  className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
                    workspaceTab === "work_progress"
                      ? "border-brand text-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Work Progress Log ({dprDetail.workProgressEntries.length})
                </button>
                <button
                  onClick={() => setWorkspaceTab("blockers")}
                  className={`border-b-2 px-5 py-2.5 text-sm font-semibold transition ${
                    workspaceTab === "blockers"
                      ? "border-brand text-zinc-900"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Site Blockers &amp; Delays ({dprDetail.blockers.length})
                </button>
              </div>

              {/* Sub-tab 1: Manpower */}
              {workspaceTab === "manpower" && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-6">
                  {dprDetail.report.status !== "approved" && (
                    <form onSubmit={handleAddManpower} className="space-y-3 rounded-xl bg-stone-50 p-4 border border-zinc-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Add Manpower Entry</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                        <input
                          placeholder="Trade / Role (e.g. Carpenters)"
                          value={mpTrade}
                          onChange={(e) => setMpTrade(e.target.value)}
                          required
                          className={`sm:col-span-2 ${inputClass}`}
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="Headcount"
                          value={mpHeadcount}
                          onChange={(e) => setMpHeadcount(e.target.value)}
                          required
                          className={inputClass}
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Hours Worked"
                          value={mpHours}
                          onChange={(e) => setMpHours(e.target.value)}
                          required
                          className={inputClass}
                        />
                        <input
                          placeholder="Subcontractor"
                          value={mpSubcontractor}
                          onChange={(e) => setMpSubcontractor(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          placeholder="Specific notes / location..."
                          value={mpNotes}
                          onChange={(e) => setMpNotes(e.target.value)}
                          className={`flex-1 ${inputClass}`}
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim transition"
                        >
                          + Log Manpower
                        </button>
                      </div>
                    </form>
                  )}

                  {dprDetail.manpowerEntries.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No manpower recorded for this day.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            <th className="py-2 px-3">Trade</th>
                            <th className="py-2 px-3">Headcount</th>
                            <th className="py-2 px-3">Hours</th>
                            <th className="py-2 px-3">Subcontractor</th>
                            <th className="py-2 px-3">Notes</th>
                            {dprDetail.report.status !== "approved" && <th className="py-2 px-3 text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 text-xs">
                          {dprDetail.manpowerEntries.map((m) => (
                            <tr key={m.id}>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900">{m.trade}</td>
                              <td className="py-2.5 px-3 text-zinc-700">{m.headcount} workers</td>
                              <td className="py-2.5 px-3 text-zinc-700">{m.hours_worked} hrs</td>
                              <td className="py-2.5 px-3 text-zinc-600">{m.subcontractor_name || "Direct Staff"}</td>
                              <td className="py-2.5 px-3 text-zinc-500">{m.notes || "—"}</td>
                              {dprDetail.report.status !== "approved" && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => handleDeleteManpower(m.id)}
                                    className="text-rose-600 hover:text-rose-800 font-medium"
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Equipment */}
              {workspaceTab === "equipment" && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-6">
                  {dprDetail.report.status !== "approved" && (
                    <form onSubmit={handleAddEquipment} className="space-y-3 rounded-xl bg-stone-50 p-4 border border-zinc-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Add Equipment Log</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <input
                          placeholder="Equipment Type (e.g. Excavator 20T)"
                          value={eqType}
                          onChange={(e) => setEqType(e.target.value)}
                          required
                          className={inputClass}
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Quantity"
                          value={eqQuantity}
                          onChange={(e) => setEqQuantity(e.target.value)}
                          required
                          className={inputClass}
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Operating Hours"
                          value={eqOperatingHours}
                          onChange={(e) => setEqOperatingHours(e.target.value)}
                          required
                          className={inputClass}
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Idle Hours"
                          value={eqIdleHours}
                          onChange={(e) => setEqIdleHours(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          placeholder="Notes or idle reason..."
                          value={eqNotes}
                          onChange={(e) => setEqNotes(e.target.value)}
                          className={`flex-1 ${inputClass}`}
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim transition"
                        >
                          + Log Equipment
                        </button>
                      </div>
                    </form>
                  )}

                  {dprDetail.equipmentEntries.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No equipment recorded for this day.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            <th className="py-2 px-3">Equipment</th>
                            <th className="py-2 px-3">Qty</th>
                            <th className="py-2 px-3">Operating Hrs</th>
                            <th className="py-2 px-3">Idle Hrs</th>
                            <th className="py-2 px-3">Notes</th>
                            {dprDetail.report.status !== "approved" && <th className="py-2 px-3 text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 text-xs">
                          {dprDetail.equipmentEntries.map((eq) => (
                            <tr key={eq.id}>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900">{eq.equipment_type}</td>
                              <td className="py-2.5 px-3 text-zinc-700">{eq.quantity}</td>
                              <td className="py-2.5 px-3 text-zinc-700">{eq.operating_hours} hrs</td>
                              <td className="py-2.5 px-3 text-zinc-600">{eq.idle_hours} hrs</td>
                              <td className="py-2.5 px-3 text-zinc-500">{eq.notes || "—"}</td>
                              {dprDetail.report.status !== "approved" && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => handleDeleteEquipment(eq.id)}
                                    className="text-rose-600 hover:text-rose-800 font-medium"
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 3: Work Progress */}
              {workspaceTab === "work_progress" && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-6">
                  {dprDetail.report.status !== "approved" && (
                    <form onSubmit={handleAddWorkProgress} className="space-y-3 rounded-xl bg-stone-50 p-4 border border-zinc-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Add Executed Work Progress</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <input
                          placeholder="Work Description (e.g. Slab Rebar Tying)"
                          value={wpDescription}
                          onChange={(e) => setWpDescription(e.target.value)}
                          required
                          className={`sm:col-span-2 ${inputClass}`}
                        />
                        <input
                          placeholder="Location / Grid (e.g. Zone B Level 1)"
                          value={wpLocation}
                          onChange={(e) => setWpLocation(e.target.value)}
                          className={inputClass}
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Qty"
                            value={wpQuantity}
                            onChange={(e) => setWpQuantity(e.target.value)}
                            className={`w-24 ${inputClass}`}
                          />
                          <input
                            placeholder="UOM (cum, ton)"
                            value={wpUom}
                            onChange={(e) => setWpUom(e.target.value)}
                            className={`flex-1 ${inputClass}`}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          placeholder="Execution remarks / inspection details..."
                          value={wpNotes}
                          onChange={(e) => setWpNotes(e.target.value)}
                          className={`flex-1 ${inputClass}`}
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim transition"
                        >
                          + Log Progress
                        </button>
                      </div>
                    </form>
                  )}

                  {dprDetail.workProgressEntries.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No work progress items recorded for this day.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-3">Location / Grid</th>
                            <th className="py-2 px-3">Executed Qty</th>
                            <th className="py-2 px-3">Notes</th>
                            {dprDetail.report.status !== "approved" && <th className="py-2 px-3 text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 text-xs">
                          {dprDetail.workProgressEntries.map((wp) => (
                            <tr key={wp.id}>
                              <td className="py-2.5 px-3 font-semibold text-zinc-900">{wp.description}</td>
                              <td className="py-2.5 px-3 text-zinc-700">{wp.location_or_grid || "—"}</td>
                              <td className="py-2.5 px-3 text-zinc-700">
                                {wp.quantity_executed !== null ? `${wp.quantity_executed} ${wp.uom || ""}` : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-500">{wp.notes || "—"}</td>
                              {dprDetail.report.status !== "approved" && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => handleDeleteWorkProgress(wp.id)}
                                    className="text-rose-600 hover:text-rose-800 font-medium"
                                  >
                                    Remove
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 4: Blockers */}
              {workspaceTab === "blockers" && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-6">
                  {dprDetail.report.status !== "approved" && (
                    <form onSubmit={handleAddBlocker} className="space-y-3 rounded-xl bg-stone-50 p-4 border border-zinc-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Log Site Blocker / Delay</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <select
                          value={blCategory}
                          onChange={(e) => setBlCategory(e.target.value as BlockerCategory)}
                          className={inputClass}
                        >
                          <option value="material_shortage">Material Shortage</option>
                          <option value="drawing_delay">Drawing / IFC Delay</option>
                          <option value="inspection_pending">Inspection Pending</option>
                          <option value="access_blocked">Access Blocked</option>
                          <option value="weather">Inclement Weather</option>
                          <option value="subcontractor_default">Subcontractor Default</option>
                          <option value="safety_stop">Safety Stop Work</option>
                          <option value="other">Other Site Delay</option>
                        </select>
                        <input
                          placeholder="Description of issue / stoppage"
                          value={blDescription}
                          onChange={(e) => setBlDescription(e.target.value)}
                          required
                          className={`sm:col-span-2 ${inputClass}`}
                        />
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Impact (Hours)"
                          value={blImpactHours}
                          onChange={(e) => setBlImpactHours(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          placeholder="Action taken / resolution plan..."
                          value={blResolution}
                          onChange={(e) => setBlResolution(e.target.value)}
                          className={`flex-1 ${inputClass}`}
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim transition"
                        >
                          + Log Blocker
                        </button>
                      </div>
                    </form>
                  )}

                  {dprDetail.blockers.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No blockers or delays reported for this day.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Description</th>
                            <th className="py-2 px-3">Impact</th>
                            <th className="py-2 px-3">Resolution Action</th>
                            {dprDetail.report.status !== "approved" && <th className="py-2 px-3 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 text-xs">
                          {dprDetail.blockers.map((bl) => (
                            <tr key={bl.id}>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`rounded-full px-2 py-0.5 font-semibold ${
                                    bl.status === "open"
                                      ? "bg-rose-50 text-rose-700"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {bl.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-zinc-800 capitalize whitespace-nowrap">
                                {bl.category.replace("_", " ")}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-700">{bl.description}</td>
                              <td className="py-2.5 px-3 text-zinc-700 whitespace-nowrap">{bl.impact_hours} hrs</td>
                              <td className="py-2.5 px-3 text-zinc-500">{bl.resolution_action || "Pending"}</td>
                              {dprDetail.report.status !== "approved" && (
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleToggleBlockerStatus(bl)}
                                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                    >
                                      {bl.status === "open" ? "Mark Resolved" : "Re-open"}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBlocker(bl.id)}
                                      className="text-rose-600 hover:text-rose-800 font-medium"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SITE INSTRUCTIONS REGISTER
          ========================================================================= */}
      {mainTab === "instructions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-brand text-base font-semibold text-zinc-900">
                Site Instructions (SI) Register
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Formal directives issued on-site by consultants, project managers, or supervising engineers.
              </p>
            </div>

            <PermissionGate permission="site.instruction.manage">
              <button
                onClick={() => setShowInstructionModal(true)}
                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-brand-dim transition"
              >
                + Issue Site Instruction
              </button>
            </PermissionGate>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            {loadingInstructions ? (
              <div className="py-12 text-center text-sm text-zinc-400">Loading site instructions…</div>
            ) : instructions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center">
                <p className="text-sm font-medium text-zinc-600">No site instructions recorded.</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Click &ldquo;Issue Site Instruction&rdquo; above to log an official field directive.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      <th className="py-3 px-4">SI Number</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">From → To</th>
                      <th className="py-3 px-4">Instruction Directives</th>
                      <th className="py-3 px-4">Target Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {instructions.map((ins) => (
                      <tr key={ins.id} className="hover:bg-zinc-50/70 transition">
                        <td className="py-3 px-4 font-bold text-zinc-900 whitespace-nowrap">
                          {ins.instruction_number}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${priorityBadges[ins.priority]}`}>
                            {ins.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-700 whitespace-nowrap">
                          <span className="font-semibold">{ins.issued_by}</span>
                          <span className="text-zinc-400"> → </span>
                          <span>{ins.recipient}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-700 max-w-sm">
                          {ins.instruction_text}
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-600 whitespace-nowrap">
                          {ins.target_completion_date || "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${instructionStatusBadges[ins.status]}`}>
                            {ins.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <PermissionGate permission="site.instruction.manage">
                            <select
                              value={ins.status}
                              onChange={(e) => handleUpdateInstructionStatus(ins.id, e.target.value as SiteInstructionStatus)}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="acknowledged">Acknowledged</option>
                            </select>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS & DRAWERS
          ========================================================================= */}

      {/* Create DPR Modal */}
      {showNewDprModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-brand text-lg font-bold text-zinc-900">Create Daily Progress Report</h3>
              <button
                onClick={() => setShowNewDprModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDpr} className="mt-4 space-y-4">
              {dprFormError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {dprFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  value={newReportDate}
                  onChange={(e) => setNewReportDate(e.target.value)}
                  required
                  className={`w-full ${inputClass}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Weather Condition
                  </label>
                  <select
                    value={newWeatherCondition}
                    onChange={(e) => setNewWeatherCondition(e.target.value as WeatherCondition)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="clear">☀️ Clear</option>
                    <option value="partly_cloudy">⛅ Partly Cloudy</option>
                    <option value="sunny">🌞 Sunny</option>
                    <option value="rain">🌧️ Rain</option>
                    <option value="heavy_rain">⛈️ Heavy Rain</option>
                    <option value="dust_storm">🌪️ Dust Storm</option>
                    <option value="extreme_heat">🌡️ Extreme Heat</option>
                    <option value="other">🌤️ Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 32"
                    value={newTemperature}
                    onChange={(e) => setNewTemperature(e.target.value)}
                    className={`w-full ${inputClass}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Weather Impact on Operations
                </label>
                <select
                  value={newWeatherImpact}
                  onChange={(e) => setNewWeatherImpact(e.target.value as WeatherImpact)}
                  className={`w-full ${inputClass}`}
                >
                  <option value="none">No Delay (Normal Works)</option>
                  <option value="minor_delay">Minor Delay (&lt; 2 Hours)</option>
                  <option value="work_stoppage">Work Stoppage (Full / Partial Stand-down)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Site Overview &amp; General Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of site conditions, safety talks, major milestones reached today..."
                  value={newGeneralNotes}
                  onChange={(e) => setNewGeneralNotes(e.target.value)}
                  className={`w-full ${inputClass}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewDprModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDpr}
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-brand-dim transition disabled:opacity-50"
                >
                  {creatingDpr ? "Creating…" : "Create DPR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject DPR Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-brand text-base font-bold text-zinc-900">Return DPR for Revision</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Provide feedback for the site engineer explaining what needs correction before approval.
            </p>
            <div className="mt-4">
              <textarea
                rows={3}
                placeholder="Reason for return (e.g. discrepancy in concrete volume vs batch tickets)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className={`w-full ${inputClass}`}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectDpr}
                disabled={!rejectionReason.trim()}
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                Return DPR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Site Instruction Modal */}
      {showInstructionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-brand text-lg font-bold text-zinc-900">Issue Site Instruction (SI)</h3>
              <button
                onClick={() => setShowInstructionModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInstruction} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Instruction Number
                  </label>
                  <input
                    placeholder="e.g. SI-001"
                    value={insNumber}
                    onChange={(e) => setInsNumber(e.target.value)}
                    required
                    className={`w-full ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Priority
                  </label>
                  <select
                    value={insPriority}
                    onChange={(e) => setInsPriority(e.target.value as SiteInstructionPriority)}
                    className={`w-full ${inputClass}`}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Issued By
                  </label>
                  <input
                    placeholder="e.g. Resident Engineer"
                    value={insIssuedBy}
                    onChange={(e) => setInsIssuedBy(e.target.value)}
                    required
                    className={`w-full ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Recipient
                  </label>
                  <input
                    placeholder="e.g. Lead Contractor"
                    value={insRecipient}
                    onChange={(e) => setInsRecipient(e.target.value)}
                    required
                    className={`w-full ${inputClass}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={insTargetDate}
                  onChange={(e) => setInsTargetDate(e.target.value)}
                  className={`w-full ${inputClass}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Instruction Directives &amp; Action Required
                </label>
                <textarea
                  rows={4}
                  placeholder="Detailed specifications, safety precautions, or rework required on site..."
                  value={insText}
                  onChange={(e) => setInsText(e.target.value)}
                  required
                  className={`w-full ${inputClass}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInstructionModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 shadow-sm hover:bg-brand-dim transition"
                >
                  Issue Instruction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
