---
id: 109
title: Ticket B — Build frontend for M11 and M13 (zero UI currently)
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

M11 — Tendering & Estimating

Tender Documents tab (within a tender/opportunity detail):

List of uploaded documents with type, title, storage reference, uploaded-by, date.
Upload form (title, document type, storage reference — no actual file upload, just the reference field per migration design).

Estimates tab:

List of estimate versions with status badge (draft / submitted / approved / rejected).
Create estimate form (version label, scope summary).
Estimate lines sub-table: add/edit/delete lines (description, qty, unit, unit cost, markup %).
Submit for approval button → triggers approval workflow.

Bid / No-Bid Decisions tab:

Decision record: show recommendation + final decision + scores for each criterion.
Create decision form (pick criteria from the bid_no_bid_criteria_scores rows).

Bid Submissions tab:

List of submissions (bid reference, submitted date, submitted price).
Create submission form.
M13 — Documents & Drawings Register

Document Register page (top-level nav entry):

List of documents filterable by type, project, discipline, status of current revision.
Create document form (title, document number, type, project picker, discipline, access class).

Document detail page:

Metadata panel.
Revisions list: revision code, status badge, reviewer, approver, created-by, created-at.
Add revision form (revision code, storage reference, reviewer picker).
Submit for IFC Release button (only visible when revision is approved) → triggers approval workflow and sets workflow_instance_id.
Supersede button on older revisions (sets superseded_by_revision_id).

Acceptance:

 M11: tender documents, estimates (with lines), bid/no-bid, and bid submission screens all load and save without console errors.
 M13: document register list, create, and detail pages work; revision create and supersede actions work.
 All new pages follow the design system (Syne headings, Inter body, bg-brand CT

_Created by lee-coarasco in the AppYard dashboard._

## Progress
