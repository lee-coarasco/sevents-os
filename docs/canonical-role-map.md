# Canonical Role Map

Maps the 44 distinct raw "Who is Responsible" labels found in the 1,308-row
source catalogue (`docs/catalogue/source-catalogue.json`, extracted from
`docs/work-item-catalogue.xlsx`) to canonical system roles. Per BRD §6.3:
"Canonical department and role records are separate from raw source labels.
Many raw labels may map to one canonical role." This is that mapping.

**Status:** draft, architect-authored. Role taxonomy/naming is an
architect decision (CLAUDE.md "folder/module structure, naming
conventions" bucket) and does not require owner approval. Authority
limits, approval thresholds and segregation-of-duties rules attached to
these roles are a **separate, still-open** decision — see `docs/PRD.md` §8-9
and BRD §21 item 6. Do not read a row below as granting any approval limit.

## How to read this table

- **Canonical Role ID** — stable identifier for `RoleDefinition` (BRD §6.2).
  Dotted, lowercase, department-scoped where the title alone is ambiguous.
- **BRD §3.1 persona** — which named persona in the BRD this rolls up to,
  if one exists. `(new)` means the catalogue surfaced a role not in BRD
  §3.1's persona list; it is still canonical, just not yet named in the BRD
  narrative. Recommend folding these into a future BRD §3.1 revision rather
  than treating this file as a silent fork of that list.
- **Count** — number of source catalogue rows carrying this raw label.

## Company / Leadership (70 rows, 2 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chairman | `role.chairman` | Chairman/Owners | 20 |
| Chief Executive Officer (CEO) | `role.ceo` | CEO | 50 |

## Technical Engineering (196 rows, 8 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Technical Officer (CTO) | `role.cto` | CTO/Technical Engineering Head | 25 |
| Architect (Lead) | `role.architect_lead` | Architect/Design Engineer/Discipline Lead | 30 |
| Structural Designer | `role.structural_designer` | Architect/Design Engineer/Discipline Lead | 22 |
| Civil Draftsman | `role.civil_draftsman` | Architect/Design Engineer/Discipline Lead (new) | 20 |
| Electrical Draftsman | `role.electrical_draftsman` | Architect/Design Engineer/Discipline Lead (new) | 24 |
| HVAC & Plumbing Draftsman | `role.hvac_plumbing_draftsman` | Architect/Design Engineer/Discipline Lead (new) | 25 |
| Civil Estimator | `role.civil_estimator` | Estimator/Commercial Manager | 25 |
| MEP Estimator | `role.mep_estimator` | Estimator/Commercial Manager | 25 |

## Projects (304 rows, 14 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Operations Officer (COO) | `role.coo` | COO/Operations Head | 25 |
| Project Engineer (Lead) | `role.project_engineer_lead` | Project Manager (new, PM support role) | 35 |
| Quantity Surveyor | `role.quantity_surveyor` | Estimator/Commercial Manager | 28 |
| QHSE Engineer | `role.qhse_engineer` | QA/QC Engineer + Safety Officer (dual-scope, new) | 30 |
| Site Civil Engineer | `role.site_civil_engineer` | Site Manager/Site Engineer | 28 |
| Site MEP Engineer | `role.site_mep_engineer` | Site Manager/Site Engineer | 28 |
| Civil Supervisor | `role.civil_supervisor` | Site Manager/Site Engineer (new, field supervisor) | 20 |
| MEP Supervisor | `role.mep_supervisor` | Site Manager/Site Engineer (new, field supervisor) | 20 |
| Foreman | `role.foreman` | (new) field supervisory, reports to Supervisor | 18 |
| Chargehand | `role.chargehand` | (new) crew-level supervisory, reports to Foreman | 16 |
| Plant & Equipment Operator | `role.plant_equipment_operator` | (new) — see M25 Equipment/Plant/Fleet | 16 |
| Skilled Labour | `role.skilled_labour` | (new) | 14 |
| Driver | `role.driver` | (new) | 14 |
| Unskilled Labour | `role.unskilled_labour` | (new) | 12 |

## Procurement (160 rows, 4 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Procurement Officer (CPO) | `role.cpo` | Department Head (new — not separately named in §3.1) | 30 |
| Procurement Lead | `role.procurement_lead` | Procurement Manager/Buyer | 55 |
| Logistics Coordinator | `role.logistics_coordinator` | Procurement Manager/Buyer (new, logistics sub-role) | 35 |
| Storekeeper | `role.storekeeper` | Storekeeper | 40 |

## Finance (120 rows, 3 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Financial Officer (CFO) | `role.cfo` | CFO/Finance Head | 30 |
| Senior Accountant (Lead) | `role.senior_accountant_lead` | Finance Executive/Accountant | 45 |
| Accountant | `role.accountant` | Finance Executive/Accountant | 45 |

## Marketing & Sales (120 rows, 3 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Marketing Officer (CMO) | `role.cmo` | Department Head (new) | 30 |
| Marketing Manager (Lead) | `role.marketing_manager_lead` | Department Head (new) | 50 |
| Business Development Executive | `role.business_development_executive` | (new — Sales is not a named §3.1 persona; M10 refers to "Sales" generically) | 40 |

## People & Culture (98 rows, 5 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief People & Culture Officer (CPCO) | `role.cpco` | Department Head (new) | 6 |
| HR & Admin Lead | `role.hr_admin_lead` | HR/People & Culture | 27 |
| HR & Admin Assistant | `role.hr_admin_assistant` | HR/People & Culture | 31 |
| Office Assistant | `role.office_assistant` | (new — general admin support) | 21 |
| IT Support Engineer | `role.it_support_engineer` | (new — distinct from Platform Administrator; internal IT, not SEVENTS app config) | 13 |

## Research & Development (120 rows, 2 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Research Officer (CRO) | `role.cro` | Department Head (new) | 60 |
| Document Controller | `role.document_controller` | Document Controller | 60 |

## Legal (120 rows, 3 raw labels)

| Raw label | Canonical Role ID | BRD §3.1 persona | Count |
|---|---|---|---|
| Chief Legal Officer (CLO) | `role.clo` | Legal/Contracts Manager (Head) | 30 |
| Legal Counsel (Lead) | `role.legal_counsel_lead` | Legal/Contracts Manager | 50 |
| Contracts & Legal Assistant | `role.contracts_legal_assistant` | Legal/Contracts Manager (assistant) | 40 |

## Platform-only roles (not in the source catalogue)

These exist in BRD §3.1 but raise no catalogue rows because they are
platform/system roles, not company job titles:

| Canonical Role ID | BRD §3.1 persona |
|---|---|
| `role.platform_administrator` | Platform Administrator |
| `role.vendor_subcontractor_portal` | Vendor/Subcontractor (restricted portal, later phase) |
| `role.client_consultant_portal` | Client/Consultant (restricted portal, later phase) |

## Notes and follow-ups

- **Department Head** is used generically above for several C-level raw
  labels (CPO, CMO, CPCO, CRO) because BRD §3.1 has a generic "Department
  Head" persona but no department-specific C-suite personas beyond
  CEO/COO/CTO/CFO. Each remains its own distinct `RoleDefinition`
  (`role.cpo`, `role.cmo`, etc.) — "Department Head" is the persona-level
  grouping, not a merge.
- **QHSE Engineer** (Projects) spans both the QA/QC Engineer and Safety
  Officer personas. Do not silently split this into two roles without
  owner confirmation — the source catalogue treats it as one job title
  with one incumbent.
- Raw labels marked `(new)` are real job titles in the source catalogue
  that BRD §3.1 does not name. They are still canonical roles for `RoleMapping`
  purposes; this is noted for whoever next revises the BRD narrative, not a
  blocker for Phase 0 ticket work.
- This map covers *roles*, not authority. Approval limits per role are
  tracked as an open decision in `docs/PRD.md` §9 and must not be inferred
  from a role's seniority-sounding title.
