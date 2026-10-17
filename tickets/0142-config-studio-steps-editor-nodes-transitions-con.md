---
id: 142
title: Config Studio steps editor — nodes, transitions, conditions on a draft version
status: next
roles: [ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0116 (see DECISIONS.md). Depends on ticket 0141 (shell/
detail page must exist first). Builds the actual graph editor on a draft
version's `/config-studio/:definitionId/versions/:versionId` page.

## Backend reference (surveyed this session)
- `GET /workflow/versions/:versionId/graph` → `{ graph: { nodes,
  transitions, conditions } }`. Only editable while the version's status is
  `draft`.
- `POST /workflow/versions/:versionId/nodes` — body `{ nodeKey, nodeType,
  config? }`. `nodeType` is one of: `create_task, assign_role_user,
  collect_form_data, request_upload_evidence, evaluate_condition,
  call_service, request_approval, send_notification, wait_event_time,
  create_linked_followup, escalate, complete, cancel`.
- `POST /workflow/versions/:versionId/transitions` — body `{ fromNodeId,
  toNodeId, conditionId?, orderIndex? }`.
- `POST /workflow/versions/:versionId/conditions` — body `{ expression:
  { field, operator: eq|neq|gt|gte|lt|lte, value }, description? }`.
- No PATCH/DELETE routes exist for nodes/transitions/conditions today —
  only POST (create). If the UI needs to "remove" a step, check whether a
  delete route truly doesn't exist before building a workaround (e.g.
  hiding a node client-side) — if the backend gap is real, that's its own
  backend ticket, not something to fake in the frontend.

## Scope
- Node list for the open draft version, rendered as an ordered step list
  (order inferred from transition chain starting at the node with no
  incoming transition).
- "Add step": node-type select + `nodeKey` + per-type config form:
  - `create_task`/`assign_role_user`: role or user (via `<UserPicker>`),
    `slaDefinitionKey` (free text/select if an SLA list endpoint exists —
    check `/workflow/sla-definitions`).
  - `request_approval`: approver picker (multi — `<UserPicker>` repeated
    or a multi-select), sequential/parallel toggle, required-approvals
    count, optional segregation-of-duties checkbox, optional approval
    limit (role/department/amount field/currency field).
  - `evaluate_condition` (gateway): create one or more `<condition>`
    rows (field/operator/value) first, then branch transitions reference
    them.
  - Other types: `nodeKey` + raw JSON config textarea is an acceptable v1
    (don't over-build bespoke forms for every one of the 13 types if usage
    is rare — note which ones got a real form vs. the JSON fallback).
- Adding a step after the first auto-creates the connecting transition
  (sequential chain) unless the user is building a branch, in which case
  let them pick the condition for that specific transition.
- Reorder/delete: confirm with the backend survey note above before
  promising either in the UI — if no backend support, scope this ticket
  down explicitly rather than building a fake client-only reorder.

## Acceptance
- [ ] Steps editor shows the current draft version's graph as an ordered
      list with per-type detail.
- [ ] Add step (all 13 node types representable — bespoke form or JSON
      fallback, noted which).
- [ ] Branching: at least one worked example of a gateway + condition +
      two transitions.
- [ ] Gaps found in backend support (reorder/delete) are either resolved
      with a small backend addition in this ticket or filed as a named
      follow-on, not silently dropped.
- [ ] Tests.

## Progress
