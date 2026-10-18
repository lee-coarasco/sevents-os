---
id: 158
title: "UI Security, Page Permission Gating, Password Visibility Toggle & Dropdown Readability"
status: done
roles: [ui-designer, backend-engineer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
done: 2026-10-18
depends_on: [157]
---

## Summary

Addresses four critical UI/UX and access control usability issues:

1. **Role Dropdown Readability Fix**:
   - `RoleOption` type in `WorkflowVersionDetailPage.tsx` expected `role_name`, but the backend (`/authority/roles`) returns `label`.
   - Rendered options had empty string text, appearing as blank white rows in the native select menu.
   - Updated to resolve `r.label || r.role_name || r.name || r.id` and added explicit `text-zinc-900 bg-white` styling across dropdown selects.

2. **Navigation & Page Permission Gating**:
   - Previously, unauthorized users saw all sidebar links (e.g. Work-Item Catalogue, Company Setup, CRM, Documents). Clicking them resulted in 403 API errors and red "forbidden" banners.
   - Enhanced `PermissionGate` to support `anyPermission?: string[]` and `permission?: string | string[]`.
   - Wrapped all restricted sidebar links and section headers in `AppLayout.tsx` with `PermissionGate` so unauthorized links are hidden completely from navigation.
   - Created `ProtectedRoute` component in `App.tsx` that intercepts direct URL access by unauthorized users and renders a clean "Access Restricted" screen instead of triggering 403 network failures.

3. **Password Visibility Toggle**:
   - Added Show/Hide password toggle buttons (with eye and eye-slash SVG icons) to:
     - `LoginPage.tsx` (login password field)
     - `AcceptInvitePage.tsx` (new password and confirm password fields)

4. **Role-Permission Architecture Clarification**:
   - Researched and documented how permissions are handled:
     - Users receive roles via `role_assignments` in `/admin/users`.
     - Roles map to granular permissions via `role_permissions`, seeded in the database from canonical role definitions.
     - Documented current state: there is currently no granular permission matrix editing screen in the UI (permissions per role are canonical).

## Acceptance
- [x] Role dropdown in workflow step editor displays readable role names with high contrast
- [x] Sidebar navigation hides links the user does not have permission to view
- [x] Direct URL navigation to unauthorized pages renders a polite Access Restricted card
- [x] Password fields have show/hide visibility toggle icons
- [x] Build passes with zero TypeScript errors
- [x] Vitest tests pass cleanly
