#!/usr/bin/env python3
"""Print full operational fields for given catalogue S.No. rows.

Used during catalogue classification to read Trigger/Action/Output/
Handoff/Escalation/Timing for a set of rows at once, to check whether they
share a trigger (and so cluster into one ticket) before writing the ticket.

Usage: python3 scripts/catalogue_lookup.py 601,604,605
       python3 scripts/catalogue_lookup.py --department Procurement --role "Storekeeper"
"""
import json
import sys

PATH = "docs/catalogue/source-catalogue.json"


def load():
    with open(PATH) as f:
        return json.load(f)["records"]


def main():
    records = load()
    if not sys.argv[1:]:
        print(__doc__)
        return
    if sys.argv[1] == "--department":
        dept = sys.argv[2]
        role = None
        if "--role" in sys.argv:
            role = sys.argv[sys.argv.index("--role") + 1]
        rows = [r for r in records if r["Department"] == dept and (role is None or r["Who is Responsible"] == role)]
    else:
        wanted = {int(x) for x in sys.argv[1].split(",")}
        by_sno = {r["S.No."]: r for r in records}
        rows = [by_sno[s] for s in sorted(wanted) if s in by_sno]

    for r in rows:
        print(f"=== #{r['S.No.']} | {r['Department']} | {r['Who is Responsible']}")
        print("Name:", r["Work Item Name"])
        print("Trigger:", r["Trigger"])
        print("Action:", r["Action"])
        print("Output/Evidence:", r["Output/Evidence"])
        print("Control/Handoff:", r["Control/Handoff"])
        print("Continuity/Escalation:", r["Continuity/Escalation"])
        print("Timing:", r["Timing"])
        print()


if __name__ == "__main__":
    main()
