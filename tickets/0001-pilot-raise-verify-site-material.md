---
id: 1
title: "Classify catalogue cluster: raise & verify site material requirement (Projects)"
status: done
roles: [architect]
priority: 1
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for the first step of the pilot flow in
`docs/PRD.md` §1 ("material requirement → ... → site issue"). Covers the
Site Civil Engineer / Site MEP Engineer rows that raise a material
requirement and later verify receipt/consumption against it. Source:
`docs/catalogue/source-catalogue.json` (regenerate with
`scripts/xlsx_to_json.py` if missing).

## Source rows covered

| S.No. | Role | Work item |
|---|---|---|
| 334 | Site Civil Engineer | Raise civil material, plant, tool and specialist-subcontract requirements |
| 343 | Site Civil Engineer | Verify civil materials against approved submittals and storage requirements |
| 348 | Site Civil Engineer | Verify daily civil material consumption, wastage and balance at site |
| 360 | Site MEP Engineer | Confirm MEP shop drawings, material submittals and technical approvals are ready |
| 361 | Site MEP Engineer | Raise MEP material, equipment, tool and specialist-subcontract requirements |
| 362 | Site MEP Engineer | Coordinate MEP specialist subcontractors and vendor technical deliverables |
| 371 | Site MEP Engineer | Verify MEP materials and equipment against approved submittals and storage rules |
| 376 | Site MEP Engineer | Verify daily MEP material use, equipment protection and site allocation |

Two sub-clusters by trigger (raw source text is near-identical within each,
confirming they're one configured capability, not 8 separate ones):

**A. Raise requirement** (334, 360-362): trigger = "an approved civil/MEP
activity enters the daily or lookahead plan"; output = work plan / resource
request; escalation = technical ambiguity → CTO, resource conflict →
Project Engineer.

**B. Verify receipt & consumption** (343, 348, 371, 376): trigger =
"material arrives or work reaches inspection/concealment/resource-control
point"; output = approved material evidence, WIR/RFI/NCR closure or
reconciled consumption record; control = no work concealed without
inspection, nonconforming material quarantined.

Canonical roles: `role.site_civil_engineer`, `role.site_mep_engineer`
(`docs/canonical-role-map.md`).

## Disposition

Both sub-clusters: **Configure workflow** (BRD §6.5) — recurring actionable
work fitting a supported capability (step types 2-5 in Implementation Plan
§5: create task, assign to role, collect form fields, request evidence).

## Acceptance
- [x] Rows identified and grouped by shared trigger/output pattern.
- [x] Disposition set to "Configure workflow" for both sub-clusters.
- [x] Mapped to canonical roles in `docs/canonical-role-map.md`.
- [ ] Capability/step mapping confirmed against the Phase 2 workflow engine
      once it exists (cannot be "published" before Phase 2 is built).
- [ ] SLA/timing: source `Timing` field is "To be confirmed" for every row
      above — stays `TBD` per BRD §6.4; do not invent a value.
- [ ] Process owner (who signs off this capability as correctly classified)
      confirmed — currently unassigned.

## Progress
- 2026-10-14: Architect session. Classified sub-clusters A and B above from
  the source catalogue, confirmed against `docs/PRD.md` §1.2 traceability
  table. SLA and process-owner confirmation remain open — not a blocker for
  Phase 0 documentation, but must resolve before this capability can be
  simulated/published in Phase 2.
