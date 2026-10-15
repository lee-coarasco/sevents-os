---
id: 60
title: "M06a — Workflow Definition Data Model, CRUD & Versioning"
status: testing
roles: [backend-engineer]
priority: 2
created: 2026-10-15
updated: 2026-10-15
---

First of four M06 sub-tickets (ticket 0059 split this large module into
smaller pieces per its own instruction — see that ticket's Progress note
and DECISIONS.md). Depends on M03 (done, `role_definitions`/
`permissions`) and M05 (ticket 0058, `status: testing`,
`work_item_definitions.capability_key`/`workflow_template_id`
placeholders this module exists to fill in).

Reference: BRD §5.4.1 (configuration domains), §5.4.2 (configuration
lifecycle: draft → validate → simulate → approve → publish → rollback,
immutable versions, audit diff), §5.4.3 (generic workflow runtime
contract — the finite set of supported step types), §6.2
(WorkflowDefinition/WorkflowVersion/WorkflowNode/WorkflowTransition/
WorkflowCondition/ConfigurationChange/ConfigurationApproval/
PublishedConfiguration/ConfigurationRollbackEvent entities), FR-WI-005
through FR-WI-008, FR-WI-011, FR-WI-012.

## What to build

This ticket is the data model and authoring/publish lifecycle only — NOT
validation/simulation logic (ticket 0061), NOT the runtime engine that
actually executes a workflow instance (ticket 0062), NOT the migration
workflow for moving active instances to a new version (ticket 0063).
Those three depend on this one existing.

