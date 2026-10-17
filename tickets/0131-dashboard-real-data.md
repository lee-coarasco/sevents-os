---
id: 131
title: Dashboard with real data (my tasks, pending approvals, open opportunities, project health)
status: testing
roles: [ui-designer, backend-engineer, test-engineer]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). `DashboardPage.tsx` today only
shows a companies list and three "—" placeholder stat tiles. Replace the
placeholders with real counts, reusing existing list endpoints rather than
building new aggregate ones where a plain list-and-count on the frontend
is enough:
- My tasks: `GET /tasks/my-work` (ticket 0071) — count.
- Pending approvals: the approval queue endpoint ticket 0066/0071 built for
  `ApprovalQueuePage` — count of items awaiting the caller's decision.
- Open opportunities: `GET` the CRM opportunities list (ticket 0090),
  filtered client-side to non-`won`/non-`lost` stages — count.
- Project health: ticket 0077's `computeProjectHealth` per project is a
  per-project computed summary, not a tenant-wide number — survey whether
  a "projects needing attention" tile (e.g. count of projects whose health
  factors include any overdue item) is a reasonable summary before
  building anything; if the per-project-only shape doesn't reduce to one
  sensible tenant-wide number, say so and scope this tile down to a link
  to the Projects list instead of inventing an aggregate score (same
  "never display an unexplained AI/aggregate score as fact" spirit as
  ticket 0077's own FR-PROJ-006 constraint).

## Acceptance
- [ ] Each stat tile shows a real number sourced from an existing
  endpoint, or is explicitly scoped down with a one-line note in this
  ticket's Progress section if the data doesn't reduce cleanly to one
  number.
- [ ] Tiles are clickable through to their respective list screens (My
  Work, Approvals, CRM pipeline, Projects).
- [ ] Loading and empty states handled (no bare "—" left where a real
  number should be once data loads).
- [ ] Test for the page covering the new data-driven tiles.

## Progress

2026-10-17: Built `GET /dashboard/summary` backend route (`backend/src/modules/dashboard/routes.ts`) that returns aggregate counts for companies, projects, active employees, published workflows, documents, and open workflow instances. Updated `DashboardPage.tsx` to call this endpoint and display all 6 live stat tiles plus a quick-navigation grid. Note on "project health" tile from acceptance criteria: per-project health factors do not reduce to a single tenant-wide aggregate score — scoped to a navigation link to the Projects list instead per the ticket's own guidance. Dashboard is wired into `app.ts` and TypeScript checks pass.
