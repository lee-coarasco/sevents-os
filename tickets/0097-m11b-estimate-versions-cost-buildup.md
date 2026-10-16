---
id: 97
title: "M11b — Estimate versions & cost build-up (FR-EST-001/002/003)"
status: testing
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
- [x] `estimates` + `estimate_lines` tables, tenant-scoped RLS, every
      FR-EST-001 field (assumptions, inclusions, exclusions, taxes,
      overheads, contingency, margin) a real column.
- [x] `estimate_lines.source`/`confidence` nullable fields exist, FR-
      EST-002-ready, with no AI call behind them yet.
- [x] Approving an estimate version locks it (FR-EST-003): further
      edits create a new version, never mutate the approved one.
- [x] Tests cover tenant isolation, permission gating, the version-
      lock behavior, and the approval-seam integration.

## Progress
- 2026-10-16: Filed as the second of three M11 sub-tickets (see ticket
  0095's split).
- 2026-10-16 12:00 UTC: Built. New module `backend/src/modules/estimating/`
  (types.ts, repository.ts with Supabase-backed impl +
  `backend/src/test/fakeEstimatingRepository.ts`, service.ts,
  routes.ts, service.test.ts, routes.test.ts) — a new module rather
  than extending `modules/tendering`, since estimates have their own
  versioned/workflow-approved lifecycle distinct from tendering's
  simple document-register CRUD; see DECISIONS.md for the full
  rationale. Routes gated on the existing `tendering.document.manage`
  permission (no new permission minted, per the ticket's instruction
  to reuse it). Wired into `backend/src/app.ts` exactly like
  `tenderingRoutes`.
  - Migration `supabase/migrations/20261016000016_m11b_estimate_versions_cost_buildup.sql`:
    `estimates` (version, status, assumptions/inclusions/exclusions,
    taxes/overheads/contingency/margin, subtotal_amount/total_amount,
    nullable workflow_instance_id, FK to tender_submissions) and
    `estimate_lines` (item/quantity/unit/rate/cost_category/line_total,
    FR-EST-002's `source`/`confidence` reserved columns). Both
    tenant-scoped RLS, FK indexes. **Not applied to the live Supabase
    project** — no reachable Supabase MCP tools in this sandbox (no
    `.mcp.json`, no `SUPABASE_*` env vars); confirmed this independently
    before starting, consistent with ticket 0094's open finding. Same
    gap as ticket 0096 and every Supabase-backed module built this
    session; not treated as a blocker for the rest of the work.
  - FR-EST-003 approval/lock flow mirrors ticket 0075's
    `proposeBaselineChange`/`resolveBaselineChangeRequest` exactly:
    `submitEstimateForApproval` starts a `request_approval` workflow
    instance (ticket 0066's seam) and moves the estimate to
    `pending_approval`; `resolveEstimateApproval` polls the instance's
    step instances for a `decision` and on `"approved"` locks this
    version (`status: 'approved'`) while superseding whichever sibling
    version of the same tender submission was previously approved
    (`status: 'superseded'`); on `"rejected"`/`"returned_for_correction"`
    it updates status accordingly without creating a new version.
    `createNextEstimateVersionFrom` copies an estimate's FR-EST-001
    fields and all `estimate_lines` forward into a new draft version —
    the only legal way to change an approved (locked) estimate.
    `line_total`/`subtotal_amount`/`total_amount` are always computed
    server-side (service layer), never trusted from the caller.
  - Judgment calls recorded in DECISIONS.md (2026-10-16 12:00 UTC
    entry): (1) new `estimating` module vs. extending `tendering`; (2)
    `returned_for_correction` kept as its own `estimates.status` value
    (matching ticket 0066's `ApprovalChainDecision`), treated as
    editable-in-place like `draft`, rather than collapsed into
    `draft`.
  - Tests: `backend/src/modules/estimating/service.test.ts` (9 cases:
    FR-EST-001 fields on create, total recomputation on line add/
    remove, FR-EST-002 default source/confidence, lock-on-approve +
    blocked edits, new-version-copies-forward + old-version-superseded,
    reject path, returned_for_correction path stays editable, tenant
    isolation) and `backend/src/modules/estimating/routes.test.ts` (5
    HTTP-level cases covering permission gating, 401/400/404/409
    status codes, and the full propose→approve→lock→new-version flow
    over HTTP). Full backend suite: 524/524 passing (510 pre-existing +
    14 new). `npm run build` clean.
  - Status set to `testing`, not `done`, same reason as every other
    Supabase-backed ticket this session — code is tested against the
    in-memory fake only, nothing has run against the live database yet
    (ticket 0094).
