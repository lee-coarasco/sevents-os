---
id: 143
title: Config Studio — validation panel, submit/approve/publish actions
status: next
roles: [ui-designer, test-engineer]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0116 (see DECISIONS.md). Depends on ticket 0141 (detail
page). Does not strictly depend on 0142 (steps editor) — validation/publish
can be exercised against an empty or partially-built draft too, so this can
be built in parallel with 0142 if useful.

## Backend reference (surveyed this session)
- `POST /workflow/versions/:versionId/validate` — permission
  `workflow.definition.manage`. Returns `{ run: { result: pass|fail,
  findings: [{ code, severity, message, nodeId? }], started_at,
  finished_at } }`. Finding codes: `UNREACHABLE_NODE, NO_TERMINAL_NODE,
  CIRCULAR_NO_EXIT, DANGLING_ROLE_REFERENCE, DANGLING_CONDITION_REFERENCE,
  AMBIGUOUS_START`.
- `POST /workflow/definitions/:id/submit` — permission
  `workflow.definition.manage`. Body `{ versionId }`. Moves definition
  `draft` → `under_review`.
- `POST /workflow/definitions/:id/approve` — permission
  `workflow.definition.publish`. Body `{ versionId, decision:
  approved|rejected, comment? }`.
- `POST /workflow/definitions/:id/publish` — permission
  `workflow.definition.publish`. Body `{ versionId, effectiveFrom? }`.
  Preconditions: definition status `approved`, version status `draft`,
  version has a passing validation run.

## Scope
- Validation panel on the version detail page: "Run validation" button,
  shows a green "passes" banner or a list of findings with severity colour
  and the offending `nodeId` linked back to that step in the steps editor
  (ticket 0142) if present on the page, otherwise just the node key/id.
- Submit for review button (draft → under_review) with the current
  version id.
- Approve/Reject action for `workflow.definition.publish` holders —
  decision + optional comment.
- Publish button — enabled only when definition is `approved` and the
  version has a passing validation run; confirms with "This will become
  the active version for all new instances."
- All actions gated by the correct permission (`workflow.definition.manage`
  vs `workflow.definition.publish` — they differ per the survey above,
  don't gate everything on one string).

## Acceptance
- [ ] Validate button shows pass/fail and every finding.
- [ ] Submit/approve/reject/publish all wired to the real endpoints with
      the right permission gates.
- [ ] Publish is disabled (not hidden) with an explanatory tooltip/text
      when preconditions aren't met.
- [ ] Tests.

## Progress
