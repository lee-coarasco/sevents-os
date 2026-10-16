---
id: 118
title: M11 and M13: build all frontend screen
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-17
updated: 2026-10-17
---

M11 (Tendering, Estimation & Commercials) and M13 (Documents, Drawings &
Records) have fully built backends with zero frontend screens. Both are Phase 4
modules.

## Dependencies
- Ticket 0108 (M33) — cost-code picker and document-type picker needed
- Ticket 0109 (shared components) — PermissionGate, UserPicker, FileAttachment,
  CurrencyInput, ActivityThread, StatusBadge

## Scope

### M11 — Tendering & Estimating

**Route:** `/tendering` — sub-sections within an opportunity detail, or
standalone nav entry for roles that hold `tendering.document.manage`

**Tender Documents tab** (within Opportunity detail or standalone list):
- List: document title, type, uploaded by, date; filter by opportunity
- "Add document" form: title, document type (free-text for now, M33
  document-type picker once ticket 0108 is done), storage reference field,
  `<FileAttachment>` component
- Edit and delete (if no downstream bid submission references it)

**Estimates tab** (within Opportunity detail):
- List of estimate versions: version label, status badge, total value
  (sum of lines), submitted by, submitted at
- "New estimate" form: version label, scope summary
- Estimate detail:
  - Estimate lines sub-table: description, UoM picker (from M33), quantity,
    unit cost (`<CurrencyInput>`), markup %, line total (computed);
    add/edit/delete lines
  - Totals panel: subtotal, markup total, grand total
  - "Submit for approval" button (only shown when status is `draft` or
    `returned_for_correction`) → calls submit endpoint; sets status to
    `under_review`
  - Status badge and `<ActivityThread>` showing approval decisions

**Bid / No-Bid Decisions tab** (within Opportunity detail):
- Show the single bid/no-bid decision record if it exists (recommendation,
  final decision, decided by, decided at)
- "Record decision" form: recommendation (proceed / no-bid), rationale,
  criteria scores (for each criterion: name + score), final decision,
  decided-by UserPicker
- Decision is locked once recorded (no edit — same immutability as approvals)

**Bid Submissions tab** (within Opportunity detail):
- List: bid reference, submitted date, submitted price (`<CurrencyDisplay>`),
  status
- "Add submission" form: bid reference, submitted date, submitted price
  (`<CurrencyInput>`), notes

### M13 — Documents & Drawings Register

**Route:** `/documents` — top-level nav entry (visible to all authenticated
users for read; write gated on `documents.register.manage`)

**Document Register list page** (`/documents`):
- Table: document number, title, type (from M33 picker when available),
  project (linked), discipline, current revision code, current revision status
  badge, originator
- Filters: document type, project, discipline, status, keyword
- "New Document" button → create form

**Create/edit document form:**
- Title, document number (manual or auto from M33 numbering scheme),
  document type picker (M33), project picker (`<EntityPicker type="project">`),
  discipline (free text), access class (free text), tags, originator UserPicker

**Document detail page** (`/documents/:id`):
- Metadata panel (all fields, edit button gated on permission)
- Revisions list: revision code, status badge, reviewer, approver,
  created by, created at; "Add revision" button

**Add revision form:**
- Revision code (free text), storage reference, `<FileAttachment>`,
  reviewer UserPicker

**Revision actions (on each revision row):**
- "Submit for IFC release" — only if revision status is `approved`;
  calls `POST /documents/:docId/revisions/:revId/submit-for-release`
  (M13b — requires ticket 0108's M33 to exist before this is available,
  but wire the button now and disable it if M13b backend not ready)
- "Supersede" — marks this revision superseded; confirms the new
  `superseded_by_revision_id`

**`<ActivityThread>`** at the bottom of document detail — shows revision
events (created, submitted, approved, superseded).

## Acceptance

- [ ] M11: Tender documents, estimate versions (with lines), bid/no-bid
      decision, and bid submission screens all load and save correctly
- [ ] M11: Estimate line totals compute correctly in the UI (no server round-
      trip needed for display)
- [ ] M11: "Submit for approval" transitions estimate status and shows the
      approval chain in ActivityThread
- [ ] M13: Document register list with filters, create form, detail page all
      work end-to-end
- [ ] M13: Add revision, file attachment, submit-for-IFC, and supersede
      actions all work
- [ ] All write buttons wrapped in PermissionGate
- [ ] No raw UUIDs — all references use pickers
- [ ] USER-GUIDE.md entries for M11 and M13 updated
tickets/0113-m35-audit-ui.md
---
id: 113
title: "M35: Audit log, data requests, and retention management UI"
status: next
roles: [ui-designer, test-engineer]
priority: 2
created: 2026-10-16
updated: 2026-10-16
---

M35 backend is fully built across three sub-tickets (audit log, retention/legal
hold, data export/deletion). Zero frontend exists for any of it.

## Dependencies
- Ticket 0109 (shared components) — PermissionGate, UserPicker, DatePicker,
  StatusBadge

## Scope

**Route:** `/audit` — nav entry visible only to `role.platform_administrator`
and roles with `audit.log.view`

### Audit Log tab
- Table: timestamp, user (name + email), action type, entity type, entity ID,
  summary; newest first
- Filters: user picker, entity type dropdown, date range (DatePicker), action
  keyword
- Row click → slide-over with full event payload (formatted JSON)
- Export to CSV button (client-side: export what's currently filtered)

### Retention Policies tab
- List: entity type, retention period, created by, is_active
- "New policy" form: entity type (free text), retention period (number + unit:
  days/months/years), reason
- Edit and deactivate (soft-delete)

### Legal Holds tab
- List: entity type, entity ID, placed by, placed at, released at (blank if
  active), reason
- "Place hold" form: entity type, entity ID, reason
- "Release hold" button on active rows

### Data Requests tab
- List: requester (UserPicker display), request type (export/deletion), status
  badge, requested at, completed at
- "New request" form: requester UserPicker, type selector (export / deletion),
  reason
- Row click → detail: show linked workflow instance status (the approval chain
  that gates execution), and "Download export" link once the export is ready

## Acceptance

- [ ] Audit log table loads real events from `GET /audit/log` with all filters
      working
- [ ] Retention policy create, list, deactivate all work
- [ ] Legal hold place and release all work
- [ ] Data request create, list, and detail (with workflow instance status) all
      work
- [ ] All write buttons wrapped in PermissionGate (`audit.log.view` for reads,
      `master-data.manage` class permissions for writes)
- [ ] USER-GUIDE.md M35 entry updated

_Created by lee-coarasco in the AppYard dashboard._

## Progress
