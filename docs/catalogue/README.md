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
