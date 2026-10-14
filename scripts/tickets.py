#!/usr/bin/env python3
"""The backlog: one markdown file per ticket in tickets/.

File name: tickets/<id, 4 digits>-<slug>.md, e.g. tickets/0072-wallet-recharge.md.
Each file opens with a front-matter block of fixed fields, then free text:

    ---
    id: 72
    title: Wallet recharge and withdrawals
    status: testing
    roles: [backend-engineer, ui-designer]
    priority: 3
    created: 2026-09-20
    updated: 2026-09-23
    ---

    What and why, in plain words. Then, as needed:
    ## Acceptance   - [ ] checklist
    ## Progress     dated notes, newest last
    ## Needs approval   a decision only the owner can make, one "### <when> — <topic>"
                        block per question; the ticket is blocked until it's answered

Fields:
  id        integer, unique, matches the file name
  title     one line
  status    next | in-progress | blocked | testing | done
            testing = built, waiting for the owner to try it
  roles     list of: architect, ui-designer, backend-engineer, test-engineer,
            devops, human
  priority  integer, 1 = first. Required unless status is done.
  created   YYYY-MM-DD
  updated   YYYY-MM-DD

Usage:
  tickets.py check [dir]        exit 1 and list every problem
  tickets.py next [dir]         the ticket to work on: in-progress first, then
                                next, each by priority (blocked/testing/done and
                                owner-only roles: [human] tickets skipped)
  tickets.py new-id [dir]       the next free id
  tickets.py list [status] [dir]
  tickets.py questions [dir]    open owner questions, one "#<id><TAB><heading>" line each
"""
import datetime
import os
import re
import sys

STATUSES = ["next", "in-progress", "blocked", "testing", "done"]
ROLES = {"architect", "ui-designer", "backend-engineer", "test-engineer", "devops", "human"}
REQUIRED = ["id", "title", "status", "roles", "created", "updated"]
FILE_NAME = re.compile(r"^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
QUESTIONS_HEADING = "## Needs approval"


def questions(body: str) -> list[tuple[str, str]]:
    """(heading, text) for each question in the ticket's "## Needs approval" section.
    Text there without a "### " heading counts as one question headed "Question"."""
    lines = body.replace("\r\n", "\n").split("\n")
    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == QUESTIONS_HEADING)
    except StopIteration:
        return []
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    found: list[tuple[str, list[str]]] = []
    for l in lines[start + 1:end]:
        if l.startswith("### "):
            found.append((l[4:].strip(), []))
        elif l.strip() or found:
            if not found:
                found.append(("Question", []))
            found[-1][1].append(l)
    return [(h, "\n".join(t).strip()) for h, t in found]


def parse(text: str) -> tuple[dict, str]:
    """Front matter as a dict (strings, ints, lists), and the body."""
    lines = text.replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        raise ValueError("no front matter: the file must start with ---")
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise ValueError("front matter is not closed with ---")
    fields: dict = {}
    for n, line in enumerate(lines[1:end], 2):
        if not line.strip():
            continue
        m = re.match(r"^([a-z_]+):\s*(.*)$", line)
        if not m:
            raise ValueError(f"line {n}: expected 'key: value'")
        key, raw = m[1], m[2].strip()
        if raw.startswith("[") and raw.endswith("]"):
            value = [v.strip() for v in raw[1:-1].split(",") if v.strip()]
        elif re.fullmatch(r"-?\d+", raw):
            value = int(raw)
        else:
            value = raw
        fields[key] = value
    return fields, "\n".join(lines[end + 1:]).strip()


