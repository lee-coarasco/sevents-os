#!/usr/bin/env python3
"""The usage ledger: one line per agent session, kept in the repo.

run.sh appends a line after every session and commits it with the session's
work, so usage survives the runner (logs/ does not) and outlives GitHub's
90-day log retention. The daily limit is checked against it, and the
dashboard charts it.

File: usage/ledger.tsv, tab-separated, with a header line:
  time         ISO 8601 with offset, in the runner's TZ (2026-09-24T10:05:31+05:30)
  run          GITHUB_RUN_ID, or "local"
  attempt      1, 2, 3 within the run
  cost_usd     Claude Code's own total_cost_usd for the session: an estimate at
               API prices, not a bill when the account is on a subscription
  turns        num_turns
  outcome      classify_result.py's word, or "capped" for a run the daily
               limit skipped (cost 0, written once per day)
  duration_min wall-clock minutes the session ran (0 in rows predating this column)

Usage:
  usage_ledger.py record <session log.jsonl> <outcome> <attempt>
  usage_ledger.py spent-today          prints today's total, e.g. 42.17
  usage_ledger.py capped-today         exit 0 if today already has a "capped" line
  usage_ledger.py mark-capped          appends today's "capped" line
  usage_ledger.py session-budget <daily limit> <session cap>
                                       prints the budget for the next session:
                                       the session cap, or what is left of the
                                       daily limit if that is less; 0.00 when
                                       under $1 is left (no point starting)
  usage_ledger.py backfill [logs_dir]  scan JSONL logs and patch duration_min=0
                                       rows; logs_dir defaults to "logs/"
The ledger path can be overridden with USAGE_LEDGER (for tests).
"""
import datetime
import json
import os
import sys

HEADER = "time\trun\tattempt\tcost_usd\tturns\toutcome\tduration_min\n"


def ledger_path() -> str:
    return os.environ.get("USAGE_LEDGER", "usage/ledger.tsv")


def now() -> datetime.datetime:
    # astimezone() uses the process TZ, which the workflow sets (AGENT_TZ).
    return datetime.datetime.now().astimezone().replace(microsecond=0)


def append(row: list) -> None:
    path = ledger_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    new = not os.path.exists(path) or os.path.getsize(path) == 0
    with open(path, "a", encoding="utf-8", newline="\n") as f:
        if new:
            f.write(HEADER)
        f.write("\t".join(str(c) for c in row) + "\n")


def rows():
    try:
        with open(ledger_path(), encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return
    for line in lines[1:]:
        parts = line.split("\t")
        if len(parts) >= 6:
            if len(parts) == 6:
                parts.append("0")  # back-fill duration_min for old rows
            yield parts


def today_rows():
    today = now().date().isoformat()
    return [r for r in rows() if r[0][:10] == today]


def spent_today() -> float:
    total = 0.0
    for r in today_rows():
        try:
            total += float(r[3])
        except ValueError:
            pass
    return total


def result_of(log_path: str) -> tuple[float, int, float]:
    cost, turns = 0.0, 0
    first_ts: datetime.datetime | None = None
    last_ts: datetime.datetime | None = None
    try:
        with open(log_path, encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") == "result":
                    cost = float(obj.get("total_cost_usd") or 0)
                    turns = int(obj.get("num_turns") or 0)
                ts_str = obj.get("timestamp")
                if ts_str:
                    try:
                        ts = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                        if first_ts is None:
                            first_ts = ts
                        last_ts = ts
                    except ValueError:
                        pass
    except FileNotFoundError:
        pass
    duration_min = 0.0
    if first_ts and last_ts and last_ts > first_ts:
        duration_min = round((last_ts - first_ts).total_seconds() / 60, 2)
    return cost, turns, duration_min


def backfill(logs_dir: str) -> int:
    import glob as _glob
    import re as _re

    path = ledger_path()
    try:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
    except FileNotFoundError:
        print("No ledger file found.", file=sys.stderr)
        return 1

    lines = raw.splitlines()
    header, data = lines[0], lines[1:]

    # Build a lookup: (cost_4dp, turns, attempt) -> list of row indices with duration=0
    idx: dict[tuple, list[int]] = {}
    for i, line in enumerate(data):
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        dur = float(parts[6]) if len(parts) > 6 else 0.0
        if dur > 0:
            continue  # already has duration
        key = (parts[3], parts[4], parts[2])  # cost_usd, turns, attempt
        idx.setdefault(key, []).append(i)

    patched = 0
    for log_path in sorted(_glob.glob(f"{logs_dir}/run-*.jsonl")):
        m = _re.search(r"-attempt(\d+)\.jsonl$", log_path)
        attempt = m.group(1) if m else "0"
        cost, turns, duration_min = result_of(log_path)
        if duration_min <= 0:
            continue
        key = (f"{cost:.4f}", str(turns), attempt)
        candidates = idx.get(key, [])
        if not candidates:
            continue
        i = candidates.pop(0)  # consume earliest unpatched match
        parts = data[i].split("\t")
        if len(parts) == 6:
            parts.append(f"{duration_min:.2f}")
        else:
            parts[6] = f"{duration_min:.2f}"
        data[i] = "\t".join(parts)
        patched += 1

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(header + "\n")
        for line in data:
            if line:
                f.write(line + "\n")

    print(f"Backfilled {patched} row(s).")
    return 0


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "record" and len(argv) == 5:
        cost, turns, duration_min = result_of(argv[2])
        run = os.environ.get("GITHUB_RUN_ID", "local")
        append([now().isoformat(), run, argv[4], f"{cost:.4f}", turns, argv[3], f"{duration_min:.2f}"])
        return 0
    if cmd == "spent-today":
        print(f"{spent_today():.2f}")
        return 0
    if cmd == "session-budget" and len(argv) == 4:
        left = float(argv[2]) - spent_today()
        budget = min(float(argv[3]), left)
        print(f"{budget:.2f}" if budget >= 1 else "0.00")
        return 0
    if cmd == "capped-today":
        return 0 if any(r[5] == "capped" for r in today_rows()) else 1
    if cmd == "mark-capped":
        append([now().isoformat(), os.environ.get("GITHUB_RUN_ID", "local"), 0, "0", 0, "capped"])
        return 0
    if cmd == "backfill":
        return backfill(argv[2] if len(argv) > 2 else "logs")
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
