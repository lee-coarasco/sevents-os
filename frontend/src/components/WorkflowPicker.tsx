import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

export interface WorkflowDefinitionOption {
  id: string;
  name: string;
  key?: string;
  capability_key?: string | null;
}

export interface WorkflowPickerProps {
  /** Logical context for remembering defaults, e.g. "estimate_approval", "bid_no_bid_approval", "document_release" */
  contextKey: string;
  value: string;
  onChange: (id: string, definition?: WorkflowDefinitionOption) => void;
  /** Optional pre-fetched definitions. If omitted, WorkflowPicker fetches published definitions automatically */
  definitions?: WorkflowDefinitionOption[] | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function WorkflowPicker({
  contextKey,
  value,
  onChange,
  definitions: externalDefinitions,
  placeholder = "Select approval workflow…",
  disabled = false,
  className = "",
}: WorkflowPickerProps) {
  const { session } = useAuth();
  const [internalDefinitions, setInternalDefinitions] = useState<WorkflowDefinitionOption[] | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local storage key for default workflow for this context
  const defaultStorageKey = `sevents_default_wf_${contextKey}`;
  const [defaultId, setDefaultId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(defaultStorageKey);
    } catch {
      return null;
    }
  });

  // Fetch published workflows if not provided externally
  useEffect(() => {
    if (externalDefinitions !== undefined) return;
    if (!session) return;
    apiFetch<{ definitions: WorkflowDefinitionOption[] }>("/workflow/definitions/published", session.access_token)
      .then((data) => setInternalDefinitions(data.definitions ?? []))
      .catch(() => setInternalDefinitions([]));
  }, [session, externalDefinitions]);

  const allDefinitions = externalDefinitions ?? internalDefinitions ?? [];
  const selectedDef = allDefinitions.find((d) => d.id === value) ?? null;

  // On mount or when definitions become available: if no value is set, pre-select default
  useEffect(() => {
    if (!value && defaultId && allDefinitions.length > 0) {
      const def = allDefinitions.find((d) => d.id === defaultId);
      if (def) {
        onChange(def.id, def);
      }
    }
  }, [value, defaultId, allDefinitions, onChange]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSetDefault(id: string) {
    try {
      if (defaultId === id) {
        localStorage.removeItem(defaultStorageKey);
        setDefaultId(null);
      } else {
        localStorage.setItem(defaultStorageKey, id);
        setDefaultId(id);
      }
    } catch (e) {
      console.warn("Could not save default workflow to localStorage", e);
    }
  }

  // Filter & sort:
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allDefinitions.filter((d) => {
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.key && d.key.toLowerCase().includes(q)) ||
        (d.capability_key && d.capability_key.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      // Default goes first
      if (a.id === defaultId && b.id !== defaultId) return -1;
      if (b.id === defaultId && a.id !== defaultId) return 1;

      // Matching capability_key goes next
      const aMatchesCap = a.capability_key === contextKey;
      const bMatchesCap = b.capability_key === contextKey;
      if (aMatchesCap && !bMatchesCap) return -1;
      if (!aMatchesCap && bMatchesCap) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [allDefinitions, search, defaultId, contextKey]);

  return (
    <div ref={dropdownRef} className={`relative flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}>
      {/* Hidden native select for standard accessibility / test runner support */}
      <select
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val, allDefinitions.find((d) => d.id === val));
        }}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="false"
      >
        <option value="">{placeholder}</option>
        {allDefinitions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <div className="relative flex-1">
        <div
          data-testid="workflow-picker-trigger"
          onClick={() => {
            if (!disabled) {
              setOpen((prev) => !prev);
              if (!open) setSearch("");
            }
          }}
          className={`flex min-h-[38px] cursor-pointer items-center justify-between rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
            disabled ? "opacity-50 cursor-not-allowed bg-zinc-50" : "hover:border-zinc-300"
          }`}
        >
          {open ? (
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search workflows…"
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent outline-none placeholder:text-zinc-400"
            />
          ) : (
            <div className="flex items-center gap-2 truncate">
              {selectedDef ? (
                <>
                  <span className="font-medium text-zinc-900 truncate">{selectedDef.name}</span>
                  {selectedDef.id === defaultId && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                      ★ Default
                    </span>
                  )}
                  {selectedDef.capability_key === contextKey && selectedDef.id !== defaultId && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-dark">
                      Recommended
                    </span>
                  )}
                </>
              ) : (
                <span className="text-zinc-400">{placeholder}</span>
              )}
            </div>
          )}

          <div className="ml-2 flex items-center gap-1.5 text-zinc-400">
            {selectedDef && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setSearch("");
                }}
                className="rounded p-0.5 hover:bg-zinc-100 hover:text-zinc-600 text-xs"
                title="Clear selection"
              >
                ✕
              </button>
            )}
            <svg
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {open && (
          <div className="absolute z-30 mt-1 max-h-60 w-full min-w-[280px] overflow-auto rounded-xl border border-zinc-100 bg-white p-1 shadow-lg ring-1 ring-black/5">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-400">
                {search ? "No matching workflows found" : "No published workflows available"}
              </div>
            ) : (
              filtered.map((def) => {
                const isSelected = def.id === value;
                const isDef = def.id === defaultId;
                const isRecommended = def.capability_key === contextKey;

                return (
                  <div
                    key={def.id}
                    data-testid={`workflow-item-${def.id}`}
                    onClick={() => {
                      onChange(def.id, def);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer transition ${
                      isSelected ? "bg-amber-50 text-amber-950 font-medium" : "text-zinc-700 hover:bg-stone-100"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 truncate pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{def.name}</span>
                        {isDef && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                            ★ Default
                          </span>
                        )}
                        {isRecommended && !isDef && (
                          <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[9px] font-medium text-brand-dark">
                            Recommended
                          </span>
                        )}
                      </div>
                      {def.key && <span className="text-[10px] text-zinc-400 font-mono truncate">{def.key}</span>}
                    </div>

                    <button
                      type="button"
                      title={isDef ? "Remove default" : "Set as default for this process"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(def.id);
                      }}
                      className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium transition ${
                        isDef
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
                      }`}
                    >
                      {isDef ? "★ Default" : "Set default"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedDef && (
        <button
          type="button"
          onClick={() => handleSetDefault(selectedDef.id)}
          className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 ${
            selectedDef.id === defaultId
              ? "border-amber-200 bg-amber-50 text-amber-800 font-medium"
              : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
          }`}
          title={selectedDef.id === defaultId ? "This is your default workflow" : "Set this workflow as your default for this process"}
        >
          <span>{selectedDef.id === defaultId ? "★ Default workflow" : "☆ Set as default"}</span>
        </button>
      )}
    </div>
  );
}
