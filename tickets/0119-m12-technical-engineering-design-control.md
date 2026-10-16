---
id: 119
title: M12: Technical Engineering & Design Control
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

M12 has never been started. It depends on M09 (projects) and M13 (documents).
Both are now backend-complete. The BRD build order places M12 after M13.

## What the PRD says M12 builds
"Design brief, drawing register, revision control, RFI, IFC release,
as-built closeout"

Note: drawing register and revision control already exist in M13. M12 extends
M13 for the engineering-specific case and adds the RFI, design brief, and
as-built flows.

## Scope (architect to refine into sub-tickets)

**M12a — Design briefs**
- `design_briefs` table: project_id, discipline, scope description, reference
  documents (array of document_ids from M13), status
  (draft/issued/superseded), issued_by, issued_at
- Full CRUD API + frontend screens within project detail

**M12b — RFI (Request for Information)**
- `rfis` table: project_id, rfi_number (from M33 numbering scheme),
  raised_by, addressed_to (can be a contact from M10 CRM),
  subject, description, date_raised, date_required, date_responded,
  response, status (open/responded/closed/cancelled)
- Referenced document_ids (links to M13 documents)
- Full CRUD API + frontend: RFI list per project, create, respond, close

**M12c — IFC (Issued for Construction) release workflow**
- An IFC release is an M13 document revision with `document_type = "DRG"`
  that goes through a structured approval chain before construction use
- Build on M13b's `submit_for_release` endpoint (ticket 0105): wire an
  engineering-specific approval workflow definition (created via M06
  Config Studio) as the default IFC workflow for drawing-type documents
- IFC release register: per-project list of drawings with their current
  revision and IFC status
- Frontend: IFC register page within project detail

**M12d — As-built closeout**
- `as_built_records` table: project_id, document_id (M13), original_revision,
  as_built_revision, confirmed_by, confirmed_at, notes
- Marks a drawing as "as-built" at project closeout
- Frontend: as-built checklist within the M09 project closeout section

## Acceptance (architect defines sub-ticket-level criteria)

- [ ] Architect has surveyed M13 schema and confirmed no duplication before
      building M12a–M12d
- [ ] All four sub-areas have backend + frontend
- [ ] RFI numbering uses M33 numbering scheme
- [ ] IFC release wires to M13b's submit-for-release endpoint, not a parallel
      mechanism
- [ ] All screens follow Definition of Done checklist in CLAUDE.md
- [ ] USER-GUIDE.md M12 entry written

_Created by lee-coarasco in the AppYard dashboard._

## Progress
