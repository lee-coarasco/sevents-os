---
id: 8
title: "Classify catalogue cluster: CTO strategy and design-control lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 25 Technical Engineering rows
carrying "Chief Technical Officer (CTO)" as `Who is Responsible` (#71-95).
First batch of ticket 0007's Technical Engineering pass.

## Source rows covered

**A. Annual strategy and resourcing** — trigger: "the annual planning
cycle, a material business change or an approved management review."

| S.No. | Work item |
|---|---|
| 71 | Set Technical Engineering strategy, design standards and annual objectives |
| 72 | Assign technical process owners, discipline responsibilities and authority limits |
| 73 | Approve technical resource plan, competency requirements and external consultant use |
| 74 | Report Technical Engineering workload, KPIs, risks and corrective actions |

**B. Lead intake and feasibility** — trigger: "Marketing & Sales submits a
qualified lead, client brief and available site information."

| S.No. | Work item |
|---|---|
| 75 | Accept qualified lead and verify the technical handover package |
| 76 | Approve preliminary site-visit and survey plan |
| 77 | Decide preliminary feasibility, constraints and technical no-go conditions |
| 78 | Approve preliminary concept and indicative budget basis for client alignment |

**C. Paid design activation** — trigger: "the client elects to proceed
beyond preliminary concept and commercial activation is required."

| S.No. | Work item |
|---|---|
| 79 | Define paid detailed-design scope, deliverables, programme and fee basis |
| 80 | Approve design quotation or agreement before client issue |
| 81 | Confirm client acceptance and Finance payment before design activation |
| 82 | Chair detailed-design kickoff and assign discipline deliverables |

**D. Discipline design and QA gates** — trigger: "discipline design
reaches the scheduled review or release milestone."

| S.No. | Work item |
|---|---|
| 83 | Approve project design basis, codes, assumptions and technical criteria |
| 84 | Direct multidisciplinary design coordination and clash closure |
| 85 | Approve technical specifications, materials and approved-brand requirements |
| 86 | Approve construction-ready design after interdisciplinary QA review |
| 87 | Approve controlled IFC release and revision status |

**E. Authority submissions and technical queries** — trigger: "an
authority submission, NOC, design change, deviation or critical
clarification is required."

| S.No. | Work item |
|---|---|
| 88 | Approve authority, permit and NOC strategy and submission responsibility |
| 89 | Review and authorise authority submission packages |
| 90 | Decide material design deviations, value engineering and technical changes |
| 91 | Control critical RFIs, technical clarifications and site design issues |

**F. Pricing handover and closeout** — trigger: "design is ready for
pricing, project activation, handover or technical closeout."

| S.No. | Work item |
|---|---|
| 92 | Validate final civil and MEP BOQ against coordinated design |
| 93 | Approve consolidated technical quotation basis, exclusions and margin inputs |
| 94 | Conduct formal CTO-to-COO construction-ready handover |
| 95 | Approve technical closeout, as-built, final-inspection and lessons-learned package |

All 25 rows: role Chief Technical Officer, canonical `role.cto`
(`docs/canonical-role-map.md`). Shared escalation throughout A-F: "The
Architect (Lead) may coordinate routine technical work as deputy, but
reserved approvals, material deviations and commercial commitments
escalate to the CEO with the relevant CXO."

## Disposition

**A (71-73): Configure approval/decision** — each has a named approver
(CTO), a recorded outcome ("approved technical plan, standards, resource
decision") and no further recurring task beyond the decision itself;
matches BRD §6.5's approval/decision definition exactly, consistent with
the expectation in ticket 0007 that CXO-level annual-cycle rows skew away
from plain workflow steps.

**A (74): Periodic review/monitor** — "report workload, KPIs, risks and
corrective actions" is a scheduled review with a measurable output
(the KPI/risk report), not a one-off decision or an actionable task
in itself — different disposition than its siblings for the same reason
ticket 0002 split row 518 from 519-520 (output shape, not role, decides
disposition).

**B-F (75-95, 21 rows): Configure workflow.** This block maps directly
onto BRD §7 module M12 ("Technical Engineering & Design Control": design
brief, survey, discipline deliverables, design basis, codes/criteria,
drawing register, revision control, technical review, coordination,
clash/RFI management, specifications, BOQ validation, IFC release,
authority submissions, as-built closeout) almost clause-for-clause. Unlike
cluster A, every row here produces a record that is a precondition for
the next row/cluster in the same chain (lead → survey → feasibility →
paid activation → kickoff → design QA gates → authority submission →
BOQ/handover/closeout) and the Control/Handoff text names the next
recipient each time (CMO, Finance, Document Control, COO/Projects, Legal)
— the defining trait of a workflow step rather than a standalone decision
or reference record.

## Acceptance
- [x] All 25 CTO rows (#71-95) classified into 6 trigger-clusters with
      per-row disposition split where output shape differs (A74 vs
      A71-73).
- [x] Disposition for B-F justified against the specific BRD §7 module
      (M12) it implements, not asserted generically.
- [ ] Authority/approval-limit values referenced in A72 ("authority
      limits") and the escalation text are still the open decision tracked
      in `docs/PRD.md` §8-9 — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 25 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 25 CTO rows (Technical
  Engineering department) into clusters A-F; this is the first role batch
  of ticket 0007's Technical Engineering pass (CTO done, 7 raw labels /
  171 rows remain in this department).
