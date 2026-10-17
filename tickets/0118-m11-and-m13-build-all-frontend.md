---
id: 118
title: M11 and M13: build all frontend screen
status: testing
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

## Progress
- 2026-10-17: Found this file corrupted on read — it contained a second,
  complete ticket body (a "M35: Audit log, data requests, and retention
  management UI" ticket, itself claiming `id: 113`) appended after this
  ticket's own Acceptance section, inside a second `---`-delimited
  frontmatter block. `id: 113` is already taken by
  `tickets/0113-global-search.md`, and the M35 audit-UI work it described
  is already fully built by tickets 0136/0137/0138 (split from 0112, see
  DECISIONS.md 2026-10-17 02:40 UTC). This looks like an AppYard dashboard
  write bug from when ticket 118 was filed, not anything this session
  did. `scripts/tickets.py check` didn't catch it because the parser only
  reads the first frontmatter block in a file; everything after is
  treated as body text, so the embedded duplicate id was invisible to the
  duplicate-id check. Stripped the stray embedded ticket out — no code
  was ever built against it, and its content is redundant with 0136-0138.
  Not yet started on 0118's own M11/M13 frontend scope.
- 2026-10-17: Built all M11 and M13 frontend screens. Full changes:
  - TenderSubmissionDetailPage rewritten: PermissionGate on all write
    buttons, StatusBadge on estimates and bid/no-bid decisions,
    FileAttachment for tender document uploads (real file, not a text
    ref), CurrencyInput for estimate line rates, CurrencyDisplay for
    all monetary totals (base currency fetched from
    /master-data/currencies), EntityPicker(uom) for line unit.
    ActivityThread shown when estimate has a workflow_instance_id and
    comments/decisions are available.
  - DocumentsPage enhanced: title keyword search (debounced 300 ms),
    EntityPicker(project) in filter bar, EntityPicker(document-type)
    and EntityPicker(project) in create form, PermissionGate on New
    Document button.
  - DocumentDetailPage enhanced: FileAttachment + AttachmentLink on
    add-revision form, StatusBadge on revision status pills, PermissionGate
    on submit/supersede/check-approval actions. ActivityThread not
    applicable (no comments endpoint on documents).
  - CurrencyInput/CurrencyDisplay components built (ticket 0134).
  - USER-GUIDE.md M11 and M13 sections updated.
  - TypeScript clean; 9 new unit tests passing. Status → testing.
