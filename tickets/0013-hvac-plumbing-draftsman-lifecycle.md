---
id: 13
title: "Classify catalogue cluster: HVAC & Plumbing Draftsman design lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 25 Technical Engineering rows
carrying "HVAC & Plumbing Draftsman" as `Who is Responsible` (#168-192).
Sixth batch of ticket 0007's Technical Engineering pass — same pipeline
shape as Civil Draftsman (0011) and Electrical Draftsman (0012), for the
HVAC/plumbing discipline. This completes the three "Draftsman" roles.

## Source rows covered

**A. MEP basis and inputs** — trigger: "the approved brief and available
utility/site information are received."

| S.No. | Work item |
|---|---|
| 168 | Receive approved architectural brief and MEP scope |
| 169 | Survey existing HVAC, plumbing and drainage services where applicable |
| 170 | Establish HVAC and plumbing design criteria, assumptions and authority requirements |
| 171 | Identify missing utility data, tests, capacities and specialist inputs |

**B. HVAC design** — trigger: "the MEP basis, architectural spaces and
performance requirements are approved."

| S.No. | Work item |
|---|---|
| 172 | Prepare cooling-load and ventilation calculations |
| 173 | Select preliminary HVAC systems and equipment capacities |
| 174 | Prepare HVAC zoning, ductwork and air-distribution layouts |
| 175 | Prepare refrigerant, chilled-water or condensate piping layouts where applicable |
| 176 | Size ducts, pipes and major HVAC components |
| 177 | Prepare HVAC schematics, details and equipment schedules |
| 178 | Coordinate ventilation, exhaust and fresh-air requirements |

**C. Plumbing/drainage design** — trigger: "water, drainage, fixture and
architectural information is available."

| S.No. | Work item |
|---|---|
| 179 | Prepare water-demand and storage calculations |
| 180 | Prepare domestic water-supply layouts and schematics |
| 181 | Prepare soil, waste and vent drainage layouts |
| 182 | Prepare storm-water drainage layouts where applicable |
| 183 | Prepare pump, tank, heater and plumbing-equipment schedules |
| 184 | Size plumbing pipes, drainage and water-service components |
| 185 | Prepare plumbing risers, details and fixture schedules |

**D. Coordination and authority/IFC release** — trigger: "HVAC/plumbing
design reaches coordination, authority or IFC milestone."

| S.No. | Work item |
|---|---|
| 186 | Coordinate HVAC and plumbing plant spaces, routes, ceilings and access |
| 187 | Coordinate MEP openings, sleeves and builders-work requirements |
| 188 | Prepare HVAC and plumbing authority submission and comment responses |
| 189 | Release checked HVAC and plumbing IFC package and revision index |

**E. Site support, testing and closeout** — trigger: "a site RFI,
submittal, inspection, testing or closeout request is received."

| S.No. | Work item |
|---|---|
| 190 | Respond to HVAC and plumbing RFIs and review technical submittals |
| 191 | Support HVAC and plumbing testing, commissioning and inspection requirements |
| 192 | Review HVAC and plumbing as-built drawings and close technical actions |

All 25 rows: canonical `role.hvac_plumbing_draftsman`
(`docs/canonical-role-map.md`, `(new)`). Shared escalation: "A nominated
competent MEP resource provides backup; unresolved performance, authority
or coordination risk escalates to CTO."

## Disposition

**All 25 rows (A-E): Configure workflow.** Identical shape to tickets
0011-0012: inputs → discipline design (split here into HVAC vs. plumbing
sub-chains, B and C, because the source text itself separates them by a
different trigger sentence) → coordination/authority release → site
support/closeout. BRD §7 module M12. No standalone decision rows; no
split disposition needed within a cluster.

## Acceptance
- [x] All 25 HVAC & Plumbing Draftsman rows (#168-192) classified into 5
      trigger-clusters (B/C split by the source's own distinct trigger
      text for HVAC vs. plumbing, not an invented split).
- [x] Confirms the "Draftsman" role family (Civil/Electrical/HVAC&
      Plumbing, tickets 0011-0013) is now fully classified with one
      consistent pipeline pattern across all three disciplines.
- [ ] SLA: source `Timing` is "To be confirmed" for all 25 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 25 HVAC & Plumbing
  Draftsman rows; sixth role batch of ticket 0007's Technical Engineering
  pass. 6 roles done; 2 raw labels / 50 rows remain in this department
  (Civil Estimator, MEP Estimator).
