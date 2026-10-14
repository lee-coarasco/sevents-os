---
id: 10
title: "Classify catalogue cluster: Structural Designer design lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 22 Technical Engineering rows
carrying "Structural Designer" as `Who is Responsible` (#146-167). Third
batch of ticket 0007's Technical Engineering pass — the same discipline
pipeline shape as ticket 0009 (Architect (Lead)), run for the structural
discipline.

## Source rows covered

**A. Structural basis and inputs** — trigger: "architectural/site
information is available for structural definition."

| S.No. | Work item |
|---|---|
| 146 | Review architectural brief, site survey and available geotechnical information |
| 147 | Establish structural design criteria, codes, loads and assumptions |
| 148 | Develop preliminary structural system and framing options |
| 149 | Identify required tests, investigations and missing structural inputs |

**B. Structural analysis and element design** — trigger: "the structural
basis and required inputs are approved."

| S.No. | Work item |
|---|---|
| 150 | Prepare structural analysis model and calculation basis |
| 151 | Design foundations and substructure elements |
| 152 | Design slabs, beams, columns and load-bearing elements |
| 153 | Design structural steel or specialist structural elements where applicable |
| 154 | Design retaining walls, tanks and external structural elements where applicable |
| 155 | Prepare reinforcement, structural details and connection requirements |
| 156 | Prepare structural member, reinforcement and design schedules |
| 157 | Maintain controlled structural calculations and design-check records |

**C. Coordination and independent check** — trigger: "structural design
reaches a coordination or checking milestone."

| S.No. | Work item |
|---|---|
| 158 | Coordinate structural grids, levels and geometry with Architecture |
| 159 | Coordinate structural openings, sleeves, plant loads and MEP requirements |
| 160 | Review structural constructability, sequence and temporary-condition risks |
| 161 | Complete independent structural check and close review comments |

**D. Authority/IFC release** — trigger: "structural design is ready for
authority or construction release."

| S.No. | Work item |
|---|---|
| 162 | Prepare structural authority submission drawings and calculations |
| 163 | Respond to structural authority comments and revise controlled design |
| 164 | Release checked structural IFC package with calculation and revision evidence |

**E. Site support and closeout** — trigger: "a structural RFI, submittal,
inspection, variation or closeout requirement is received."

| S.No. | Work item |
|---|---|
| 165 | Respond to structural RFIs, design clarifications and approved variations |
| 166 | Review structural shop drawings, material submittals and critical work inspections |
| 167 | Review structural as-built information and close outstanding technical actions |

All 22 rows: canonical `role.structural_designer`
(`docs/canonical-role-map.md`). Shared escalation throughout A-E: "A
qualified structural reviewer provides backup; any stability, safety or
compliance concern immediately escalates to CTO and affected site work
remains on hold" — notably stricter than Architect's escalation text
(ticket 0009): structural risk halts site work, not just a CTO
notification.

## Disposition

**All 22 rows (A-E): Configure workflow.** Same reasoning as ticket
0009 — each cluster's output is a named precondition for the next
(structural basis → analysis/design → coordination/independent check →
authority/IFC release → site support/closeout), each Control/Handoff
names a concrete recipient (CTO, Document Control, Project Engineer), and
none of the 22 rows is a standalone decision or reference record. Also
part of BRD §7 module M12.

One point not to lose: row 161 ("complete independent structural check")
is a *mandatory segregation-of-duties control* (an independent checker,
not the original designer, per standard structural-engineering practice)
embedded inside a workflow step — flagged here so the eventual workflow
configuration doesn't let the same user who designed an element also be
the one who closes its independent-check step. This is a configuration
detail for `BUILDING` phase, not a new disposition category.

## Acceptance
- [x] All 22 Structural Designer rows (#146-167) classified into 5
      trigger-clusters, matched against ticket 0009's Architect (Lead)
      pipeline shape.
- [x] Flagged the row-161 independent-check segregation-of-duties
      requirement for later workflow-engine configuration (not resolved
      now — no authority-matrix values exist yet, same open item as
      tickets 0008/0009).
- [ ] SLA: source `Timing` is "To be confirmed" for all 22 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 22 Structural Designer
  rows; third role batch of ticket 0007's Technical Engineering pass (CTO,
  Architect (Lead), Structural Designer done — 5 raw labels / 119 rows
  remain in this department: Civil/Electrical/HVAC&Plumbing Draftsman,
  Civil/MEP Estimator).
