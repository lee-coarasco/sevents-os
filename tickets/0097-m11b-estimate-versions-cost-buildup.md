---
id: 97
title: "M11b — Estimate versions & cost build-up (FR-EST-001/002/003)"
status: next
roles: [backend-engineer]
priority: 14
created: 2026-10-16
updated: 2026-10-16
---

Second of three M11 sub-tickets (see ticket 0095 for the split
rationale). Depends on ticket 0096 (M11a — an estimate is built
against a registered tender) and M08 (ticket 0066's approval seam, for
FR-EST-003's approved-version lock, same "no parallel approval
mechanism" rule every M09/M10 sub-ticket already followed).

## What to build
- FR-EST-001: estimate versions, each traceable to quantities, rates,
  assumptions, inclusions, exclusions, taxes, overheads, contingency
  and margin — every one of those a real column/row, not a jsonb
  catch-all, same discipline ticket 0090 used for FR-CRM-001. An
  estimate has many line items (quantity takeoff inputs × labour/
  material/equipment/subcontractor rate build-ups, per the catalogue's
  Civil/MEP Estimator rows — ticket 0014 groups C "rate build-up" and D
  "risk/contingency"), so this is at minimum two tables: `estimates`
  (version, status, totals, assumptions, exclusions, margin) and
  `estimate_lines` (item, quantity, unit, rate, cost category —
  labour/material/equipment/subcontractor — line total).
- FR-EST-002: AI may extract quantities or suggest rates only with
  source and confidence; a qualified person validates before approval.
  No AI extraction exists in this codebase yet (M28/M29, Phase 4+'s AI
  modules, haven't started) — do NOT build an AI call here. Just make
  `estimate_lines` AI-ready: a nullable `source` field (e.g. `"manual"`
  vs `"ai_suggested"`, defaulting to `"manual"`) and a nullable
  `confidence` field, so a future AI feature has somewhere to write
  without a schema change, and so a line can never silently claim
  AI provenance it doesn't have. Per CLAUDE.md: "AI agents must not
  invent authority limits... Use TBD—Business Owner Decision entries
  for unknowns" — there is no AI feature to gate yet, so this is purely
  a forward-compatible column, not a feature.
- FR-EST-003: once an estimate version is approved (reuse the M08
  `request_approval` seam, same propose→approve→lock shape as ticket
  0075's baseline change requests — "approved" here likely means CFO/
  CTO margin sign-off per the catalogue's row 239 "Submit civil
  estimate for CTO review and approved margin integration"), it is
  locked against silent edits: any further change must go through a
  new version, never an in-place update of an approved one. Mirror
  ticket 0075's `superseded`-on-new-version pattern.

## Out of scope
- Tender document register, scope matrix — ticket 0096 (M11a).
- Bid/no-bid decision, quote approval, bid submission evidence —
  ticket 0098 (M11c).
- Any actual AI quantity-extraction or rate-suggestion feature — M28/
  M29, not started yet; this ticket only reserves the schema fields.

## Acceptance
- [ ] `estimates` + `estimate_lines` tables, tenant-scoped RLS, every
      FR-EST-001 field (assumptions, inclusions, exclusions, taxes,
      overheads, contingency, margin) a real column.
- [ ] `estimate_lines.source`/`confidence` nullable fields exist, FR-
      EST-002-ready, with no AI call behind them yet.
- [ ] Approving an estimate version locks it (FR-EST-003): further
      edits create a new version, never mutate the approved one.
- [ ] Tests cover tenant isolation, permission gating, the version-
      lock behavior, and the approval-seam integration.

## Progress
- 2026-10-16: Filed as the second of three M11 sub-tickets (see ticket
  0095's split).
