---
id: 109
title: Ticket B — Build frontend for M11 and M13 (zero UI currently)
status: testing
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
- 2026-10-16 22:25 UTC: Built both modules' frontend.
  - Added `GET /workflow/definitions/published` (backend, permission-light)
    so non-admin actors can pick a `definitionId` for submit-for-approval —
    see DECISIONS.md for why the existing endpoint couldn't be reused.
  - M11: `OpportunityDetailPage` (`/crm/opportunities/:id`, site visits +
    tender submissions tabs), `TenderSubmissionDetailPage`
    (`/tendering/tender-submissions/:id`, Tender Documents / Estimates /
    Bid-No-Bid tabs covering all of tendering+estimating+bidding).
  - M13: `DocumentsPage` (`/documents`, nav entry "Documents & Drawings")
    and `DocumentDetailPage` (`/documents/:id`) — register list/create,
    revisions list/create, submit-for-IFC-release, supersede.
  - Linked opportunity cards (CrmPage) and document rows to their detail
    pages; documents link to their project.
  - Followed the established inline-`has()`/native-input convention (no
    `<PermissionGate>`/`<EntityPicker>` yet — that's ticket 0123, filed
    before this one, covering the whole app).
  - Two scope gaps found during build, each with a reasoning note in
    DECISIONS.md: estimate/document top-level field editing has no UI
    (only create + line-item add/remove) — filed as ticket 0124; the
    estimate/line fields and the "Supersede" action's exact backend
    semantics didn't match the ticket's prose exactly, so the UI follows
    the real API shape instead (documented in DECISIONS.md and
    USER-GUIDE.md).
  - All backend (594) and frontend (54) tests pass; `tsc --noEmit` and
    `vite build` clean on both sides. Not yet owner-verified in a running
    app — set to `testing`.
