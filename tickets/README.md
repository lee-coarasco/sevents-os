# Tickets

The backlog: one file per ticket. Agents and people both work from here, and
the AppYard dashboard shows it as a board.

## The file

`tickets/<id, 4 digits>-<short-slug>.md`, e.g. `tickets/0072-wallet-recharge.md`:

```markdown
---
id: 72
title: Wallet recharge and withdrawals
status: next
roles: [backend-engineer, ui-designer]
priority: 3
created: 2026-09-20
updated: 2026-09-23
---

What to build and why, in plain words, with anything the next session needs.

## Acceptance
- [ ] what "done" means, checkable

## Progress
- 2026-09-23 14:05 IST: what this session did, what's left.
```

| Field | Values |
|---|---|
| `id` | a whole number, never reused; must match the file name. For a new ticket run `python3 scripts/tickets.py new-id` |
| `title` | one line |
| `status` | `next` (ready to pick up), `in-progress`, `blocked` (say why and on whom in Progress), `testing` (built, waiting for the owner to try it), `done` |
| `roles` | any of `architect`, `ui-designer`, `backend-engineer`, `test-engineer`, `devops`, `human`. Use `human` for owner actions |
| `priority` | 1 = first. Required unless `done`. Several tickets can share a number |
| `created`, `updated` | `YYYY-MM-DD`. Set `updated` whenever you change the ticket |

## How sessions use it

- **Which ticket:** `python3 scripts/tickets.py next` names it: anything `in-progress` first, then `next`, lowest priority number first. Owner-only tickets (`roles: [human]`) are skipped; those are for people.
- **Starting:** set `status: in-progress` and `updated`.
- **While working:** add a dated line under `## Progress` whenever you commit something meaningful. That line is where the next session picks up, so say what's left.
- **Finishing:** set `testing` if the owner needs to try it on a device, `done` if not. Tick the acceptance boxes.
- **Stuck:** set `blocked`, and write why and on whom under Progress.
- **A decision only the owner can make:** ask it in the ticket, in a `## Needs approval` section (below), and set `blocked`. Only this ticket waits. The owner is told on Slack and answers from the AppYard dashboard; the answer arrives as a Progress note, the question is removed, and the ticket goes back to `next`. `NEEDS_APPROVAL.md` is only for a question that must stop all work.
- **New work you find:** a new ticket file, not a note in an existing one.
- **Before ending:** run `python3 scripts/tickets.py check` and fix what it reports. It fails a ticket that has a question but isn't `blocked`.

## Asking the owner

```markdown
## Needs approval
### 2026-09-24 20:10 IST — Which payout provider?
Razorpay or Cashfree. Razorpay: faster onboarding, 2% fee. Cashfree: 1.75%,
two-week KYC. Recommendation: Razorpay, because the pilot starts next week.
```

One `### <YYYY-MM-DD HH:MM TZ> — <short topic>` block per question, with the options, their tradeoffs and your recommendation. Put the section before `## Progress`. `python3 scripts/tickets.py questions` lists every open question.

People change tickets too, from the AppYard dashboard: status, priority, a note, or
a new ticket. Their notes appear under `## Progress` as
`<date> - <github login> (dashboard): ...`. Read those first: they are the owner's
own words (for example, "still broken on Android 13" after a phone test) and take
precedence over older notes. A ticket sent back from `testing` to `next` means the
owner tried it and it didn't work.

Session summaries go in `daily-log/`, not here. A ticket holds only what concerns
that ticket.
