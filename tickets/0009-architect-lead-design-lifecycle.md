---
id: 9
title: "Classify catalogue cluster: Architect (Lead) design lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 30 Technical Engineering rows
carrying "Architect (Lead)" as `Who is Responsible` (#96-125). Second
batch of ticket 0007's Technical Engineering pass; this role executes the
discipline-level steps that ticket 0008's CTO cluster B-F approves/
coordinates at a higher level.

## Source rows covered

**A. Brief, survey and design inputs** — trigger: "the Architect receives
an accepted technical lead or approved design instruction."

| S.No. | Work item |
|---|---|
| 96 | Receive and validate client brief, lead record and technical handover |
| 97 | Plan architectural site survey, measurement and information requirements |
| 98 | Record site conditions, photographs, dimensions, constraints and interfaces |
| 99 | Prepare controlled architectural design brief, assumptions and exclusions |
| 100 | Identify planning, access, authority and project-specific design constraints |

**B. Concept development** — trigger: "verified survey and client
requirements are available for concept development."

| S.No. | Work item |
|---|---|
| 101 | Develop preliminary site planning and space programme |
| 102 | Prepare alternative architectural concept options |
| 103 | Prepare concept drawings, massing and material intent |
| 104 | Present concept and feasibility basis to client and internal reviewers |
| 105 | Record client comments, design decisions and concept-freeze status |

**C. Coordinated detailed design** — trigger: "concept freeze and design
activation are approved."

| S.No. | Work item |
|---|---|
| 106 | Prepare coordinated architectural plans, elevations and sections |
| 107 | Develop architectural details, schedules and specification requirements |
| 108 | Coordinate finishes, materials, colours and sample requirements |
| 109 | Coordinate accessibility, fire-life-safety and planning design requirements |
| 110 | Review constructability, tolerances, waterproofing and buildability interfaces |
| 111 | Maintain area schedules, room data and design deliverable registers |
| 112 | Monitor architectural programme, deliverable status and overdue actions |

**D. Multidisciplinary coordination and clash closure** — trigger:
"architectural, structural and MEP information reaches a coordination
milestone."

| S.No. | Work item |
|---|---|
| 113 | Coordinate architectural design with structural requirements |
| 114 | Coordinate architectural design with HVAC, plumbing and electrical routes |
| 115 | Coordinate openings, builders work, plant spaces and ceiling interfaces |
| 116 | Lead clash review, design-comment allocation and closure |
| 117 | Review specialist-consultant and vendor design interfaces |

**E. Authority submission and comment closure** — trigger: "an
architectural authority/NOC submission or comment response becomes due."

| S.No. | Work item |
|---|---|
| 118 | Compile architectural authority and NOC submission package |
| 119 | Respond to architectural authority comments and resubmission requirements |
| 120 | Close authority comments and update the approved architectural design basis |

**F. Construction issue, site support and closeout** — trigger:
"architectural design is ready for construction issue, site support or
closeout."

| S.No. | Work item |
|---|---|
| 121 | Perform final architectural IFC completeness and coordination check |
| 122 | Issue controlled architectural package and revision index to Document Control |
| 123 | Conduct architectural technical handover to Projects |
| 124 | Respond to site RFIs and review architectural shop drawings and material submittals |
| 125 | Review architectural as-built records, close design punch items and capture lessons learned |

All 30 rows: canonical `role.architect_lead` (`docs/canonical-role-map.md`).
Shared escalation throughout A-F: "A nominated qualified discipline lead
may coordinate routine actions; unresolved client, authority, scope,
interface or programme risk escalates to CTO."

## Disposition

**All 30 rows (A-F): Configure workflow.** Unlike ticket 0008's CTO
cluster A (annual strategy, no onward task), every row here produces a
record that is an explicit precondition for the next cluster in the same
chain — brief/survey (A) feeds concept (B), concept-freeze (B) feeds
coordinated design (C), coordinated design feeds clash/coordination (D),
which feeds authority submission (E), which feeds construction
issue/closeout (F) — and each cluster's Control/Handoff text names a
concrete recipient (CTO, Document Control, Projects) rather than simply
recording a decision. This is BRD §7 module M12's design-control pipeline
executed at discipline level; no row is a standalone decision or
reference record, so no split disposition was needed within this role
(contrast ticket 0008, where A74 split from A71-73 by output shape).

## Acceptance
- [x] All 30 Architect (Lead) rows (#96-125) classified into 6
      trigger-clusters, chained A→F against ticket 0008's CTO-level
      clusters B-F to confirm the discipline/approval split is consistent
      (Architect executes, CTO approves/escalates).
- [x] Confirmed no row needed a split disposition within this role (unlike
      ticket 0008) and said why.
- [ ] SLA: source `Timing` is "To be confirmed" for all 30 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 30 Architect (Lead) rows;
  second role batch of ticket 0007's Technical Engineering pass (CTO and
  Architect (Lead) done, 6 raw labels / 141 rows remain in this
  department).
