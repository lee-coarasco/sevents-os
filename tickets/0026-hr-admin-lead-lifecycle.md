---
id: 26
title: "Classify catalogue cluster: HR & Admin Lead employee lifecycle and admin operations"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 27 People & Culture rows
carrying "HR & Admin Lead" as `Who is Responsible` (#977-1003). Second
batch of the People & Culture department pass (ticket 0007). This
department's source text is shaped differently from most others
classified so far (shorter per-field text, many distinct per-row
triggers rather than 5+ rows sharing one verbatim trigger sentence), so
clusters here are smaller and some rows stand alone rather than grouping
into 5-row trigger-clusters.

## Source rows covered

**A. Recruitment evaluation** — trigger: "an approved manpower
requirement reaches the recruitment stage."

| S.No. | Work item |
|---|---|
| 977 | Evaluate and shortlist candidates |
| 978 | Confirm approved salary package and joining date |

**B. Onboarding** — trigger: "an approved candidate accepts the offer
and a joining date is confirmed."

| S.No. | Work item |
|---|---|
| 979 | Deliver company induction and policy briefing |
| 980 | Introduce employee to team and reporting line |
| 981 | Collect first-week performance and onboarding feedback |

**C. Employee exit, handover and clearance** — near-identical triggers:
"a resignation, termination or employee exit is formally approved"
(982) / "an employee exit is approved" (1002).

| S.No. | Work item |
|---|---|
| 982 | Confirm departmental work handover |
| 1002 | Coordinate exit clearance, final settlement and exit interview |

**D. Visa, permit, travel and PRO transactions** (standalone row) —
trigger: "an approved employment, renewal, cancellation, visit or travel
requirement is received or an expiry alert becomes due."

| S.No. | Work item |
|---|---|
| 983 | Coordinate staff accommodation and requirements |

**E. Employee lifecycle records, payroll and benefits administration** —
trigger: "an employee lifecycle event, approved request or scheduled
People & Culture activity becomes due."

| S.No. | Work item |
|---|---|
| 984 | Prepare warning letters and disciplinary memos |
| 985 | Draft employment contracts |
| 986 | Coordinate employee performance appraisals |
| 987 | Issue and track quarterly appraisal forms |
| 988 | Update ERP timesheets and verify payroll inputs |
| 989 | Administer employee medical and workers compensation insurance |
| 990 | Follow up approved People & Culture payments with Accounts |
| 991 | Process salary advance requests for approval |

**F. Office, vendor and project-support administration** — trigger: "an
approved office, vehicle, portal, vendor, document or project-support
requirement is received or a renewal becomes due."

| S.No. | Work item |
|---|---|
| 992 | Coordinate People & Culture requirements with site engineers |
| 993 | Prepare and control company policies for management approval |
| 994 | Prepare company event communications and announcements |
| 995 | Coordinate contractor's all-risk insurance for projects |
| 996 | Prepare and route project undertakings for approval |
| 997 | Coordinate approved vendors for systems, uniforms, software and supplies |

**G. Recruitment requisition and offer issuance** (standalone triggers:
"a department requests manpower" / "after candidate selection").

| S.No. | Work item |
|---|---|
| 998 | Validate manpower requisition and budget before recruitment |
| 999 | Manage formal offer approval and issuance |

**H-K. Standalone lifecycle capabilities** (each its own trigger and
Output/Evidence shape).

| S.No. | Work item | Trigger |
|---|---|---|
| 1000 | Process employee transfers, promotions and salary changes | An authorised employee-change request is received. |
| 1001 | Manage grievance and disciplinary case workflow | A complaint, policy breach or disciplinary concern is reported. |
| 1003 | Maintain employee training and competency plan | Onboarding, appraisal or a competency gap is identified. |

All 27 rows: canonical `role.hr_admin_lead` (already listed in
`docs/canonical-role-map.md`). Shared escalation throughout: "The
trained HR & Admin Assistant may prepare records as operational backup,
but approvals and material exceptions escalate to the CPCO" — this role
is the operational layer beneath CPCO (ticket 0025), same shape as
Senior Accountant (Lead)/Legal Counsel (Lead)/Marketing Manager (Lead):
it runs the HR pipeline the CPCO approves into (recruitment rows 972,
999 feed CPCO's row 972; grievance row 1001 feeds CPCO's row 975;
transfers/terminations feed CPCO's row 973).

## Disposition

**Configure workflow** for 26 of 27 rows (all except 983): each is a
recurring operational task with a traceable next consumer — recruitment/
onboarding/exit clusters (A-C, G) feed CPCO approval or close an
employee-lifecycle loop; records/payroll/benefits administration (E) and
office/vendor/project-support administration (F) are ongoing tasks with
a downstream approver (CPCO, Finance, the relevant department); the
standalone transfers (H), grievance-case (I) and training-plan (K) rows
are each a bounded operational process with a recorded outcome and a
named next step. Grievance-case row 1001 is the operational execution
of CPCO's own governance row 975 (ticket 0025) — same "Lead runs the
workflow, CXO approves/governs" split used throughout this catalogue
(Senior Accountant Lead/CFO, Legal Counsel Lead/CLO, Marketing Manager
Lead/CMO).

**Track obligation/document** for 983 ("coordinate staff accommodation
and requirements"): the one row explicitly describing visa, permit,
travel, accommodation and PRO (government-portal) transactions
triggered by "an expiry alert" — a renewal/filing obligation in BRD
§6.5's own terms, not a multi-step pipeline with sibling rows the way
every other cluster here has.

## Acceptance
- [x] All 27 HR & Admin Lead rows (#977-1003) classified — 8 clusters/
      standalone rows, with 983 split out as Track obligation/document.
- [x] Confirmed `role.hr_admin_lead` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [ ] Authority limits (recruitment/compensation approval thresholds,
      termination authority) are the same open PRD §8-9 decision as
      every other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 27 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 27 HR & Admin Lead
  rows — second role batch of the People & Culture department pass
  (ticket 0007). 3 raw labels / 65 rows remain in People & Culture (HR &
  Admin Assistant, Office Assistant, IT Support Engineer).
