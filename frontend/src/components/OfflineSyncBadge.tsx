import { useState } from "react";
import { useOfflineSync } from "../context/OfflineSyncContext";
import { OfflineDraftsModal } from "./OfflineDraftsModal";

export function OfflineSyncBadge() {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        title={isOnline ? "Network: Online" : "Network: Offline (Site Mode)"}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
          !isOnline
            ? "bg-amber-100 text-amber-900 border border-amber-300"
            : pendingCount > 0
            ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            !isOnline
              ? "bg-amber-500 animate-pulse"
              : isSyncing
              ? "bg-blue-500 animate-ping"
              : pendingCount > 0
              ? "bg-blue-500"
              : "bg-emerald-500"
          }`}
        />
        <span className="hidden sm:inline">
          {!isOnline ? "Offline" : isSyncing ? "Syncing..." : "Online"}
        </span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-black">
            {pendingCount}
          </span>
        )}
      </button>

      {isModalOpen && <OfflineDraftsModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
}
