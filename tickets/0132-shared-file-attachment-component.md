---
id: 132
title: Shared <FileAttachment> component (Supabase Storage wiring)
status: testing
roles: [ui-designer, backend-engineer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). CLAUDE.md's shared-component
table lists `<FileAttachment>` for "any `storage_reference` field," backed
by "Supabase Storage (via backend proxy)." Survey which existing
`storage_reference`-shaped fields already have ad-hoc upload UI (tender
documents, document revisions ticket 0109 built) before designing this —
the goal is one component those screens can be migrated onto, not a
parallel upload mechanism.

CLAUDE.md is explicit that file storage uses Supabase Storage via the
backend (service role), never a direct browser-to-Storage upload with
client credentials — confirm whether any existing upload path already
violates this (direct browser upload) and fix forward if so, same
"found while surveying, fixed inline" precedent several other module
tickets have used.

## Acceptance
- [ ] `frontend/src/components/FileAttachment.tsx` — upload button/
  dropzone, shows uploaded file name + a download/view link, backed by a
  backend-proxied Supabase Storage endpoint (survey/build the proxy
  endpoint if none exists yet).
- [ ] At least one existing ad-hoc upload screen (tender documents or
  document revisions) migrated onto the shared component, to prove it's
  reusable and not just scaffolding.
- [ ] Tests: component test + the migrated screen's existing test suite
  still passes.

## Progress

2026-10-17: Built backend storage proxy (`backend/src/modules/storage/routes.ts`) with POST /storage/upload, DELETE /storage/*, and GET /storage/signed-url/* endpoints using service-role Supabase client against the `attachments` bucket. Installed and registered `@fastify/multipart` (50 MB limit) in app.ts. Built `frontend/src/components/FileAttachment.tsx` with `<FileAttachment onUploaded={...}>` upload button and `<AttachmentLink attachment={...}>` display component. Upload uses raw `fetch` with `FormData` to avoid overriding the multipart Content-Type boundary. Both modules wired into `app.ts`; TypeScript checks pass.
