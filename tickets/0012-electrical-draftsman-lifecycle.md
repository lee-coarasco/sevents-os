---
id: 12
title: "Classify catalogue cluster: Electrical Draftsman design lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 24 Technical Engineering rows
carrying "Electrical Draftsman" as `Who is Responsible` (#193-216). Fifth
batch of ticket 0007's Technical Engineering pass — same pipeline shape
as the Civil Draftsman (ticket 0011), for the electrical discipline, with
an added safety/life-safety escalation tier HVAC/Plumbing (ticket 0013,
not yet written) will likely mirror.

## Source rows covered

**A. Electrical basis and inputs** — trigger: "the approved brief and
available electrical/utility information are received."

| S.No. | Work item |
|---|---|
| 193 | Receive approved architectural brief and electrical scope |
| 194 | Survey existing electrical and ELV services where applicable |
| 195 | Establish electrical design criteria, assumptions and authority requirements |
| 196 | Identify missing utility data, loads and specialist-system inputs |

**B. Power/distribution design** — trigger: "approved loads, spaces and
equipment requirements are available."

| S.No. | Work item |
|---|---|
| 197 | Prepare connected-load, demand and diversity assessment |
| 198 | Prepare power-distribution concept and single-line diagrams |
| 199 | Prepare MDB, SMDB and DB schedules |
| 200 | Prepare power, socket and equipment-connection layouts |
| 201 | Prepare cable, containment and routing requirements |
| 202 | Prepare earthing, bonding and lightning-protection layouts where applicable |

**C. Lighting/ELV/life-safety systems** — trigger: "architectural layouts
and approved system scope are available."

| S.No. | Work item |
|---|---|
| 203 | Prepare lighting layouts and control-zone requirements |
| 204 | Prepare emergency and exit-lighting layouts |
| 205 | Prepare fire-alarm layouts and interfaces where within approved scope |
| 206 | Prepare data, telephone, CCTV and access-control layouts where within approved scope |
| 207 | Prepare ELV schematics, schedules and equipment requirements |
| 208 | Coordinate generator, UPS and specialist-power systems where applicable |

**D. Coordination and authority/IFC release** — trigger: "electrical
design reaches coordination, authority or IFC milestone."

| S.No. | Work item |
|---|---|
| 209 | Coordinate electrical containment, ceiling and MEP interfaces |
| 210 | Coordinate builders-work openings, equipment loads and plant connections |
| 211 | Prepare electrical authority calculations, forms and submission drawings |
| 212 | Respond to authority and interdisciplinary review comments |
| 213 | Release checked electrical and ELV IFC package and revision index |

**E. Site support, testing and closeout** — trigger: "an electrical RFI,
submittal, inspection, testing or closeout request is received."

| S.No. | Work item |
|---|---|
| 214 | Respond to electrical RFIs and review technical submittals |
| 215 | Support electrical testing, commissioning and inspection requirements |
| 216 | Review electrical and ELV as-built drawings and close technical actions |

All 24 rows: canonical `role.electrical_draftsman`
(`docs/canonical-role-map.md`, `(new)`). Shared escalation: "A nominated
competent electrical resource provides backup; safety, supply-capacity,
authority or life-safety risk immediately escalates to CTO" — note C
explicitly scopes several systems "where within approved competence/
scope," meaning the workflow configuration must gate fire-alarm/access-
control/CCTV design steps on a competence/certification check, not just
a role check (flagged for `BUILDING` phase, not resolved here).

## Disposition

**All 24 rows (A-E): Configure workflow.** Same shape as tickets
0009-0011: inputs → load/distribution design → system-specific layouts →
coordination/authority release → site support/closeout, each with a
named downstream recipient (Architect/MEP, CTO, Document Control). BRD §7
module M12. No standalone decision rows.

## Acceptance
- [x] All 24 Electrical Draftsman rows (#193-216) classified into 5
      trigger-clusters, consistent with the established discipline
      pipeline shape (tickets 0009-0011).
- [x] Flagged the competence/scope-gating requirement in cluster C for
      later workflow-engine configuration (life-safety systems need a
      certification check, not just a role check) — not resolved now, no
      competency-matrix values exist yet.
- [ ] SLA: source `Timing` is "To be confirmed" for all 24 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 24 Electrical Draftsman
  rows; fifth role batch of ticket 0007's Technical Engineering pass. 5
  roles done; 3 raw labels / 75 rows remain in this department (HVAC &
  Plumbing Draftsman, Civil Estimator, MEP Estimator).
