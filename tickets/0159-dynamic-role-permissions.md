---
id: 159
title: "Dynamic Role Permissions Matrix & Management"
status: done
roles: [backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
done: 2026-10-18
depends_on: [158]
---

## Summary

Enables dynamic granting and revoking of granular system permissions per role (both platform roles and tenant-created custom roles):

1. **Database Migration (`supabase/migrations/20261018000002_dynamic_role_permissions.sql`)**:
   - Added RLS policies for authenticated users on `public.role_permissions` for insert and delete.
   - Ensures DB-level completeness while the backend service client manages permission assignments.

2. **Backend Architecture & Routes**:
   - Added `PermissionDefinition` type in `backend/src/modules/authority/types.ts`.
   - Extended `AuthorityRepository` interface and Supabase implementation:
     - `listAllPermissions()`: Queries `public.permissions` ordered by ID.
     - `listPermissionsForRole(roleId)`: Queries `public.role_permissions` by role ID.
     - `setRolePermissions(roleId, permissionIds)`: Atomically updates role permissions in `public.role_permissions`.
   - Exposed REST API endpoints in `backend/src/modules/authority/routes.ts`:
     - `GET /authority/permissions`: Lists all available permissions in the system (self-service read).
     - `GET /authority/roles/:roleId/permissions`: Lists all active permissions for a given role (self-service read).
     - `PUT /authority/roles/:roleId/permissions`: Atomically updates permissions for a role, guarded by `authority.role.manage`.
   - Updated `FakeAuthorityRepository` with test stand-in implementation.
   - Added comprehensive route tests in `backend/src/modules/authority/routes.test.ts`.

3. **Frontend Permission Matrix UI**:
   - Created `frontend/src/components/RolePermissionsMatrix.tsx`:
     - Dynamic role selector dropdown with platform/custom badges and live count of active permissions.
     - Categorized by 12 functional domains (Authority & Security, Workflows, Catalogue, Projects & WBS, Tasks, Workforce, Approvals, CRM, Engineering & Documents, Master Data, Notifications, Audit & Compliance).
     - Search and filter by permission key or description.
     - Bulk actions: "Select all", "Deselect all", "Select group", "Deselect group".
     - Unsaved edits detector with dirty indicator and reset button.
     - Save button guarded by `authority.role.manage` permission.
   - Embedded `<RolePermissionsMatrix />` in `frontend/src/pages/DepartmentsRolesPage.tsx` with one-click "Permissions →" shortcuts directly on role cards.
   - Updated `usePermissions` and `PermissionsContext` to gracefully fall back to local fetching when rendered outside `<PermissionsProvider>` (e.g. in standalone unit tests).
   - Created test suite `frontend/src/components/RolePermissionsMatrix.test.tsx` verifying role switching, checkbox toggling, saving, and filtering.

## Acceptance
- [x] `GET /authority/permissions` returns system permissions
- [x] `GET /authority/roles/:roleId/permissions` returns assigned permissions for the role
- [x] `PUT /authority/roles/:roleId/permissions` updates permissions with `authority.role.manage` guard
- [x] UI displays granular permissions grouped by functional domain
- [x] Administrators can toggle permissions, select/deselect groups, and save changes dynamically
- [x] Backend and frontend test suites pass cleanly
