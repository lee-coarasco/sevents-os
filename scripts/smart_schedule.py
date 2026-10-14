#!/usr/bin/env python3
"""Smart scheduling helpers for run.sh.

Usage:
  smart_schedule.py skip-until <log_file>
      Searches log_file for a Claude "resets Xpm (Timezone)" line.
      If found, prints the next occurrence of that time as a UTC ISO timestamp.
      Exits 1 (no output) if no reset time is found.

  smart_schedule.py check-skip <skip_file>
      Reads a UTC ISO timestamp from skip_file.
      Exits 0 (still active, should skip) if now < that timestamp.
      Exits 1 (expired, can run) otherwise.
"""
import datetime
import re
import sys

try:
    import zoneinfo
except ImportError:
    from backports import zoneinfo  # type: ignore


def cmd_skip_until(log_path: str) -> None:
    with open(log_path, errors="replace") as f:
        log = f.read()
    m = re.search(r"resets\s+(\d+(?::\d+)?\s*[ap]m)(?:\s+\(([^)]+)\))?", log, re.IGNORECASE)
    if not m:
        sys.exit(1)
    time_str = m.group(1).strip()
    tz_name = (m.group(2) or "UTC").strip()
    tm = re.match(r"(\d+)(?::(\d+))?\s*([ap]m)", time_str, re.IGNORECASE)
    if not tm:
        sys.exit(1)
    h = int(tm.group(1)) % 12
    mi = int(tm.group(2) or "0")
    if tm.group(3).lower() == "pm":
        h += 12
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = datetime.timezone.utc
    now = datetime.datetime.now(tz)
    target = now.replace(hour=h, minute=mi, second=0, microsecond=0)
    if target <= now:
        target += datetime.timedelta(days=1)
    print(target.astimezone(datetime.timezone.utc).isoformat())


def cmd_check_skip(skip_path: str) -> None:
    try:
        with open(skip_path) as f:
            ts = f.read().strip()
        target = datetime.datetime.fromisoformat(ts)
        now = datetime.datetime.now(datetime.timezone.utc)
        sys.exit(0 if now < target else 1)
    except Exception:
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    cmd, path = sys.argv[1], sys.argv[2]
    if cmd == "skip-until":
        cmd_skip_until(path)
    elif cmd == "check-skip":
        cmd_check_skip(path)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(2)
