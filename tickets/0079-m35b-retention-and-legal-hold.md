---
id: 79
title: "M35b — Retention policy & legal hold"
status: testing
roles: [backend-engineer]
priority: 11
created: 2026-10-16
updated: 2026-10-16
---

Second of three M35 sub-tickets (see ticket 0068 and DECISIONS.md for
the split rationale). Depends on ticket 0078 only loosely (shares the
`audit` module's existence, not its data) — ordered after it because
0078 is the smaller, higher-certainty slice (two concrete FR numbers)
and this ticket has none: the PRD's §7 module-row prose names
"retention rules, legal hold" but the BRD body has no FR-RET-xxx
section defining what a retention period or a legal hold actually
means in this product. Read `docs/BRD.md` in full before building in
case a later section defines this that a keyword search missed.

## What to build (framework only — no invented values)
- `retention_policies` table (tenant-scoped, RLS): `entity_type`,
  `retention_days`, `set_by`, `set_at`. A tenant admin names the
  entity type and period explicitly — this ticket does not invent a
  default retention period for any entity type. Per CLAUDE.md ("AI
  agents must not invent authority limits, SLA values, approval
  policies or production data"), every row starts as
  `TBD—Business Owner Decision` in spirit: the table has no seeded
  rows, and the API requires `retentionDays` on every write (no
  default).
- `legal_holds` table (tenant-scoped, RLS): `entity_type`, `entity_id`
  (nullable — null means "hold everything of this entity_type", a
  specific id means one record), `reason` (required, non-blank, same
  convention as ticket 0075's baseline-change reason), `placed_by`,
  `placed_at`, `released_by`, `released_at` (both null while active).
- `CRUD`-shaped routes for both tables, gated on a new
  `audit.retention.manage` permission — this is a compliance-officer
  action, distinct from `audit.log.view` (ticket 0078), same
  "narrower action gets its own permission" pattern as every prior
  M09 sub-ticket.
- **Do not build enforcement in this ticket** — i.e. do not wire an
  actual scheduled purge job (no job scheduler exists in this
  codebase, same reasoning ticket 0077 used to skip scheduled health
  recomputation) and do not block any existing delete path on these
  tables yet. Ticket 0080 (data export/deletion) is the one consumer
  that must check `legal_holds` before deleting anything; this ticket
  only has to make the hold a queryable, auditable fact.

## Out of scope
- Any actual automatic purge/deletion once `retention_days` elapses —
  no scheduler exists; this is a future ticket once one does.
- Inventing a default retention period for any entity type.

## Acceptance
- [x] `retention_policies` and `legal_holds` created, tenant-scoped,
      RLS enabled, no seeded/default rows.
- [x] `audit.retention.manage` permission exists, deny-by-default.
- [x] Placing a legal hold requires a non-blank reason; releasing one
      is a separate, audited action (do not allow deleting a hold row
      — release it, same "compensating record, never delete" pattern
      as ticket 0066's approval revocations).
- [x] Tests cover tenant isolation, permission gating, and that no
      retention period is ever defaulted or invented by the code.

## Progress
- 2026-10-16: Filed as the second of three M35 sub-tickets (see
  ticket 0068's split). Not yet scoped against a full BRD re-read —
  flagged above as the one thing to double check before building,
  since this ticket (unlike 0078) has no BRD FR-xxx number backing it,
  only the PRD module-row prose.
- 2026-10-16 07:40 UTC: Built. Confirmed via a BRD re-read that there
  is still no FR-RET-xxx section — this stays PRD-module-row-prose-only,
  framework-only scope as planned. Migration
  `20261016000008_m35b_retention_policy_and_legal_hold.sql` adds
  `retention_policies` (entity_type, retention_days with a
  `> 0` check, set_by, set_at) and `legal_holds` (entity_type,
  nullable entity_id, reason with a non-blank check, placed_by/
  placed_at, released_by/released_at — both null or both set, enforced
  by a check constraint), both tenant-scoped with RLS, no seeded rows.
  Added `audit.retention.manage` permission, granted only to
  `role.platform_administrator`. Extended the existing `audit` module
  (`backend/src/modules/audit/{types,repository,service,routes}.ts`)
  rather than a new module, since M35b is the same BRD module as
  M35a (ticket 0078) and ticket 0078 already named a distinct
  permission for this exact "narrower action" reason. Routes:
  `POST`/`GET /audit/retention-policies`,
  `POST`/`GET /audit/legal-holds`,
  `POST /audit/legal-holds/:id/release` — all gated on
  `audit.retention.manage`. `createRetentionPolicy` rejects a
  non-positive/non-integer `retentionDays` (400) — there is no code
  path that can default or invent a period. `releaseLegalHold` 404s on
  an unknown hold and 409s on an already-released one; the row is
  never deleted, matching ticket 0066's revocation pattern. Added
  `FakeAuditRepository` support (`addSession`, retention/hold maps)
  and route tests for all five endpoints covering permission gating,
  tenant isolation, the blank-reason/non-positive-period rejections,
  and the release-twice 409. Full backend suite: 382/382 passing.
  Deliberately not built (per ticket's own "out of scope"): any
  scheduled purge, and ticket 0080's own job of actually checking
  `legal_holds` before a deletion — this ticket only makes holds a
  queryable, auditable fact, per its own text.
