---
id: 11
title: "Classify catalogue cluster: Civil Draftsman drawing-production lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 20 Technical Engineering rows
carrying "Civil Draftsman" as `Who is Responsible` (#126-145). Fourth
batch of ticket 0007's Technical Engineering pass — this role executes
the drawing-production work that the Architect (Lead, ticket 0009) and
Structural Designer (ticket 0010) direct/check.

## Source rows covered

**A. Drafting setup** — trigger: "an approved drafting instruction or
project setup requirement is issued."

| S.No. | Work item |
|---|---|
| 126 | Receive approved architectural inputs, mark-ups and drawing instructions |
| 127 | Set up project CAD files, coordinates, layers, title blocks and drawing standards |
| 128 | Maintain approved drawing templates, symbols and standard details |

**B. Drawing production** — trigger: "approved survey, concept or
detailed-design information is released for drafting."

| S.No. | Work item |
|---|---|
| 129 | Prepare existing-condition and measured-survey drawings |
| 130 | Prepare location, site and setting-out drawings |
| 131 | Prepare architectural floor plans |
| 132 | Prepare architectural elevations and sections |
| 133 | Prepare enlarged plans and construction details |
| 134 | Prepare door, window, finish and room schedules |
| 135 | Prepare external works and civil interface drawings |
| 136 | Prepare presentation and authority drawing sheets |

**C. Overlay/coordination** — trigger: "new structural/MEP backgrounds
or approved review comments are received."

| S.No. | Work item |
|---|---|
| 137 | Overlay and coordinate structural drawing backgrounds |
| 138 | Overlay and coordinate MEP routes, openings and builders-work information |
| 139 | Incorporate approved design-review and clash-resolution comments |

**D. Controlled issue** — trigger: "a drawing reaches review, authority,
tender or IFC issue status."

| S.No. | Work item |
|---|---|
| 140 | Prepare IFC drawing sheets from approved design information |
| 141 | Maintain drawing numbers, revisions, status and issue purpose |
| 142 | Issue corrected drawings for Architect and CTO checking |
| 143 | Update drawing register and transmit approved files to Document Control |

**E. As-built and archive** — trigger: "verified red-lines or
technical-closeout inputs are received."

| S.No. | Work item |
|---|---|
| 144 | Prepare architectural and civil as-built drawings from verified red-lines |
| 145 | Archive controlled editable files, references and superseded drawing history |

All 20 rows: canonical `role.civil_draftsman`
(`docs/canonical-role-map.md`, marked `(new)` — not a named BRD §3.1
persona). Shared escalation throughout A-E: "A nominated competent
drafting resource provides backup; no drawing is issued without
Architect/CTO check and controlled Document Control release" — this role
never self-authorises an issue, consistent with being execution-level
under Architect (Lead)/CTO sign-off.

## Disposition

**All 20 rows (A-E): Configure workflow.** Same shape as tickets
0009-0010: each cluster output feeds the next (setup → production →
coordination overlay → controlled issue → as-built/archive), each
Control/Handoff names a concrete recipient (Architect, CTO, Document
Control, Projects), and no row is a standalone decision — final
authorisation always sits one level up (Architect/CTO), matching BRD §7
module M12/M13 (drawing register, revision control, transmittals).

## Acceptance
- [x] All 20 Civil Draftsman rows (#126-145) classified into 5
      trigger-clusters, consistent with the Architect (Lead)/Structural
      Designer pipeline shape already established (tickets 0009-0010).
- [ ] SLA: source `Timing` is "To be confirmed" for all 20 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 20 Civil Draftsman rows;
  fourth role batch of ticket 0007's Technical Engineering pass. 4 roles
  done (CTO, Architect (Lead), Structural Designer, Civil Draftsman); 4
  raw labels / 99 rows remain in this department (Electrical Draftsman,
  HVAC & Plumbing Draftsman, Civil Estimator, MEP Estimator).
