import { useMemo, useState } from "react";
import { useUsers } from "../hooks/useUsers";

interface UserPickerProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  className?: string;
}

function userLabel(user: { display_name: string | null; email: string }): string {
  return user.display_name ? `${user.display_name} (${user.email})` : user.email;
}

/** Shared name/email search-to-user-id picker — never let a form field take a raw UUID. Backed by GET /admin/users. */
export function UserPicker({ value, onChange, placeholder, className }: UserPickerProps) {
  const { users, loading } = useUsers();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedUser = users?.find((u) => u.id === value) ?? null;

  const matches = useMemo(() => {
    if (!users) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return users.slice(0, 20);
    return users
      .filter((u) => userLabel(u).toLowerCase().includes(needle))
      .slice(0, 20);
  }, [users, query]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        value={open ? query : selectedUser ? userLabel(selectedUser) : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange("");
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        placeholder={loading ? "Loading people…" : placeholder ?? "Search by name or email…"}
        disabled={loading}
        className="block w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-100 bg-white shadow-sm">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(u.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm text-zinc-800 hover:bg-brand-soft"
              >
                {userLabel(u)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && matches.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-100 bg-white px-3.5 py-2 text-sm text-zinc-400 shadow-sm">
          No matching people.
        </div>
      )}
    </div>
  );
}
