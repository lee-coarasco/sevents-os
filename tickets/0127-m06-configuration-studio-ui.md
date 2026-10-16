---
id: 127
title: M06 — Configuration Studio UI (workflow definitions, steps editor, versions, validation/simulation)
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 2
created: 2026-10-16
updated: 2026-10-16
---

Split out of ticket 0110 (see ticket 0125/0126 and DECISIONS.md for the
survey). This is the M06 half: the whole Configuration Studio UI
surface over the already-built workflow engine (tickets 0060-0063,
0081). Likely too large for one session — architect should consider
splitting further along the same seams as the acceptance list below
once work starts.

Backend survey (`backend/src/modules/workflow/routes.ts`) — what exists
vs. what this UI needs that doesn't exist yet:
- Definitions: list (`GET /workflow/definitions`), create, get, submit/
  approve/publish/rollback all exist. No archive/retire action for a
  definition exists at all — only the draft→under_review→approved→
  published lifecycle ticket 0060 built; decide whether "archived" is a
  real fifth status or out of scope for this ticket.
- Versions: list, create draft (optionally copying an existing
  version), get graph, validate, simulate all exist.
- Steps/nodes: only **add** (`POST /workflow/versions/:versionId/nodes`,
  `.../transitions`, `.../conditions`) exists. There is no update or
  delete for a node/transition/condition once added, and no explicit
  "order" field to reorder steps — check `addNodeToVersion`'s input
  shape in `service.ts` before assuming reordering is just a PATCH;
  it may need a new backend capability. A draft version editor that
  can only append, never fix or reorder, is a real UX gap worth raising
  with the architect before committing to "add/reorder" in the
  acceptance text below.
- `GET /workflow/definitions/published` (ticket 0109) already exists
  for permission-light definition pickers elsewhere — reuse it for any
  dropdown that doesn't need draft-stage definitions.
- **Notification gap found during this survey**: no code in
  `modules/workflow` calls `dispatchNotification` (grep came back
  empty) — submitting a definition for approval, publishing a version,
  or an SLA escalation firing never notifies anyone today, even though
  M31's dispatch pipeline (ticket 0082) has existed since before this
  module's latest tickets. Per CLAUDE.md's Definition of Done
  ("every action that creates or modifies a workflow-relevant record
  calls dispatchNotification"), this should be fixed as part of
  whichever sub-ticket touches `submitForApproval`/`recordApproval`/
  `publishVersion`/`evaluateStepSla`, not silently left — call it out
  explicitly if splitting this ticket further.

## Acceptance
- [ ] Workflow Definitions list page (name, version, status badge:
  draft/under_review/approved/published — confirm real status enum
  with `backend/src/modules/workflow/types.ts` before building the
  badge, ticket text says draft/published/archived but that may not
  match the real `DefinitionStatus` values).
- [ ] Create/edit workflow definition form (key, name, description,
  capabilityKey/trigger).
- [ ] Steps editor: add steps, set step type/role/SLA on a draft
  version. Reorder/edit-in-place only if the backend survey above
  turns up (or this ticket adds) the capability — don't fake it
  client-side only.
- [ ] Version history panel: list versions, publish/rollback buttons
  wired to the existing endpoints. A real diff view is a nice-to-have;
  don't block the rest of the ticket on building one if versions are
  just JSON graphs with no existing diff utility.
- [ ] Validation panel: run `validateVersion`, show errors inline.
  Simulation: build a sample-payload form, run `simulateVersion`, show
  step-by-step trace.
- [ ] All write actions wrapped in `<PermissionGate>` against
  `workflow.definition.manage` / `workflow.definition.publish` as
  appropriate.
- [ ] Nav link added to `AppLayout`.
- [ ] Fix (or file as its own tightly-scoped ticket) the
  dispatchNotification gap found above.
- [ ] `docs/USER-GUIDE.md` M06 entry updated.

## Progress
