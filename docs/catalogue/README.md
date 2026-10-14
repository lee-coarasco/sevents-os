# Catalogue extracts

Generated from `docs/work-item-catalogue.xlsx` by `scripts/xlsx_to_json.py`
(stdlib-only; no openpyxl/pandas in this sandbox). Regenerate anytime with:

```
python3 scripts/xlsx_to_json.py
```

- `jurisdiction-setup.json`, `read-me-taxonomy.json`, `controlled-values.json`
  — small reference sheets, committed.
- `source-catalogue.json` — the full 1,308-row Source Catalogue sheet with
  all 36 columns. **Not committed** (~5.5MB, fully regenerable from the
  xlsx that's already in the repo) — see `.gitignore`. Regenerate it before
  any session that needs to read/classify catalogue rows.
- `disposition-workbook.csv` — committed, derived file. One row per S.No.
  (1-1308, no gaps/duplicates) with the classification decisions already
  made across tickets `tickets/0001-*.md`-`tickets/0051-*.md`: `department`
  and `who_is_responsible` (joined from `source-catalogue.json`),
  `canonical_role_id` (from `docs/canonical-role-map.md`), `disposition`
  (one of BRD §6.5's 7 values) and `ticket_id` (which ticket classified
  that row, for traceability back to its reasoning/exceptions). A blank
  `review_needed` column is used only when a specific row's disposition
  could not be read unambiguously from its owning ticket — it is empty for
  every row as of the last regeneration.

  This is pure synthesis, not a new classification pass: it does not
  reclassify anything, it transcribes what each ticket's "Source rows
  covered" and "## Disposition" sections (including any named per-row
  exceptions) already say. `s_no` is the join key back to
  `source-catalogue.json`'s `S.No.` field. Regenerate by rereading tickets
  0001-0051 (skip 0007, a tracking-only ticket with no row classifications)
  whenever a ticket's classification changes — there is no script for this
  yet since it requires reading ticket prose, not just structured fields.
