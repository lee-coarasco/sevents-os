#!/usr/bin/env python3
"""Is a scheduled agent run due now? (the working-hours setting)

The workflow's cron fires every hour and stays that way: changing it would mean
editing a workflow file, which only people do. Instead run.sh asks this script
first and exits quietly when the run isn't due. Settings, from appyard.env:

  AGENT_ACTIVE_HOURS   "HH-HH" in the runner's TZ, start inclusive, end exclusive;
                       "09-21" = 09:00 to 20:59, "21-06" wraps past midnight.
                       Empty = all day.
  AGENT_EVERY_HOURS    run on every Nth hour, counted from the window's start
                       (or from midnight without a window). Empty or 1 = every hour.

A run started by hand (GITHUB_EVENT_NAME=workflow_dispatch, e.g. the dashboard's
"Run now") is always due.

Usage: schedule.py due     exit 0 if due, 1 if not; prints the reason
       schedule.py check   exit 0 if the settings are valid, 2 if not
"""
import datetime
import os
import re
import sys


def parse_hours(value: str) -> tuple[int, int] | None:
    value = value.strip()
    if not value:
        return None
    m = re.fullmatch(r"(\d{1,2})\s*-\s*(\d{1,2})", value)
    if not m:
        raise ValueError(f"AGENT_ACTIVE_HOURS '{value}' must look like 09-21")
    start, end = int(m[1]), int(m[2])
    if not (0 <= start <= 23 and 1 <= end <= 24) or start == end:
        raise ValueError(f"AGENT_ACTIVE_HOURS '{value}' needs two different hours, 0-23 then 1-24")
    return start, end


def parse_every(value: str) -> int:
    value = value.strip()
    if not value:
        return 1
    if not re.fullmatch(r"\d{1,2}", value) or not 1 <= int(value) <= 24:
        raise ValueError(f"AGENT_EVERY_HOURS '{value}' must be a whole number from 1 to 24")
    return int(value)


def due(hour: int, hours: tuple[int, int] | None, every: int, manual: bool) -> tuple[bool, str]:
    if manual:
        return True, "started by hand"
    start = 0
    if hours:
        start, end = hours
        inside = start <= hour < end if start < end else (hour >= start or hour < end % 24)
        if not inside:
            return False, f"outside working hours {start:02d}-{end:02d}"
    if (hour - start) % 24 % every:
        return False, f"runs every {every} hours; not due at {hour:02d}:00"
    return True, "due"


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else ""
    try:
        hours = parse_hours(os.environ.get("AGENT_ACTIVE_HOURS", ""))
        every = parse_every(os.environ.get("AGENT_EVERY_HOURS", ""))
    except ValueError as e:
        print(e)
        # A broken setting must not silently stop the agent: treat it as no limit.
        return 2 if cmd == "check" else 0
    if cmd == "check":
        return 0
    if cmd == "due":
        now = datetime.datetime.now().astimezone()
        ok, why = due(now.hour, hours, every, os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch")
        print(why)
        return 0 if ok else 1
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
