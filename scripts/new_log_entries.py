#!/usr/bin/env python3
"""Print the daily-log entries added during this run.

An entry is a block starting with a "## " heading line. Entries whose heading
was already in the file before the run (listed one per line in the file named
by LOG_HEADINGS_BEFORE_FILE, which run.sh writes) are skipped, so where an entry
sits in the file does not matter. "---" separator lines are dropped.

With no "before" file (a manual run) only the newest entry is printed.

This replaced an older rule, "everything after the last ---", which re-sent the
previous session's summary whenever a session wrote no entry, and never sent an
entry written at the top of the file (both seen in DAS-X on 2026-09-21).

Usage: new_log_entries.py <daily-log file>
"""
import os
import re
import sys


def new_entries(text: str, before_headings: set[str] | None) -> list[str]:
    entries = re.split(r"(?m)^(?=## )", text)
    entries = [e for e in entries if e.startswith("## ")]
    if before_headings is not None:
        new = [e for e in entries if e.splitlines()[0].strip() not in before_headings]
    elif entries:
        new = [entries[-1]]
    else:
        new = []
    return [re.sub(r"(?m)^---\s*$", "", e).strip() for e in new]


def main(log_path: str) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    text = open(log_path, encoding="utf-8").read()
    before_path = os.environ.get("LOG_HEADINGS_BEFORE_FILE")
    before = None
    if before_path and os.path.exists(before_path):
        before = {line.strip() for line in open(before_path, encoding="utf-8")}
    print("\n".join(new_entries(text, before)))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: new_log_entries.py <daily-log file>", file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
