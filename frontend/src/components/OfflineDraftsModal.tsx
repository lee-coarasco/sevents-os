import { useOfflineSync } from "../context/OfflineSyncContext";

interface OfflineDraftsModalProps {
  onClose: () => void;
}

export function OfflineDraftsModal({ onClose }: OfflineDraftsModalProps) {
  const { isOnline, drafts, isSyncing, syncNow, syncDraft, deleteDraft } = useOfflineSync();

  const getEntityLabel = (type: string) => {
    switch (type) {
      case "dpr":
        return "Daily Progress Report";
      case "safety_hazard":
        return "Safety Hazard Observation";
      case "quality_inspection":
        return "Quality Inspection";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Synced</span>;
      case "syncing":
        return <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 animate-pulse">Syncing...</span>;
      case "conflict":
        return <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">Conflict</span>;
      case "failed":
        return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Retry Needed</span>;
      default:
        return <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">Queued</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Offline Field Queue &amp; Sync</h2>
              <p className="text-xs text-zinc-500">
                {isOnline ? "Network Connected — Ready to sync records" : "Working Offline — Drafts safely stored on device"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Financial Guardrail Alert */}
        <div className="bg-amber-50/70 border-b border-amber-200/60 px-6 py-2.5 flex items-start gap-2">
          <svg className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-900">
            <strong>Policy Guardrail:</strong> Offline mode is strictly permitted for site field forms (DPRs, hazards, inspections). Commercial and financial approvals (POs, invoices, payment applications) are blocked until connected to prevent reconciliation divergence.
          </p>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-emerald-50 p-3 text-emerald-600 mb-3">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">All Field Records Synced</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                No local drafts pending sync. Any new DPRs, safety logs, or quality inspections created in the field will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 transition-all hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                        {getEntityLabel(draft.type)}
                      </span>
                      {getStatusBadge(draft.status)}
                    </div>
                    <h4 className="mt-1 truncate text-sm font-semibold text-zinc-900">
                      {draft.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                      {draft.projectName && <span>Project: {draft.projectName}</span>}
                      <span>Saved: {new Date(draft.lastSavedAt).toLocaleTimeString()}</span>
                      {draft.retryCount > 0 && <span>Retries: {draft.retryCount}</span>}
                    </div>
                    {draft.errorMessage && (
                      <p className="mt-1.5 text-xs font-medium text-rose-600">
                        Error: {draft.errorMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0">
                    {isOnline && draft.status !== "synced" && (
                      <button
                        onClick={() => syncDraft(draft.id)}
                        disabled={isSyncing}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        Sync Now
                      </button>
                    )}
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
          <div className="text-xs text-zinc-500">
            {drafts.length} total local {drafts.length === 1 ? "record" : "records"}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Close
            </button>
            {drafts.length > 0 && (
              <button
                onClick={syncNow}
                disabled={!isOnline || isSyncing}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {isSyncing ? "Syncing Queue..." : "Sync All Records"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