1. **Migration** `supabase/migrations/..._m06a_workflow_definitions.sql`:
   - `workflow_definitions`: `tenant_id` **NOT NULL** (deviates from M05's
     nullable-tenant shared-catalogue pattern — a workflow definition is
     a concrete per-tenant business-process configuration, BRD §5.4.1
     item 3, not a shared taxonomy like roles/catalogue rows; record this
     distinction in DECISIONS.md), `key` (slug, unique per tenant),
     `name`, `description`, `capability_key` (what
     `work_item_definitions.capability_key` will reference once M06b/c
     exist), `status` (draft / under_review / approved / published /
     retired — reuse the same five-value shape as `work_item_definitions.status`
     for consistency), `current_version` int, audit columns.
   - `workflow_versions`: append-only, `workflow_definition_id` FK,
     `version` int (unique per definition), `status` (draft / published /
     retired — a version's own lifecycle, independent of other versions
     of the same definition), `effective_from`/`effective_to`
     (nullable), `rollback_of_version` (nullable int — set when this
     version's content is a republish of an earlier version, BRD §5.4.2
     "rollback means publish a previous configuration version"),
     `published_by`/`published_at`, audit columns.
   - `workflow_nodes`: `workflow_version_id` FK, `node_key`, `node_type`
     (check constraint — the BRD §5.4.3 finite step-type list: create_task,
     assign_role_user, collect_form_data, request_upload_evidence,
     evaluate_condition, call_service, request_approval, send_notification,
     wait_event_time, create_linked_followup, escalate, complete, cancel),
     `config` jsonb (step-specific — form schema ref, assignment rule,
     service name, etc. — do not invent a service registry here, just
     store the key the runtime engine will look up in ticket 0062).
   - `workflow_transitions`: `workflow_version_id` FK, `from_node_id`,
     `to_node_id`, `condition_id` (nullable FK), `order_index` (for
     deterministic evaluation order among multiple transitions from the
     same node).
   - `workflow_conditions`: `workflow_version_id` FK, `expression` jsonb
     — a deterministic, structured condition (e.g.
     `{field, operator, value}`), never free text or an LLM call (BRD
     §5.4.3: "conditions affecting money, legal obligations, engineering
     release or safety must be deterministic and testable").
   - `configuration_changes`: append-only audit row per create/update/
     publish/rollback on a workflow definition/version — entity_type,
     entity_id, change_type, diff jsonb, reason, changed_by, created_at.
     Human-readable diff per BRD §5.4.2.
   - `configuration_approvals`: `workflow_version_id` FK, `approver_id`,
     `decision` (approved/rejected), `comment`, `decided_at`.
   - `published_configurations`: append-only record of each publish
     event — `workflow_definition_id`, `workflow_version_id`,
     `effective_from`, `published_by`, `published_at`.
   - `configuration_rollback_events`: append-only — `workflow_definition_id`,
     `from_version`, `to_version`, `rolled_back_by`, `reason`, `created_at`.
   - All tenant-scoped NOT NULL tenant_id, RLS enabled, same isolation
     pattern as `companies`/`branches`/`projects` (ticket 0055) — standard
     tenant business data, not the nullable-tenant shared-catalogue
     pattern from M03/M05.
   - New permissions: `workflow.definition.manage` (create/edit draft
     definitions, nodes, transitions, conditions) and
     `workflow.definition.publish` (submit for approval, approve,
     publish, rollback — BRD §5.4.2's "authorized process owner" /
     "designated specialist approval" gate). Deny-by-default, granted
     only to `role.platform_administrator` for now (same bootstrap
     precedent as every permission added so far — a later ticket wires
     real process-owner roles once PRD's open role-mapping decisions are
     answered).

2. **Backend module** `backend/src/modules/workflow/` — repository
   (interface + Supabase adapter, same not-yet-live-tested gap as every
   prior module), service, routes, types. Service functions:
   - `createWorkflowDefinition` (draft, version 1 empty graph).
   - `createDraftVersion` (new draft version off an existing definition —
     either blank or copied from a given version, for editing a published
     workflow without mutating it, per BRD §5.4.2's immutable-versions rule).
   - `addNode` / `addTransition` / `addCondition` to a draft version —
     reject `node_type` outside the BRD §5.4.3 supported set.
   - `submitForApproval`, `recordApproval` (approve/reject with
     `workflow.definition.publish` permission).
   - `publishVersion` — only from an approved draft; sets the version's
     status to published, the definition's `current_version` and
     `status` to published, writes a `published_configurations` row and
     a `configuration_changes` row. Does not touch any other version's
     status (old published version becomes historical, not deleted —
     BRD §5.4.2 "never erase historical versions").
   - `rollbackToVersion` — publishes a previous version as a new version
     row with `rollback_of_version` set (never rewrites the old row),
     writes a `configuration_rollback_events` row.
   - Every mutating call writes a `configuration_changes` row with a
     diff (reuse the same "snapshot before/after" shape ticket 0058 used
     for `work_item_definition_versions`).
   - Validation that a referenced role/permission exists before a node
     referencing `assign_role_user` can be added is OUT of scope here —
     that is ticket 0061's structural-validation job. This ticket's node/
     transition/condition CRUD may accept any well-formed row; publishing
     without 0061's validation existing yet means a published workflow
     could be structurally broken — acceptable for this ticket since
     0062 (runtime) won't exist yet either to execute it.

## Explicitly NOT in this ticket
- Validation/simulation runs (circular dependency detection, unreachable
  steps, missing role/SLA references) — ticket 0061.
- The runtime engine that creates/executes `WorkflowInstance`/
  `WorkflowStepInstance`/`WorkflowEvent` rows — ticket 0062.
- The explicit migration workflow for moving *active* instances from one
  published version to a newer one — ticket 0063. `rollbackToVersion`
  here only affects which version *new* instances would use once 0062
  exists; there are no instances yet to migrate.
- Wiring `work_item_definitions.workflow_template_id` to point at a real
  `workflow_definitions.id` — a follow-up once this table exists; note
  it as a small addition in whichever ticket (0061 or a catalogue
  follow-up) ends up doing it, don't scope-creep it into this one.

## Acceptance
- [x] Migration creates all 8 tables above, tenant-scoped NOT NULL
      tenant_id, RLS enabled on every one.
- [x] `workflow.definition.manage` and `workflow.definition.publish`
      permissions exist, deny-by-default, granted to
      `role.platform_administrator`.
- [x] Service layer: create definition → add nodes/transitions/
      conditions on a draft version → submit for approval → approve →
      publish, all unit-tested against a fake repository.
- [x] `node_type` outside the BRD §5.4.3 supported set is rejected
      (test asserts this).
- [x] Publishing a new version never mutates or deletes a previously
      published version's row (test asserts the old version row is
      unchanged after a second publish).
- [x] `rollbackToVersion` creates a new version row pointing back via
      `rollback_of_version`, never rewrites the rolled-back-to version's
      original row (test asserts this) and writes a
      `configuration_rollback_events` row.
- [x] Every mutating operation writes a `configuration_changes` row
      (test asserts this for at least create/publish/rollback).
- [x] Routes gated on the two new permissions (401/403 tests, same
      pattern as every prior module).
- [x] `npm test` and `npm run build` pass; `scripts/tickets.py check`
      clean.

## Progress
- 2026-10-15: Filed as the first of four M06 sub-tickets (ticket 0059
  split per its own instruction — see ticket 0059's Progress note).
- 2026-10-15 15:15 UTC: Built M06a. Migration
  `supabase/migrations/20261015000005_m06a_workflow_definitions.sql`
  adds `workflow_definitions`, `workflow_versions`, `workflow_nodes`,
  `workflow_transitions`, `workflow_conditions`, `configuration_changes`,
  `configuration_approvals`, `published_configurations`,
  `configuration_rollback_events`, all NOT NULL tenant_id + RLS, plus the
  two new permissions seeded to `role.platform_administrator`. Backend:
  `backend/src/modules/workflow/` — repository (interface +
  not-yet-live Supabase adapter, same honest gap as every prior ticket),
  service (`createWorkflowDefinition`, `createDraftVersion` with
  optional graph cloning, `addNodeToVersion`/`addTransitionToVersion`/
  `addConditionToVersion` gated on the target version being `draft`,
  `submitForApproval`/`recordApproval` driving `workflow_definitions.status`
  through draft→under_review→approved(/back to draft on reject),
  `publishVersion`, `rollbackToVersion`), `routes.ts` (REST endpoints,
  `submit` gated on `workflow.definition.manage`, `approve`/`publish`/
  `rollback` gated on `workflow.definition.publish`). `npm test`:
  108/108 (all prior + 29 new workflow tests), `npm run build` clean,
  `scripts/tickets.py check` clean (had to `npm install` first — backend
  `node_modules` wasn't present in this session's checkout).
  **Design decision recorded here (DB schema detail, agent-decidable):**
  `workflow_definitions.current_version` only moves on publish/rollback,
  never on draft creation — it is "the version number new/existing
  instances pin to," not "the latest version that exists." A new draft
  flips `status` back to `draft` (there is now an unpublished draft in
  progress) while `current_version` keeps pointing at whichever version
  is still actually published, so ticket 0062's future runtime engine
  has a stable, unambiguous column to read.
  Explicitly deferred to 0061/0062/0063 per this ticket's own scope: no
  structural validation (a node can reference a nonexistent role/
  condition today), no runtime instance creation, no migration-of-active-
  instances tooling.
