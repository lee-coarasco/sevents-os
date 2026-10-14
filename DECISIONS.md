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

## 2026-10-14 18:43 IST - Pilot flow confirmed as material request → PO → GRN → site issue
- Decision: `docs/PRD.md` covers the pilot vertical slice CLAUDE.md already
  names as the default: material requirement → procurement review →
  quotation comparison → approval → PO → delivery/GRN → site issue. Stops
  before vendor-bill matching/payment (that's Phase 5).
- Why: CLAUDE.md Phase 0 instructions give this as the default unless the
  business owner redirects it; BRD §10.3 and Implementation Plan §3 Phase 3
  both describe the same flow. No new decision was invented — this just
  records that the default was taken rather than silently assumed.
- Approved by: agent (PRD scope was explicitly pre-framed by the owner in
  CLAUDE.md as "this flow, or whatever the business owner confirms" — not
  treated as an open PRD-scope question requiring a stop-all-work ask).

## 2026-10-14 18:43 IST - Cluster catalogue rows by shared trigger, not one ticket per row
- Decision: Classify the 1,308-row source catalogue into tickets by
  grouping rows that share Department + Role + near-identical source
  `Trigger` text into one ticket per cluster, rather than one ticket per
  row.
- Why: BRD §6.3/Implementation Plan §1 are explicit that the catalogue
  "does not define module boundaries" and the system must not become
  "1,308 separate features." The source text itself confirms clusters:
  e.g. rows 601/604/605/606/608/610 share the exact same Trigger sentence
  almost verbatim. One ticket per row would produce ~1,300 near-duplicate
  files obscuring the actual unit of work. Row-level traceability is
  preserved inside each ticket (a table listing every source S.No.), so
  nothing is lost, just not one-file-per-row.
- Approved by: agent (ticket classification/ordering is explicitly listed
  in CLAUDE.md as an agent decision needing no owner approval).

## 2026-10-14 18:43 IST - Do not commit the full catalogue JSON extract to git
- Decision: `scripts/xlsx_to_json.py` converts the source workbook to JSON
  for processing; the small sheets are committed, but
  `docs/catalogue/source-catalogue.json` (~5.5MB, regenerable in seconds
  from the xlsx already in the repo) is gitignored.
- Why: avoid repo bloat from a fully derived/regenerable artifact; the
  xlsx is the actual source of truth per BRD §6.3 ("source workbook
  remains an immutable import/source snapshot").
- Approved by: agent (internal tooling/repo-hygiene decision).
