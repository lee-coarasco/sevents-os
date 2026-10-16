---
id: 110
title: Build Configuration Studio UI (M06) and Work-Item Catalogue admin view (M05)
status: next
roles: [ui-designer, backend-engineer, test-engineer, architect]
priority: 1
created: 2026-10-16
updated: 2026-10-16
---

M06 — Configuration Studio:

Workflow Definitions list page (name, version, status badge: draft/published/archived)
Create/edit workflow definition form (name, description, trigger type)
Steps editor: add/reorder steps, set step type (task/approval/gateway), assign role, set SLA
Version history panel: list versions, see diff, publish/rollback buttons
Validation panel: run simulation against a sample payload, show errors inline

M05 — Full catalogue management (inside Configuration Studio):

Browse with search + filters (disposition, module, keyword, status)
Add a new catalogue item (name, description, module, disposition, tags)
Edit an existing item (any field)
Archive/retire an item (soft-delete — keeps it in history, removes it from active pickers)
Bulk import via CSV (same format as the original seed — lets the owner update the catalogue when the BRD evolves)
Export current catalogue to CSV
All write operations: documents.register.manage equivalent permission — Document Controller + Platform Administrator
Archived items are hidden from workflow pickers but visible in a “Show archived” filter

One constraint worth keeping: an item that already has active workflow instances attached to it cannot be archived without first migrating or closing those instances — the UI should surface that dependency and block the action with a clear message rather than silently deleting.

_Created by lee-coarasco in the AppYard dashboard._

## Progress
