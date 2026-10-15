---
id: 59
title: "M06 — Configuration Studio & Workflow Engine"
status: next
roles: [architect, backend-engineer]
priority: 2
created: 2026-10-15
updated: 2026-10-15
---

Second Phase 2 module per CLAUDE.md's build order, depends on M03 (done)
and M05 (ticket 0058, in progress). Do not start until 0058 is `done` or
at least `testing` — the `work_item_definitions.capability_key` /
`workflow_template_id` placeholder columns it creates are what this
module wires up for real.

Reference: BRD §5.4 (configuration-first architecture, §5.4.1-§5.4.5),
§6.2 (WorkflowDefinition/WorkflowVersion/WorkflowNode/WorkflowTransition/
WorkflowCondition/WorkflowInstance/WorkflowStepInstance/WorkflowEvent/
ConfigurationChange/ConfigurationValidationRun/ConfigurationSimulationRun/
ConfigurationApproval/PublishedConfiguration/ConfigurationRollbackEvent
entities), §8.2 (the M06-relevant FR-WI items: workflow templates,
reusable subflows, form schemas, deterministic conditions, event
triggers, timers, approval gates, retries, compensation, pause/resume,
cancellation, escalation; validate/simulate before publish; effective
dates, immutable versions, change diffs, approvals, publish/rollback,
version-pinned runtime instances; migration workflow for template
changes with preview/impact/approval/audit).

This is a large module — the architect should re-read BRD §5.4 and §8.2
in full and break it into smaller sub-tickets (e.g. workflow definition
CRUD + versioning; the runtime/instance engine; validation/simulation;
publish/rollback/migration workflow) rather than building it as one
giant ticket, consistent with how M01-M03 were each their own ticket.

## Progress
- 2026-10-15: Filed as the second Phase 2 module, left at `next` pending
  ticket 0058 (M05) landing first — M06's data model directly depends on
  M05's `work_item_definitions` table existing.
