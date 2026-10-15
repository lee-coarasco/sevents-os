---
id: 68
title: "M35 — Audit, Security, Privacy & Retention"
status: next
roles: [architect, backend-engineer]
priority: 10
created: 2026-10-15
updated: 2026-10-15
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
