---
id: 66
title: "M08 — Approvals & Delegation"
status: testing
roles: [architect, backend-engineer]
priority: 8
created: 2026-10-15
updated: 2026-10-15
---

Third Phase 3 module per `docs/PRD.md`'s build-order table. Depends on
M03 (done), M06 (done) and M07 (ticket 0065 — approvals are a kind of
task/queue entry, build after the base task model exists). Also ties
into ticket 0062 (M06c)'s `request_approval` step type and ticket
0056 (M03)'s `approval_limits`/segregation-of-duties groundwork, both
already laid but unexercised — this module is where they get real
callers.

Reference: BRD §8.3 (FR-APP-001 through 006): sequential/parallel
approval; approver sees request + evidence + policy/authority + risk
flags + audit history; approve/reject/return-for-correction require
identity+timestamp, rejection/return requires a reason; approvals
checked against current authority and conflicts; thresholds
configurable and versioned; an approval can only be revoked through a
controlled compensating process, never by deleting history. BRD §3.2
(authorization model) and CLAUDE.md's standing note that approval
value-bands and self-approval policy are still `TBD—Business Owner
Decision` (PRD open decisions #1/#4) — do not invent specific limits or
decide the self-approval question; keep using the existing deny-by-
default/TBD placeholders ticket 0056 set up.

## Progress
- 2026-10-15: Filed as the third Phase 3 module, left at `next` behind
  tickets 0064 (M04) and 0065 (M07) in priority order. Not yet scoped —
  re-read BRD §8.3 and ticket 0056/0062's existing approval-adjacent
  groundwork before designing the data model.
- 2026-10-15 21:17 UTC: Built. One ticket, not split (unlike M06/M07) —
  FR-APP-001..006 is six requirements with less surface area than
  M07's seven queue views. Migration
  `supabase/migrations/20261015000012_m08_approvals_and_delegation.sql`:
  (1) `approval_limits` (ticket 0056) gets `valid_from`/`valid_to` —
  FR-APP-005 "configurable and versioned" — a new limit for a scope
  supersedes the old one by closing its `valid_to`, never an in-place
  edit (`modules/authority/repository.ts` `createApprovalLimit`); (2)
  new `approval_decisions` (one row per approver's decision within a
  `request_approval` step's chain, `decided_by`+`decided_at` for
  FR-APP-003's identity+timestamp, reason required unless approved);
  (3) new `approval_revocations`, FR-APP-006's compensating-process
  table — the original decision row is never edited/deleted, only a
  revocation is appended; (4) new `workflow.approval.revoke`
  permission (deny-by-default, platform_administrator only).
  `backend/src/modules/workflow/approvals.ts` (new, pure logic, same
  split as validation.ts/simulation.ts/migration.ts):
  `normalizeApprovalChainConfig` reads a `request_approval` node's
  `config.approverUserIds`/`mode`/`requiredApprovals` (returns null for
  the pre-existing single-approver `config.roleId`/`userId` shape —
  that legacy case is treated as a one-decision chain by the caller,
  not an error); `pendingApproverIds`/`resolveChainOutcome` implement
  FR-APP-001's sequential/parallel chains (any rejection or
  return-for-correction short-circuits the whole chain regardless of
  mode — a scope decision, see DECISIONS.md). `service.ts` adds
  `decideApprovalStep` (FR-APP-001/003/004: records the decision,
  checks the node's optional `approvalLimit`/`enforceSegregationOfDuties`
  against `modules/authority`'s `isWithinApprovalLimit`/
  `checkSegregationOfDuties` — only when the node explicitly asks for
  either, never by default — then calls the existing
  `completeStepInstance` once the chain resolves, so FR-WI-009/010's
  fan-out and complete-node gate apply unchanged), `getApprovalDetail`
  (FR-APP-002: request/context + evidence file ids (from
  `evidence_attached` events) + policy/authority check + audit history
  + `riskFlags: []` — no risk-scoring engine exists, never fabricated)
  and `revokeApprovalDecision` (FR-APP-006). New routes: `GET
  /approvals/:stepInstanceId`, `POST /approvals/:stepInstanceId/decide`,
  `POST /approvals/decisions/:decisionId/revoke`
  (`workflow.approval.revoke` only — no own-row bypass, since
  revocation is meant to be a controlled process, not every approver's
  own undo button). New `requireApproverOrAct` preHandler: a step's
  `assigned_to` OR anyone in the node's `approverUserIds` chain can
  decide/view without the admin-wide `workflow.instance.act`
  permission — `decideApprovalStep` itself still enforces exact
  "is it your turn" eligibility. `app.ts` threads
  `getAuthorityRepository` into `workflowRoutes` (additive option).
  Tests: `approvals.test.ts` (13 pure chain-logic cases),
  `approval-decisions.test.ts` (8 service-level cases: sequential
  ordering, parallel requiredApprovals, rejection short-circuit +
  reason requirement, approval-limit allow/deny/missing-fields,
  getApprovalDetail shape, revocation re-opening a sequential turn),
  5 new `routes.test.ts` cases (approver-without-permission 200,
  non-approver 403, missing-reason 400, GET detail 200, revoke
  permission-gated 403/200). `npm run build`/`lint`/`npm test`:
  274/274 across 25 files (was 251/23 before this ticket).
  `scripts/tickets.py check` clean.
- **Scope decisions (DECISIONS.md), both agent-decidable per
  CLAUDE.md:** (1) a chain's approvers are an explicit
  `approverUserIds` list, not role-resolved — this codebase has no
  "any user holding role X" mechanism yet, so a chain must name real
  users; (2) any rejection/return-for-correction immediately resolves
  the whole chain (sequential or parallel) rather than waiting out
  the remaining approvers; (3) revocation on an already-completed step
  only restores the audit trail — it does not rewind the workflow
  instance's already-advanced progress, which is out of scope here
  (same "don't build unrequested machinery" call as ticket 0072's
  delegation note).
- **Still deliberately untouched, per CLAUDE.md/PRD:** no real
  `approval_limits` rows are seeded (PRD §5 open decision #1 still
  unanswered) and `enforceSegregationOfDuties` stays opt-in per node,
  never default-on (PRD §5 open decision #4 still unanswered) — both
  checks exist and are exercised by this ticket's tests with
  explicitly-configured test data, but no workflow built so far turns
  them on for real.
- Status: `testing`. Next: M09 (Project & Portfolio Management,
  ticket 0067), the next module in the BRD build order.
