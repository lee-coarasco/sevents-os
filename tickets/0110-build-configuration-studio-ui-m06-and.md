---
id: 110
title: Build Configuration Studio UI (M06) and Work-Item Catalogue admin view (M05)
status: done
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
- 2026-10-16 22:50 UTC: closed with no code of its own, same pattern as
  every other oversized module ticket (M06/M07/M09/M10/M11/M13/M31/M35
  split precedent). Surveyed both backends
  (`backend/src/modules/catalogue`, `backend/src/modules/workflow`) and
  split into 0125 (M05 admin UI — buildable now on the existing
  catalogue backend, picked up immediately), 0126 (M05 item creation +
  bulk CSV import/export — needs an architect decision on the trust
  model first), 0127 (M06 Configuration Studio UI — the full steps
  editor/version/validation/simulation surface, flagged a missing
  dispatchNotification wiring gap in the workflow module found during
  the survey). See DECISIONS.md for the full reasoning.
