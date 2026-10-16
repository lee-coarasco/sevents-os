---
id: 68
title: "M35 — Audit, Security, Privacy & Retention"
status: done
roles: [architect, backend-engineer]
priority: 10
created: 2026-10-15
updated: 2026-10-16
---

Fifth Phase 3 module per `docs/PRD.md`'s build-order table. Depends on
M01, M02 (both done). Note: `auth_audit_log` (ticket 0054) and
`configuration_changes` (ticket 0060) already give this project
per-module append-only audit trails — this ticket is about generalizing/
unifying that pattern (a single queryable audit surface across
modules), access-controlling it, and adding the retention/legal-hold/
data-export-deletion policy layer BRD describes, not re-inventing
auditing that already exists per-table. Check each existing audit table
before designing a new one.

Reference: BRD §8.11 (FR-AUD-001/002): audit logs record actor (human/
agent/system), action, entity, timestamp, request/correlation ID and
before/after values where appropriate; audit records are access-
controlled and protected from normal users' alteration. BRD §7 module
row: "Append-only business audit, login/session audit, permission
review, encryption, retention rules, legal hold, data export/deletion
policy, incident handling, backup/restore tests and access to sensitive
HR/legal/financial records."

Likely smaller than M04/M07/M08/M09 since the core append-only pattern
already exists in multiple tables — this ticket's real work is a
unified read/query surface, retention/legal-hold rules and the data
export/deletion policy, not a new logging mechanism.

## Progress
- 2026-10-15: Filed as the fifth Phase 3 module, left at `next` behind
  tickets 0064-0067 in priority order. Not yet scoped — survey every
  existing audit table (`auth_audit_log`, `configuration_changes`,
  `workflow_events`, `workflow_migration_instance_results`) before
  designing anything new.
- 2026-10-16 01:52 UTC: Surveyed every existing audit-shaped table
  (see ticket 0078's "Survey findings" for the full list) and closed
  this ticket with no code of its own, split the same way tickets
  0059/0065/0067 were: 0078 (M35a — unified audit query surface +
  fixing `auth_audit_log`'s missing tenant-wide admin read path, the
  two concrete FR-AUD-001/002-backed pieces), 0079 (M35b — retention
  policy & legal hold, framework only, no invented default retention
  periods) and 0080 (M35c — data export/deletion policy, approval-
  gated via the M08 seam; its deletion-execution half is blocked on an
  owner answer about which entity types are in scope and
  hard-delete-vs-anonymize — see that ticket's `## Needs approval`).
  One real finding worth flagging here even though it lives in 0078:
  `auth_audit_log` currently has no tenant_id column and its only RLS
  policy is "a user can read their own rows" — not even a platform
  administrator can read someone else's login history today. That is
  arguably *more* restrictive than FR-AUD-002 requires, not less, but
  it means there is currently no way for a Security Admin/Auditor
  role to review login/session audit trails at all, which the PRD's
  module row for M35 explicitly names as in-scope ("login/session
  audit... access to sensitive... records").
- Approved by: agent (ticket classification/ordering is explicitly
  agent-decidable per CLAUDE.md; recorded in DECISIONS.md at the same
  weight as the M06/M07/M09 splits).
