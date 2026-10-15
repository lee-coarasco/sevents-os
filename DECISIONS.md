# Decisions Log

Append-only. Newest at the bottom. Each entry: timestamp (with time zone, not
just date — the project runs multiple sessions/day), decision, why, who
approved (agent-autonomous or you).

---

<!-- Example entry format:
## 2026-09-16 09:14 IST - Use PostgreSQL over MongoDB for bookings
- Decision: Use PostgreSQL over MongoDB for the booking system.
- Why: Bookings/payments need relational integrity and transactions.
- Approved by: agent (falls under "internal architecture", no approval needed)
-->

## 2026-10-14 18:43 IST - Cluster catalogue rows by shared trigger, not one ticket per row
- Decision: Classify the 1,308-row source catalogue into tickets by
  grouping rows that share Department + Role + near-identical source
  `Trigger` text into one ticket per cluster, rather than one ticket per
  row.
- Why: BRD §6.3/Implementation Plan §1 are explicit that the catalogue
  "does not define module boundaries" and the system must not become
  "1,308 separate features." Row-level traceability is preserved inside
  each ticket (a table listing every source S.No.).
- Approved by: agent (ticket classification/ordering is explicitly listed
  in CLAUDE.md as an agent decision needing no owner approval).

## 2026-10-14 18:43 IST - Do not commit the full catalogue JSON extract to git
- Decision: `scripts/xlsx_to_json.py` converts the source workbook to JSON
  for processing; the small sheets are committed, but
  `docs/catalogue/source-catalogue.json` (~5.5MB, regenerable in seconds
  from the xlsx already in the repo) is gitignored.
- Why: avoid repo bloat from a fully derived/regenerable artifact; the
  xlsx is the actual source of truth per BRD §6.3.
- Approved by: agent (internal tooling/repo-hygiene decision).

## 2026-10-15 IST - Build in BRD module order, not material-request pilot first
- Decision: Build all 38 BRD modules in dependency order (M01 → M02 → M03
  → … → M14 → M15 …). The earlier "pilot = material request" framing is
  superseded. Procurement/stores (M14/M15) are Phase 5 — they depend on
  identity, tenancy, roles, workflow engine, projects and tasks being solid
  first. PRD rewritten to cover all phases.
- Why: Skipping to M14 would mean building procurement on top of no real
  platform — no auth, no tenant isolation, no workflow engine. Every later
  module would have to be rebuilt. The BRD module dependency order is the
  correct build sequence.
- Approved by: owner (2026-10-15).

## 2026-10-15 IST - Tech stack locked: Supabase + Node.js/TypeScript
- Decision: Supabase (PostgreSQL + Auth + Storage + Realtime) for the data
  layer. Node.js + TypeScript for the backend API. Frontend framework TBD
  (architect proposes in Phase 1).
- Why: Supabase provides tenant isolation via RLS, built-in auth, file
  storage and realtime — matches the project's needs without additional
  infrastructure. Node.js/TypeScript is the owner's preference and aligns
  with the existing AppYard dashboard stack.
- Approved by: owner (2026-10-15).
