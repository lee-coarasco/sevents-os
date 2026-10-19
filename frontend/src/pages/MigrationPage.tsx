import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { PermissionGate } from "../components/PermissionGate";

export type MigrationEntityType =
  | "work_items"
  | "cost_codes"
  | "employees"
  | "vendors"
  | "inventory_items";

export interface RowError {
  row: number;
  field: string;
  message: string;
  severity?: "error" | "warning";
}

export interface MigrationJob {
  id: string;
  entity_type: MigrationEntityType;
  file_name: string;
  status: "draft" | "validated" | "imported" | "rolled_back" | "failed";
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  row_errors: RowError[];
  imported_at?: string | null;
  rolled_back_at?: string | null;
  created_at: string;
}

const ENTITY_CONFIGS: Record<
  MigrationEntityType,
  { name: string; description: string; icon: string; fields: string[] }
> = {
  work_items: {
    name: "Master Work-Item Library",
    description: "1,308 standard construction work items, standard units, and trade categories.",
    icon: "🏗️",
    fields: ["item_code", "title", "description", "unit", "category"],
  },
  cost_codes: {
    name: "Cost Breakdown Structure (CBS)",
    description: "Standard cost code hierarchy for budget tracking and commitments.",
    icon: "📊",
    fields: ["code", "name", "category", "description"],
  },
  employees: {
    name: "Employee Directory & Workforce",
    description: "Staff profiles, department codes, job titles, and enterprise emails.",
    icon: "👥",
    fields: ["first_name", "last_name", "work_email", "job_title", "department_code"],
  },
  vendors: {
    name: "Approved Vendors & Subcontractors",
    description: "Suppliers, trade classifications, contact information, and TRN tax numbers.",
    icon: "🚚",
    fields: ["name", "trade_category", "trn_number", "contact_email", "phone"],
  },
  inventory_items: {
    name: "Inventory & Materials Catalogue",
    description: "Material SKUs, units of measure, reorder thresholds, and standard rates.",
    icon: "📦",
    fields: ["item_code", "name", "uom", "reorder_point", "unit_cost"],
  },
};

