#!/usr/bin/env python3
"""Build a Slack message payload from markdown.

daily-log/*.md and the short alert strings in run.sh are written as
GitHub-flavored markdown (**bold**, [text](url), ## headers) — Slack's
webhook `text` field doesn't render any of that, so unconverted it just
shows literal asterisks/hashes/brackets. This does a light, dependency-free
conversion to Slack's mrkdwn, and for a full session entry, splits it into
separate Block Kit sections (one per "## " subsection: What I did /
Decisions / Blocked / Next) with dividers, instead of one dense wall of text.

Reads markdown from stdin, writes the JSON webhook payload to stdout.
If the SLACK_FOOTER env var is set (pre-formatted Slack mrkdwn, built by
notify.sh from the latest release, preview URL and NOTIFY_LINKS), it's
appended to every message so the latest build/preview links are always one
tap away, not just on the run that happened to produce them.

Usage:
  slack_format.py --text      simple {"text": "..."} payload (short alerts)
  slack_format.py --session   full Block Kit payload for one daily-log entry
"""
import json
import os
import re
import sys

# Force UTF-8 regardless of platform default (Windows terminals in
# particular often default stdin/stdout to a legacy codepage, which
# mangles the em-dashes/smart-quotes daily-log entries use).
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

BLOCK_TEXT_LIMIT = 2800  # Slack's real per-block limit is 3000; leave headroom


def md_to_mrkdwn(text: str) -> str:
    # [text](url) -> <url|text>
    text = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", r"<\2|\1>", text)
    # **bold** -> *bold* (Slack bold uses single asterisks)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    return text


def truncate(text: str, limit: int = BLOCK_TEXT_LIMIT) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 20].rstrip() + "\n…(truncated, see the repo for the full entry)"


def build_session_blocks(md: str) -> list:
    lines = md.strip("\n").splitlines()
    if not lines:
        return [{"type": "section", "text": {"type": "mrkdwn", "text": "(no session content found)"}}]

    title = lines[0].lstrip("#").strip()
    body = "\n".join(lines[1:])

    blocks = [
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*{md_to_mrkdwn(title)}*"}},
        {"type": "divider"},
    ]

    # Split on this session's own "## " / "### " subsections (the first is the owner's plain-words
    # summary, so it becomes its own Slack block and is never cut off by a long technical section) (What I did, Decisions,
    # Blocked / pending your approval, Next, ...) rather than treating the
    # whole thing as one block.
    parts = re.split(r"(?m)^#{2,3}\s+", body)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        heading, _, rest = part.partition("\n")
        section_text = f"*{md_to_mrkdwn(heading.strip())}*\n{md_to_mrkdwn(rest.strip())}"
        blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": truncate(section_text)}})

    return blocks


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "--text"
    raw = sys.stdin.read()
    footer = os.environ.get("SLACK_FOOTER", "").strip()

    if mode == "--session":
        blocks = build_session_blocks(raw)
        if footer:
            blocks.append({"type": "divider"})
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": footer}})
        payload = {"blocks": blocks}
    else:
        text = truncate(md_to_mrkdwn(raw), 3800)
        if footer:
            text = f"{text}\n\n{footer}"
        payload = {"text": text}

    print(json.dumps(payload))


if __name__ == "__main__":
    main()
