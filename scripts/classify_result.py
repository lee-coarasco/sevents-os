#!/usr/bin/env python3
"""Classify how a `claude -p` stream-json session ended, precisely.

Reads the JSONL log and inspects the final `type: result` event's
`subtype`/`is_error`/`errors` fields, instead of grep'ing loosely for
text like "rate_limit" anywhere in the file — that text can appear in
retried-through, non-fatal events even on a run that actually ended for
a completely different reason (this bit us once: a run that hit the
--max-budget-usd cap after 12 minutes of real, paid work contained
several incidental "rate_limit" mentions and got misreported as "still
rate-limited, wait ~2h" instead of what it actually was).

Prints exactly one word to stdout:
  success     - real session completed normally
  stalled     - the session ended NORMALLY, but its last message says it is waiting for
                something (a background task, a notification): in an unattended run nothing
                ever comes back, so the ticket was left half-done (DAS-X, 2026-09-24)
  budget_near - the session ended NORMALLY but only because the agent ran out of its own
                budget (cost >= NEAR_CAP_USD and its final message talks about the budget):
                the ticket work is not finished, so run.sh starts a fresh session at once
  budget_cap  - hit --max-budget-usd (a per-session local cap, not an
                account-wide limit — a fresh session gets a fresh
                budget immediately, no reason to wait)
  rate_limit  - a genuine account-level usage/rate-limit rejection
  error       - any other failure
  unknown     - couldn't find a result event at all (e.g. crashed log)
"""
import json
import os
import re
import sys

NEAR_CAP_USD = float(os.environ.get("AGENT_NEAR_CAP_USD", "9.0"))  # set in appyard.env; the agent stops itself a
# little before the cap (AGENT_MAX_BUDGET_USD), so run.sh starts a fresh session.


# The final message of a session that stopped to wait: "I'll wait for the background task
# notification", "Waiting for the background test run to finish".
STALLED = re.compile(
    r"\bwait(?:ing)?\b[^.\n]{0,80}\b(?:background|notification|to finish|to complete|to come back)\b"
    r"|\bbackground (?:task|test|run|job|process)\b[^.\n]{0,60}\b(?:finish|complete|running|notif)",
    re.IGNORECASE,
)


def classify(path: str) -> str:
    subtype = ""
    is_error = None
    errors: list = []
    result_text = ""
    cost = 0.0
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") == "result":
                    subtype = obj.get("subtype", "") or ""
                    is_error = obj.get("is_error")
                    errors = obj.get("errors") or []
                    result_text = str(obj.get("result") or "")
                    cost = float(obj.get("total_cost_usd") or 0)
    except FileNotFoundError:
        return "unknown"

    if not subtype:
        return "unknown"
    if not is_error:
        if cost >= NEAR_CAP_USD and "budget" in result_text.lower():
            return "budget_near"
        if STALLED.search(result_text):
            return "stalled"
        return "success"

    text = (subtype + " " + " ".join(str(e) for e in errors)).lower()
    if "budget" in text:
        return "budget_cap"
    # The account-level limit arrives as ordinary result text ("You've hit your session limit
    # - resets 8:30pm"), not in subtype/errors - it used to fall through to "error" and turn a
    # normal, transient wait into a red failed run.
    said = result_text.lower()
    if ("hit your" in said and "limit" in said) or "session limit" in said or "usage limit" in said:
        return "rate_limit"
    if "429" in text or "quota" in text or "overloaded" in text or ("rate" in text and "limit" in text):
        return "rate_limit"
    return "error"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("unknown")
        sys.exit(0)
    print(classify(sys.argv[1]))
