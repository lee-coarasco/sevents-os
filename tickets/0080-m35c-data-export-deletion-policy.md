---
id: 80
title: "M35c — Data export & deletion policy"
status: next
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
- [ ] `data_requests` table (tenant-scoped, RLS) and its workflow-
      instance-backed approval lifecycle, mirroring ticket 0075's
      baseline-change-request shape.
- [ ] Export half built and tested end-to-end for at least
      `app_users`/`role_assignments`/audit rows.
- [ ] Deletion half only built for entity types the owner confirmed in
      the `## Needs approval` answer; if unanswered, this ticket ships
      export-only and stays `blocked` on the deletion half, not
      `done`.
- [ ] Deletion checks `legal_holds` first and refuses if one is active.
- [ ] Tests cover tenant isolation, permission gating, approval-gating
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
