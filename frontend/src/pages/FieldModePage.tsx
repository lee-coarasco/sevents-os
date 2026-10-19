import React, { useState } from "react";
import { useOfflineSync } from "../context/OfflineSyncContext";

export function FieldModePage() {
  const { isOnline, pendingCount, isSyncing, syncNow, saveDraft, drafts } = useOfflineSync();
  const [activeTab, setActiveTab] = useState<"quick_dpr" | "safety_hazard" | "quality_itp">("quick_dpr");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states
  const [projectName, setProjectName] = useState("Burj Crown Tower - MEP Package");
  const [weather, setWeather] = useState("Sunny 36°C");
  const [shift, setShift] = useState("Day Shift");
  const [manpowerCount, setManpowerCount] = useState(48);
  const [workCompleted, setWorkCompleted] = useState("");
  const [blockers, setBlockers] = useState("");

  // Hazard states
  const [hazardLocation, setHazardLocation] = useState("");
  const [hazardCategory, setHazardCategory] = useState("Working at Height");
  const [hazardSeverity, setHazardSeverity] = useState("medium");
  const [hazardAction, setHazardAction] = useState("");

  // Quality states
  const [itpRef, setItpRef] = useState("ITP-CIV-04: Concrete Pour Inspection");
  const [itpStatus, setItpStatus] = useState("pass");
  const [itpNotes, setItpNotes] = useState("");

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleSaveDpr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workCompleted.trim()) return;

    saveDraft(
      "dpr",
      `DPR - ${projectName} (${new Date().toLocaleDateString()})`,
      {
        projectName,
        reportDate: new Date().toISOString().split("T")[0],
        weather,
        shift,
        manpowerCount,
        workCompleted,
        blockers,
      },
      undefined,
      projectName
    );

    setWorkCompleted("");
    setBlockers("");
    showToast("Daily Progress Report saved to offline queue!");
  };

  const handleSaveHazard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hazardLocation.trim()) return;

    saveDraft(
      "safety_hazard",
      `Hazard: ${hazardCategory} @ ${hazardLocation}`,
      {
        projectName,
        category: hazardCategory,
        severity: hazardSeverity,
        location: hazardLocation,
        actionTaken: hazardAction,
        reportedAt: new Date().toISOString(),
      },
      undefined,
      projectName
    );

    setHazardLocation("");
    setHazardAction("");
    showToast("Safety hazard observation stored in offline queue!");
  };

  const handleSaveItp = (e: React.FormEvent) => {
    e.preventDefault();

    saveDraft(
      "quality_inspection",
      `ITP: ${itpRef} (${itpStatus.toUpperCase()})`,
      {
        projectName,
        itpRef,
        status: itpStatus,
        notes: itpNotes,
        inspectedAt: new Date().toISOString(),
      },
      undefined,
      projectName
    );

    setItpNotes("");
    showToast("Quality inspection checklist stored in offline queue!");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Network & Offline Status Banner */}
      <div
        className={`rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg ${
          !isOnline
            ? "bg-gradient-to-r from-amber-600 to-amber-700"
            : "bg-gradient-to-r from-zinc-900 to-zinc-800"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              !isOnline ? "bg-amber-800 text-amber-200" : "bg-zinc-800 text-amber-400"
            }`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">Field Mode &amp; Mobile Site Capture</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  !isOnline ? "bg-amber-900 text-amber-100" : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {!isOnline ? "Offline Active" : "Online Sync Ready"}
              </span>
            </div>
            <p className="text-xs text-zinc-300">
              Low-bandwidth offline mode. Records are preserved locally and synced automatically when back online.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={() => syncNow()}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-black shadow-sm hover:bg-amber-400 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isSyncing ? "Syncing..." : `Sync ${pendingCount} Drafts`}</span>
            </button>
          )}
        </div>
      </div>

      {successToast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successToast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-zinc-100 p-1">
        <button
          onClick={() => setActiveTab("quick_dpr")}
          className={`flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "quick_dpr" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          📝 Daily Progress (DPR)
        </button>
        <button
          onClick={() => setActiveTab("safety_hazard")}
          className={`flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "safety_hazard" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          ⚠️ Safety Hazard Log
        </button>
        <button
          onClick={() => setActiveTab("quality_itp")}
          className={`flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "quality_itp" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          🔍 Quality Inspection
        </button>
      </div>

      {/* Quick DPR Form */}
      {activeTab === "quick_dpr" && (
        <form onSubmit={handleSaveDpr} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900">Site Daily Progress Report (DPR)</h2>
            <span className="text-xs text-zinc-400 font-mono">Date: {new Date().toLocaleDateString()}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Project</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Site Weather &amp; Conditions</label>
              <input
                type="text"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="Day Shift">Day Shift</option>
                <option value="Night Shift">Night Shift</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Total Manpower On Site</label>
              <input
                type="number"
                min="0"
                value={manpowerCount}
                onChange={(e) => setManpowerCount(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Work Activities Completed Today *</label>
            <textarea
              rows={4}
              required
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
              placeholder="e.g., Level 12 rebar reinforcement 100% complete, ductwork MEP rough-in 45m installed..."
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Blockers, Delays &amp; Weather Impacts</label>
            <textarea
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="e.g., Material delivery delayed by 2 hours; crane maintenance between 14:00 - 15:30..."
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-black shadow-sm hover:bg-amber-400 focus:outline-none"
            >
              Save DPR to Offline Queue
            </button>
          </div>
        </form>
      )}

      {/* Safety Hazard Form */}
      {activeTab === "safety_hazard" && (
        <form onSubmit={handleSaveHazard} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900">Field Safety Hazard Observation</h2>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">HSE Form</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Category</label>
              <select
                value={hazardCategory}
                onChange={(e) => setHazardCategory(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="Working at Height">Working at Height / Scaffolding</option>
                <option value="Electrical Safety">Electrical Safety</option>
                <option value="PPE Compliance">PPE Compliance</option>
                <option value="Housekeeping / Tripping">Housekeeping / Tripping Hazard</option>
                <option value="Lifting Operations">Lifting Operations &amp; Rigging</option>
                <option value="Hot Work">Hot Work / Fire Hazard</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Severity Level</label>
              <select
                value={hazardSeverity}
                onChange={(e) => setHazardSeverity(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="low">Low (Noticeable housekeeping issue)</option>
                <option value="medium">Medium (Potential injury without controls)</option>
                <option value="high">High (Immediate stop-work condition)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Specific Location on Site *</label>
            <input
              type="text"
              required
              value={hazardLocation}
              onChange={(e) => setHazardLocation(e.target.value)}
              placeholder="e.g. Tower B - Floor 14 east perimeter edge"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Immediate Corrective Action Taken</label>
            <textarea
              rows={3}
              value={hazardAction}
              onChange={(e) => setHazardAction(e.target.value)}
              placeholder="e.g. Installed barrier tape, notified subcontractor chargehand to rectify guardrail..."
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-500 focus:outline-none"
            >
              Log Hazard to Offline Queue
            </button>
          </div>
        </form>
      )}

      {/* Quality ITP Form */}
      {activeTab === "quality_itp" && (
        <form onSubmit={handleSaveItp} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900">Inspection &amp; Test Plan (ITP) Verification</h2>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">QA/QC Form</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Inspection Reference</label>
              <input
                type="text"
                value={itpRef}
                onChange={(e) => setItpRef(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Inspection Verdict</label>
              <select
                value={itpStatus}
                onChange={(e) => setItpStatus(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="pass">Pass (All checkpoints conform to specification)</option>
                <option value="conditional_pass">Conditional Pass (Minor rectification required)</option>
                <option value="fail">Fail (Raise NCR)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Field Verification Notes &amp; Measurements</label>
            <textarea
              rows={4}
              value={itpNotes}
              onChange={(e) => setItpNotes(e.target.value)}
              placeholder="e.g. Concrete slump test measured 130mm, ambient temperature 34°C, cover blocks verified at 50mm..."
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-500 focus:outline-none"
            >
              Save Inspection to Offline Queue
            </button>
          </div>
        </form>
      )}

      {/* Local Queue Overview Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Offline Queue on this Device</h3>
            <p className="text-xs text-zinc-500">
              {drafts.length === 0 ? "No records in local storage" : `${drafts.length} records stored in local browser cache`}
            </p>
          </div>
          {drafts.length > 0 && isOnline && (
            <button
              onClick={() => syncNow()}
              disabled={isSyncing}
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Sync All Now"}
            </button>
          )}
        </div>

        {drafts.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {drafts.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-zinc-900">{d.title}</span>
                  <span className="ml-2 text-zinc-400">({d.type})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 italic">No unsynced drafts.</p>
        )}
      </div>
    </div>
  );
}
