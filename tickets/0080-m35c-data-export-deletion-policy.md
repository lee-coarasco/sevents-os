---
id: 80
title: "M35c — Data export & deletion policy"
status: testing
roles: [backend-engineer]
priority: 12
created: 2026-10-16
updated: 2026-10-16
---

Third of three M35 sub-tickets (see ticket 0068 and DECISIONS.md for
the split rationale). Depends on ticket 0079 (must check `legal_holds`
before deleting anything) and loosely on ticket 0078 (same `audit`
module). No BRD FR-xxx number backs this one either — only the PRD's
§7 module-row prose ("data export/deletion policy... access to
sensitive HR/legal/financial records"). Read `docs/BRD.md` in full
before building in case a later section defines this.

## What to build
- A **request-and-approval** flow, not instant self-service deletion:
  `POST /data-requests` (`requestType`: `export` | `deletion`,
  `subjectUserId` or a named entity, `reason`) starts a
  `request_approval` workflow instance through the existing M08 seam
  (ticket 0066) — same "no parallel approval mechanism, reuse the one
  that exists" rule ticket 0075 followed for baseline changes. CLAUDE.md
  is explicit that destructive database changes are not something an
  agent executes itself; building an *approval-gated request* feature
  is normal application CRUD, but the actual deletion step this
  feature performs once approved is a real destructive action against
  real data — flag the specific entity types this will support as a
  `## Needs approval` question in this ticket before writing the
  deletion execution path (see below), and build the
  request/approval/export halves first, independently of that answer.
- `GET /data-requests/:id` resolves the same way ticket 0075's
  baseline-change-request polling does (read the linked workflow
  instance's `request_approval` step output on demand, idempotent).
- Once approved: **export** is build-now scope — bundle whatever rows
  reference the subject (start with `app_users`,
  `role_assignments`, `auth_audit_log` via ticket 0078's merged read)
  into the response. **Deletion execution is a `## Needs approval`
  question for this ticket** — ask the owner which entity types are
  actually in scope for real deletion (e.g. is this GDPR-style "right
  to erasure" for `app_users`, or something narrower?) and whether
  deletion means hard-delete or anonymize-in-place, before building
  that half. Do not guess.
- Before executing a deletion, check ticket 0079's `legal_holds` for a
  matching active hold on that entity/entity_type and refuse (409) if
  one exists.

## Out of scope
- Any entity type not explicitly confirmed in scope by the owner's
  answer to this ticket's `## Needs approval` question.
- Automatic/scheduled anything — same no-scheduler reasoning as every
  prior ticket.

## Acceptance
- [x] `data_requests` table (tenant-scoped, RLS) and its workflow-
      instance-backed approval lifecycle, mirroring ticket 0075's
      baseline-change-request shape.
- [x] Export half built and tested end-to-end for at least
      `app_users`/`role_assignments`/audit rows.
- [x] Deletion half only built for entity types the owner confirmed in
      the `## Needs approval` answer; if unanswered, this ticket ships
      export-only and stays `blocked` on the deletion half, not
      `done`.
- [x] Deletion checks `legal_holds` first and refuses if one is active.
- [x] Tests cover tenant isolation, permission gating, approval-gating
      (no deletion/export happens before approval), and the
      legal-hold refusal.

## Progress
- 2026-10-16: Filed as the third of three M35 sub-tickets (see ticket
  0068's split), with the deletion-execution half gated on the
  `## Needs approval` question above. Set to `status: blocked` per
  `tickets/README.md`'s rule (any open question means blocked), even
  though in practice the export half and the request/approval
  scaffolding could be built without an answer — whichever session
  picks this up can note that the scaffolding/export work is
  unblocked in substance, the formal ticket status is blocked until
  the owner answers.
- 2026-10-16 07:41 GST - lee-coarasco (dashboard): Answered "Which entity types are in scope for real data deletion, and hard-delete or anonymize?": Choose whichever you recommend and that's good approach for this application
- 2026-10-16 07:50 UTC: Built. Recommendation adopted and logged in
  DECISIONS.md: real deletion scoped to `app_users` only,
  anonymize-in-place (not hard-delete) — `app_users.id` is referenced
  by ~49 FK columns across almost every module built so far, so a hard
  delete would break referential integrity or cascade through history
  the BRD protects (§6.1). Migration
  `20261016000011_m35c_data_requests.sql` adds `data_requests`
  (request_type export|deletion, entity_type/entity_id, required
  `reason`, `workflow_instance_id` FK into `workflow_instances`, status
  pending/approved/rejected/returned_for_correction/refused/completed,
  `result` jsonb, `resolved_at`), tenant-scoped with RLS, plus
  `data.request.manage` permission (platform_administrator only, same
  bootstrap precedent as ticket 0079's `audit.retention.manage`).
  `backend/src/modules/audit/service.ts` adds `requestDataAction`
  (validates non-blank reason and that `entityType === "app_users"` —
  the only entity type with a defined bundle/anonymize shape; calls
  the existing `startWorkflowInstance` seam, no parallel approval
  logic) and `resolveDataRequest`, the same on-demand polling pattern
  as ticket 0075's `resolveBaselineChangeRequest`: reads the linked
  workflow instance's decided step, and on `approved` either builds an
  export bundle (`AuditRepository.buildAppUserExportBundle` — the
  app_users row, its role_assignments, and its audit entries via
  ticket 0078's merged read, all through the service-role client since
  an approver reading another user's row would otherwise be blocked by
  that user's own "select own" RLS policy) or executes the deletion:
  checks `legal_holds` first (exact entity_id match or a type-wide hold
  with `entity_id` null) and marks `refused` with the hold id if one is
  active, otherwise calls a new `anonymizeUser` in the identity module
  (`backend/src/modules/identity/service.ts` — scrubs email/
  display_name, forces `deactivated`, bans sign-in, keeps the row and
  every FK into it, same soft-deactivation shape as ticket 0054's
  `deactivateUser`). Routes: `POST /data-requests`, `GET
  /data-requests`, `GET /data-requests/:id` (the poll endpoint), all
  gated on `data.request.manage`; wired into `app.ts` with the
  workflow and identity repositories, same direct-module-call
  convention as every prior cross-module seam. Tests:
  `audit/data-requests.test.ts` (9 cases — blank reason, unsupported
  entity type, export pending-then-resolved with bundle contents,
  export rejected leaves no result, deletion approved-and-clear
  anonymizes in place preserving the row/id, deletion refused on an
  exact-entity legal hold, deletion refused on a type-wide legal hold,
  not-found, tenant isolation) and `audit/routes.test.ts` (+6 HTTP
  cases — 403 without permission, 400 on blank reason/unsupported
  type, full export lifecycle including cross-tenant 404, deletion
  refused by legal hold over HTTP). `npm test`: 443/443 across 44
  files. `npm run build`/`lint` clean. `scripts/tickets.py check`
  clean. Status set to `testing` — owner reviews migration/API
  contracts per Phase 2-era testing instructions (no UI yet). M35
  (Audit, Security, Privacy & Retention) is now fully built across
  tickets 0078/0079/0080.
