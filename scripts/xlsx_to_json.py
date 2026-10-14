#!/usr/bin/env python3
"""Convert docs/work-item-catalogue.xlsx to JSON without third-party deps.

The sandbox has no openpyxl/pandas. The workbook has no sharedStrings.xml
(all strings are inline <is><t>), so a small stdlib zipfile/ElementTree
reader is enough. Output: one JSON file per sheet under docs/catalogue/.

Usage: python3 scripts/xlsx_to_json.py
"""
import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
XLSX_PATH = "docs/work-item-catalogue.xlsx"
OUT_DIR = "docs/catalogue"

COL_RE = re.compile(r"^([A-Z]+)(\d+)$")


def col_to_index(col: str) -> int:
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def cell_value(c):
    t = c.get("t")
    if t == "inlineStr":
        is_el = c.find(f"{NS}is")
        if is_el is None:
            return None
        texts = is_el.findall(f".//{NS}t")
        return "".join(t.text or "" for t in texts) if texts else None
    v = c.find(f"{NS}v")
    if v is None or v.text is None:
        return None
    if t == "s":
        return v.text
    try:
        f = float(v.text)
        return int(f) if f.is_integer() else f
    except ValueError:
        return v.text


def parse_sheet(xml_bytes):
    root = ET.fromstring(xml_bytes)
    sheet_data = root.find(f"{NS}sheetData")
    rows = []
    for r in sheet_data.findall(f"{NS}row"):
        row = {}
        for c in r.findall(f"{NS}c"):
            m = COL_RE.match(c.get("r"))
            col_idx = col_to_index(m.group(1))
            row[col_idx] = cell_value(c)
        if row:
            max_idx = max(row)
            rows.append([row.get(i) for i in range(max_idx + 1)])
    return rows


def rows_to_records(rows):
    header = [h.strip() if isinstance(h, str) else h for h in rows[0]]
    records = []
    for r in rows[1:]:
        rec = {}
        for i, key in enumerate(header):
            rec[key] = r[i] if i < len(r) else None
        records.append(rec)
    return header, records


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    z = zipfile.ZipFile(XLSX_PATH)
    workbook_xml = z.read("xl/workbook.xml")
    wb_root = ET.fromstring(workbook_xml)
    sheets = wb_root.find(f"{NS}sheets").findall(f"{NS}sheet")
    rels_xml = z.read("xl/_rels/workbook.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rel_ns = "{http://schemas.openxmlformats.org/package/2006/relationships}"
    rid_to_target = {
        rel.get("Id"): rel.get("Target") for rel in rels_root.findall(f"{rel_ns}Relationship")
    }

    r_id_attr = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    for sheet in sheets:
        name = sheet.get("name")
        rid = sheet.get(r_id_attr)
        target = rid_to_target[rid]
        path = "xl/" + target if not target.startswith("/") else target.lstrip("/")
        rows = parse_sheet(z.read(path))
        header, records = rows_to_records(rows)
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        out = {"sheet_name": name, "header": header, "row_count": len(records), "records": records}
        out_path = os.path.join(OUT_DIR, f"{slug}.json")
        with open(out_path, "w") as f:
            json.dump(out, f, indent=2)
        print(f"{name}: {len(records)} rows -> {out_path}")


if __name__ == "__main__":
    main()
