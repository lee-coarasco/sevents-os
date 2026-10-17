import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

export type EntityPickerType = "project" | "client" | "document" | "cost-code" | "document-type" | "currency" | "uom";

interface EntityOption {
  id: string;
  label: string;
}

interface TypeConfig {
  endpoint: string;
  listKey: string;
  serverSearch: boolean;
  label: (item: Record<string, unknown>) => string;
}

const TYPE_CONFIG: Record<EntityPickerType, TypeConfig> = {
  project: {
    endpoint: "/projects",
    listKey: "projects",
    serverSearch: false,
    label: (p) => (p.code ? `${p.name as string} (${p.code as string})` : (p.name as string)),
  },
  client: {
    endpoint: "/crm/clients",
    listKey: "clients",
    serverSearch: true,
    label: (c) => c.name as string,
  },
  document: {
    endpoint: "/documents",
    listKey: "documents",
    serverSearch: false,
    label: (d) => d.title as string,
  },
  "cost-code": {
    endpoint: "/master-data/cost-codes",
    listKey: "costCodes",
    serverSearch: false,
    label: (c) => `${c.code as string} — ${c.description as string}`,
  },
  "document-type": {
    endpoint: "/master-data/document-types",
    listKey: "documentTypes",
    serverSearch: false,
    label: (d) => `${d.code as string} — ${d.label as string}`,
  },
  currency: {
    endpoint: "/master-data/currencies",
    listKey: "currencies",
    serverSearch: false,
    label: (c) => `${c.code as string} — ${c.name as string}`,
  },
  uom: {
    endpoint: "/master-data/uom",
    listKey: "uom",
    serverSearch: false,
    label: (u) => `${u.code as string} — ${u.description as string}`,
  },
};

function useEntityOptions(type: EntityPickerType, search: string) {
  const { session } = useAuth();
  const config = TYPE_CONFIG[type];
  const [options, setOptions] = useState<EntityOption[] | null>(null);

  useEffect(() => {
    if (!session) {
      setOptions(null);
      return;
    }
    const path = config.serverSearch && search ? `${config.endpoint}?search=${encodeURIComponent(search)}` : config.endpoint;
    const handle = setTimeout(() => {
      apiFetch<Record<string, Record<string, unknown>[]>>(path, session.access_token)
        .then((data) => {
          const rows = data[config.listKey] ?? [];
          setOptions(rows.map((row) => ({ id: row.id as string, label: config.label(row) })));
        })
        .catch(() => setOptions([]));
    }, config.serverSearch ? 300 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, type, config.serverSearch ? search : ""]);

  return options;
}

interface EntityPickerProps {
  type: EntityPickerType;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

/** Shared search-to-id picker for cross-entity references — never let a form field take a raw UUID. */
export function EntityPicker({ type, value, onChange, placeholder, className }: EntityPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = useEntityOptions(type, query);
  const loading = options === null;

  const selected = options?.find((o) => o.id === value) ?? null;

  const matches = useMemo(() => {
    if (!options) return [];
    const config = TYPE_CONFIG[type];
    if (config.serverSearch) return options.slice(0, 20);
    const needle = query.trim().toLowerCase();
    if (!needle) return options.slice(0, 20);
    return options.filter((o) => o.label.toLowerCase().includes(needle)).slice(0, 20);
  }, [options, query, type]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        value={open ? query : (selected?.label ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange("");
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        placeholder={loading ? "Loading…" : placeholder ?? "Search…"}
        disabled={loading}
        className="block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-100 bg-white shadow-sm">
          {matches.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm text-zinc-800 hover:bg-brand-soft"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && matches.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-100 bg-white px-3.5 py-2 text-sm text-zinc-400 shadow-sm">
          No matches.
        </div>
      )}
    </div>
  );
}
