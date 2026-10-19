import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getOfflineDrafts,
  saveOfflineDraft,
  removeOfflineDraft,
  syncAllOfflineDrafts,
  syncSingleDraft,
  type OfflineDraft,
  type OfflineEntityType,
} from "../services/offlineSync";
import { useAuth } from "../auth/AuthContext";

interface OfflineSyncContextValue {
  isOnline: boolean;
  drafts: OfflineDraft[];
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  syncDraft: (id: string) => Promise<void>;
  saveDraft: <T = Record<string, unknown>>(
    type: OfflineEntityType,
    title: string,
    payload: T,
    projectId?: string,
    projectName?: string,
    existingId?: string
  ) => OfflineDraft<T>;
  deleteDraft: (id: string) => void;
  refreshDrafts: () => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | undefined>(undefined);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshDrafts = useCallback(() => {
    setDrafts(getOfflineDrafts());
  }, []);

  useEffect(() => {
    refreshDrafts();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when back online
      if (session?.access_token) {
        syncAllOfflineDrafts(session.access_token).then(() => {
          refreshDrafts();
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [session?.access_token, refreshDrafts]);

  const syncNow = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncAllOfflineDrafts(session?.access_token);
    } finally {
      setIsSyncing(false);
      refreshDrafts();
    }
  };

  const syncDraft = async (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft || !isOnline) return;
    setIsSyncing(true);
    try {
      await syncSingleDraft(draft, session?.access_token);
    } finally {
      setIsSyncing(false);
      refreshDrafts();
    }
  };

  const saveDraft = <T = Record<string, unknown>>(
    type: OfflineEntityType,
    title: string,
    payload: T,
    projectId?: string,
    projectName?: string,
    existingId?: string
  ): OfflineDraft<T> => {
    const draft = saveOfflineDraft<T>(type, title, payload, projectId, projectName, existingId);
    refreshDrafts();
    return draft;
  };

  const deleteDraft = (id: string) => {
    removeOfflineDraft(id);
    refreshDrafts();
  };

  const pendingCount = drafts.filter((d) => d.status !== "synced").length;

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        drafts,
        pendingCount,
        isSyncing,
        syncNow,
        syncDraft,
        saveDraft,
        deleteDraft,
        refreshDrafts,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSync must be used within an OfflineSyncProvider");
  }
  return context;
}
