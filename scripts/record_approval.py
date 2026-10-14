#!/usr/bin/env python3
"""Record an approval answer from Slack and reopen the gate.

Called by approval-listener.yml with SLACK_ANSWER (required) and SLACK_QUESTION
(optional) from the repository_dispatch payload. Appends a timestamped entry to
DECISIONS.md, then resets NEEDS_APPROVAL.md to its empty template, which is what
run.sh's gate looks for.

Note: the reset clears every pending question, not only the one answered (see
SPEC.md, "Known gaps").

Usage: record_approval.py [repo dir]   (defaults to the current directory)
"""
import datetime
import os
import sys

EMPTY_NEEDS_APPROVAL = (
    "# Needs Your Approval\n\n"
    "If this file is non-empty, the agent will NOT proceed with building until\n"
    "you answer the question(s) below and clear this file back to empty.\n\n"
    "How to respond: write your answer directly under the question, then either\n"
    "delete the question block or move it to DECISIONS.md, so this file is empty\n"
    "(or only contains unanswered questions) before the next run.\n\n"
    "---\n\n"
    "(empty — nothing pending)\n"
)


def timestamp(now: datetime.datetime | None = None) -> str:
    # The local time of the runner's TZ, labelled with its abbreviation (IST, UTC, ...):
    # several answers can land on one day, so a date alone is ambiguous.
    now = now or datetime.datetime.now().astimezone()
    return now.strftime("%Y-%m-%d %H:%M %Z")


def record(repo: str, answer: str, question: str, when: str) -> None:
    with open(os.path.join(repo, "DECISIONS.md"), "a", encoding="utf-8") as f:
        f.write(f"\n## {when}\n")
        if question:
            f.write(f"- Question: {question}\n")
        f.write(f"- Answer: {answer}\n")
        f.write("- Approved by: you (via Slack)\n")
    with open(os.path.join(repo, "NEEDS_APPROVAL.md"), "w", encoding="utf-8") as f:
        f.write(EMPTY_NEEDS_APPROVAL)


def main() -> int:
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    answer = os.environ.get("SLACK_ANSWER", "").strip()
    question = os.environ.get("SLACK_QUESTION", "").strip()
    if not answer:
        print("No answer found in the payload — nothing to record.")
        return 1
    record(repo, answer, question, timestamp())
    print("Recorded answer and cleared NEEDS_APPROVAL.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
