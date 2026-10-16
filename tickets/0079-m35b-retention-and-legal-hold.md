---
id: 79
title: "M35b — Retention policy & legal hold"
status: next
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
- [ ] `retention_policies` and `legal_holds` created, tenant-scoped,
      RLS enabled, no seeded/default rows.
- [ ] `audit.retention.manage` permission exists, deny-by-default.
- [ ] Placing a legal hold requires a non-blank reason; releasing one
      is a separate, audited action (do not allow deleting a hold row
      — release it, same "compensating record, never delete" pattern
      as ticket 0066's approval revocations).
- [ ] Tests cover tenant isolation, permission gating, and that no
      retention period is ever defaulted or invented by the code.

## Progress
- 2026-10-16: Filed as the second of three M35 sub-tickets (see
  ticket 0068's split). Not yet scoped against a full BRD re-read —
  flagged above as the one thing to double check before building,
  since this ticket (unlike 0078) has no BRD FR-xxx number backing it,
  only the PRD module-row prose.