export function MigrationPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<"wizard" | "history">("wizard");
  const [selectedEntity, setSelectedEntity] = useState<MigrationEntityType>("work_items");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File parsing & validation states
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validationResult, setValidationResult] = useState<{
    jobId: string;
    totalRows: number;
    validRows: number;
    errorRows: number;
    errors: RowError[];
    valid: boolean;
  } | null>(null);

  // Loading & status states
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [historyJobs, setHistoryJobs] = useState<MigrationJob[]>([]);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Fetch migration history
  const loadHistory = async () => {
    try {
      const res = await fetch(`${apiUrl}/migration/jobs`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        setHistoryJobs(json.jobs || []);
      }
    } catch (err) {
      console.warn("Failed to load migration history:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  // Download template
  const handleDownloadTemplate = async (entity: MigrationEntityType) => {
    try {
      const res = await fetch(`${apiUrl}/migration/templates/${entity}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Handle CSV file upload & parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setActionError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        setActionError("The CSV file must contain a header row and at least one data row.");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });
        rows.push(rowObj);
      }

      setParsedRows(rows);
      setStep(2);
    };

    reader.readAsText(file);
  };

  // Run dry-run validation
  const handleDryRunValidate = async () => {
    setLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`${apiUrl}/migration/jobs/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          entityType: selectedEntity,
          fileName,
          rows: parsedRows,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Validation failed");

      setValidationResult(json.result);
      setStep(3);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Commit & activate import batch
  const handleCommitImport = async () => {
    if (!validationResult) return;
    setLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`${apiUrl}/migration/jobs/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          jobId: validationResult.jobId,
          rows: parsedRows,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");

      setSuccessMsg(`Successfully imported ${json.result.importedCount} records into ${ENTITY_CONFIGS[selectedEntity].name}!`);
      setStep(4);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Rollback batch
  const handleRollback = async (jobId: string) => {
    if (!confirm("Are you sure you want to rollback this import batch? All inserted records will be permanently removed.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/migration/jobs/${jobId}/rollback`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Rollback failed");

      setSuccessMsg(`Rollback completed: Removed ${json.result.deletedCount} imported records.`);
      loadHistory();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFileName("");
    setParsedRows([]);
    setValidationResult(null);
    setActionError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Implementation &amp; Data Migration
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Staged data onboarding, pre-flight dry runs, duplicate detection, and rollback safety for master libraries.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-zinc-100 p-1">
          <button
            onClick={() => setActiveTab("wizard")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "wizard" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Import Wizard
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === "history" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            History &amp; Rollback
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* WIZARD VIEW */}
      {activeTab === "wizard" && (
        <div className="space-y-6">
          {/* Progress Stepper */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
              <div className={`p-2 rounded-xl ${step >= 1 ? "bg-amber-100 text-amber-900" : "text-zinc-400"}`}>
                1. Select Entity
              </div>
              <div className={`p-2 rounded-xl ${step >= 2 ? "bg-amber-100 text-amber-900" : "text-zinc-400"}`}>
                2. Upload &amp; Review
              </div>
              <div className={`p-2 rounded-xl ${step >= 3 ? "bg-amber-100 text-amber-900" : "text-zinc-400"}`}>
                3. Dry-Run Validation
              </div>
              <div className={`p-2 rounded-xl ${step >= 4 ? "bg-emerald-100 text-emerald-900" : "text-zinc-400"}`}>
                4. Activation
              </div>
            </div>
          </div>

          {/* Step 1: Select Entity & Download Template */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-zinc-900">Choose Entity to Import</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(ENTITY_CONFIGS) as MigrationEntityType[]).map((key) => {
                  const cfg = ENTITY_CONFIGS[key];
                  const isSelected = selectedEntity === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedEntity(key)}
                      className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-50/30 shadow-md ring-2 ring-amber-500/20"
                          : "border-zinc-200 bg-white hover:border-zinc-300 shadow-sm"
                      }`}
                    >
                      <div className="text-2xl mb-2">{cfg.icon}</div>
                      <h3 className="font-bold text-sm text-zinc-900">{cfg.name}</h3>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{cfg.description}</p>
                      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadTemplate(key);
                          }}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                        >
                          📥 Download Template
                        </button>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {cfg.fields.length} columns
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upload Dropzone */}
              <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-8 text-center hover:border-amber-500 transition-all">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload-input"
                />
                <label htmlFor="csv-upload-input" className="cursor-pointer">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">
                    Click to select CSV file for {ENTITY_CONFIGS[selectedEntity].name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">UTF-8 encoded .CSV format with headers</p>
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Uploaded Rows Review */}
          {step === 2 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">File Preview: {fileName}</h2>
                  <p className="text-xs text-zinc-500">
                    Loaded {parsedRows.length} rows for {ENTITY_CONFIGS[selectedEntity].name}
                  </p>
                </div>
                <button onClick={resetWizard} className="text-xs text-zinc-400 hover:text-zinc-600">
                  Cancel
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-100 font-semibold text-zinc-600">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      {ENTITY_CONFIGS[selectedEntity].fields.map((f) => (
                        <th key={f} className="px-4 py-2.5">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-2.5 font-mono text-zinc-400">{idx + 1}</td>
                        {ENTITY_CONFIGS[selectedEntity].fields.map((f) => (
                          <td key={f} className="px-4 py-2.5 truncate max-w-xs">{row[f] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Back
                </button>
                <button
                  onClick={handleDryRunValidate}
                  disabled={loading}
                  className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-black shadow-sm hover:bg-amber-400 disabled:opacity-50"
                >
                  {loading ? "Running Dry-Run Simulation..." : "Run Dry-Run Validation"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Dry-Run Validation Report */}
          {step === 3 && validationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <span className="text-xs text-zinc-400">Total Rows</span>
                  <p className="text-xl font-bold text-zinc-900 mt-1">{validationResult.totalRows}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
                  <span className="text-xs text-emerald-700">Valid Rows</span>
                  <p className="text-xl font-bold text-emerald-800 mt-1">{validationResult.validRows}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 shadow-sm">
                  <span className="text-xs text-rose-700">Error Rows</span>
                  <p className="text-xl font-bold text-rose-800 mt-1">{validationResult.errorRows}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <span className="text-xs text-zinc-400">Readiness</span>
                  <p className={`text-base font-bold mt-1 ${validationResult.valid ? "text-emerald-600" : "text-rose-600"}`}>
                    {validationResult.valid ? "Ready to Commit" : "Action Required"}
                  </p>
                </div>
              </div>

              {/* Error & Warning Breakdown */}
              {validationResult.errors.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-zinc-900">Validation &amp; Duplicate Diagnostics</h3>
                  <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="py-2.5 flex items-start justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-400">Row {err.row}:</span>
                          <span className="font-semibold text-zinc-900">{err.field}</span>
                          <span className="text-zinc-600">— {err.message}</span>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            err.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {err.severity || "error"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCommitImport}
                  disabled={loading || !validationResult.valid}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loading ? "Committing Import..." : `Commit & Activate ${validationResult.validRows} Records`}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Staged Activation Success */}
          {step === 4 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Data Import Batch Activated</h2>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                Records have been safely validated and inserted. A rollback snapshot has been preserved in audit logs.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={resetWizard}
                  className="rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Import Another Batch
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  View Migration History
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY & ROLLBACK VIEW */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900">Migration Audit &amp; Rollback History</h2>
            <button onClick={loadHistory} className="text-xs text-amber-600 hover:text-amber-700 font-semibold">
              ↻ Refresh
            </button>
          </div>

          {historyJobs.length === 0 ? (
            <p className="text-xs text-zinc-400 py-8 text-center italic">No migration batches recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-100 font-semibold text-zinc-600">
                  <tr>
                    <th className="px-4 py-2.5">File Name</th>
                    <th className="px-4 py-2.5">Entity</th>
                    <th className="px-4 py-2.5">Total / Valid</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {historyJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{job.file_name}</td>
                      <td className="px-4 py-3 capitalize text-zinc-600">{job.entity_type.replace("_", " ")}</td>
                      <td className="px-4 py-3 font-mono">{job.total_rows} / {job.valid_rows}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            job.status === "imported"
                              ? "bg-emerald-100 text-emerald-800"
                              : job.status === "rolled_back"
                              ? "bg-zinc-200 text-zinc-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {new Date(job.created_at).toLocaleDateString()} {new Date(job.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="migration.rollback.execute">
                          {job.status === "imported" && (
                            <button
                              onClick={() => handleRollback(job.id)}
                              disabled={loading}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Rollback Batch
                            </button>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