def load(directory: str) -> tuple[list[dict], list[str]]:
    tickets, problems = [], []
    if not os.path.isdir(directory):
        return tickets, [f"{directory}/ does not exist"]
    for name in sorted(os.listdir(directory)):
        if not name.endswith(".md") or name.upper() == "README.MD":
            continue
        path = os.path.join(directory, name)
        try:
            fields, body = parse(open(path, encoding="utf-8").read())
        except ValueError as e:
            problems.append(f"{name}: {e}")
            continue
        fields["_file"], fields["_body"] = name, body
        problems += [f"{name}: {p}" for p in validate(fields, name)]
        tickets.append(fields)
    seen: dict = {}
    for t in tickets:
        if isinstance(t.get("id"), int):
            if t["id"] in seen:
                problems.append(f"{t['_file']}: id {t['id']} is also used by {seen[t['id']]}")
            seen[t["id"]] = t["_file"]
    return tickets, problems


def validate(t: dict, name: str) -> list[str]:
    out = [f"missing field '{f}'" for f in REQUIRED if f not in t]
    m = FILE_NAME.match(name)
    if not m:
        out.append("file name must be <4-digit id>-<lowercase-slug>.md")
    if "id" in t:
        if not isinstance(t["id"], int) or t["id"] < 1:
            out.append("id must be a positive integer")
        elif m and int(m[1]) != t["id"]:
            out.append(f"id {t['id']} doesn't match the file name")
    if "status" in t and t["status"] not in STATUSES:
        out.append(f"status '{t['status']}' is not one of {', '.join(STATUSES)}")
    if "roles" in t:
        if not isinstance(t["roles"], list) or not t["roles"]:
            out.append("roles must be a non-empty list like [backend-engineer, ui-designer]")
        else:
            out += [f"unknown role '{r}'" for r in t["roles"] if r not in ROLES]
    if t.get("status") != "done":
        if not isinstance(t.get("priority"), int) or t["priority"] < 1:
            out.append("priority must be a positive integer unless status is done")
    for f in ("created", "updated"):
        if f in t:
            try:
                datetime.date.fromisoformat(str(t[f]))
            except ValueError:
                out.append(f"{f} must be YYYY-MM-DD")
    if not str(t.get("title", "")).strip():
        out.append("title is empty")
    if questions(t.get("_body", "")) and t.get("status") != "blocked":
        out.append(f"has an open question under '{QUESTIONS_HEADING}', so status must be blocked")
    return out


def next_ticket(tickets: list[dict]) -> dict | None:
    # Owner-only tickets (roles: [human]) are for people; an agent can't do them.
    def for_agent(t):
        return isinstance(t.get("priority"), int) and set(t.get("roles") or []) != {"human"}

    for status in ("in-progress", "next"):
        pool = [t for t in tickets if t.get("status") == status and for_agent(t)]
        if pool:
            return min(pool, key=lambda t: (t["priority"], t.get("id", 0)))
    return None


def line(t: dict) -> str:
    return f"#{t.get('id')} [{t.get('status')}] p{t.get('priority', '-')} {t.get('title')} ({', '.join(t.get('roles', []))}) tickets/{t['_file']}"


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else ""
    args = argv[2:]
    if cmd == "list":
        status = args[0] if args and args[0] in STATUSES else None
        directory = next((a for a in args if a not in STATUSES), "tickets")
        tickets, _ = load(directory)
        for t in sorted(tickets, key=lambda t: (STATUSES.index(t.get("status", "done")) if t.get("status") in STATUSES else 9, t.get("priority", 999), t.get("id", 0))):
            if status is None or t.get("status") == status:
                print(line(t))
        return 0
    directory = args[0] if args else "tickets"
    tickets, problems = load(directory)
    if cmd == "check":
        for p in problems:
            print(p)
        print(f"{len(tickets)} tickets, {len(problems)} problem(s)")
        return 1 if problems else 0
    if cmd == "next":
        t = next_ticket(tickets)
        print(line(t) if t else "No ticket is next or in progress.")
        return 0
    if cmd == "questions":
        for t in sorted(tickets, key=lambda t: t.get("id", 0)):
            for heading, _ in questions(t.get("_body", "")):
                print(f"#{t.get('id')}\t{heading}")
        return 0
    if cmd == "new-id":
        print(max((t["id"] for t in tickets if isinstance(t.get("id"), int)), default=0) + 1)
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
