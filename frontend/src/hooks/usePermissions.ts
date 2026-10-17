import { usePermissionsContext } from "../context/PermissionsContext";

/** Reads effective permissions from the top-level PermissionsProvider — one fetch for the whole app, not one per component. */
export function usePermissions() {
  return usePermissionsContext();
}
