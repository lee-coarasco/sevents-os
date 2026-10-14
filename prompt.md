You are continuing autonomous work on this software project across many
separate sessions. You have no memory of previous sessions except what is
written in these files. Start by reading, in order:

1. CLAUDE.md — the project spec, ground rules, and what you may decide
   yourself vs. what needs approval.
2. NEEDS_APPROVAL.md — if this contains unanswered questions, STOP. Do not
   write or change application code. Instead just report that you're
   blocked and on what, then end the session.
3. DECISIONS.md — past decisions, so you don't contradict them.
4. tickets/README.md — how the backlog works: one file per ticket in
   tickets/. Then run `python3 scripts/tickets.py next` to see which ticket
   to work on, and read that ticket's file in full.

Then:

- Work on the ticket `tickets.py next` names (anything in-progress first,
  then the lowest priority number). Set it to `status: in-progress` and
  update `updated` when you start.
- Work in small, testable increments. Commit to git after each meaningful
  change with a clear commit message — do not save up several tickets'
  worth of work for one commit at the end. Two things can end this session
  with no warning at all: the Claude account's own usage limit (a rolling
  window, unrelated to the dollar budget below, that can reject a request
  mid-turn with zero advance notice) and this run's own budget cap.
  Committing as you go is what actually protects the work when either one
  hits — a wrap-up write at the very end is too late if there's no "very
  end" to reach.
- This session has a **${{MAX_BUDGET_USD}} budget**. If you have a sense of your
  running cost and it reaches roughly **${{NEAR_CAP_USD}}**, stop starting new
  ticket work immediately: use whatever budget remains only to (1) commit and
  push anything safely finished, (2) add a dated line under the ticket's
  `## Progress` saying what's left, and set its status, and (3) write
  today's daily-log entry, including the "In
  plain words" block, so the owner isn't left with nothing to read. Do this
  before the cap cuts you off outright, not after.
- Write/update tests for anything you build. Run the test suite before
  marking anything done.
- **Never run anything in the background, and never stop to "wait" for it.**
  This session is unattended: nothing ever notifies you, so if you end your
  turn to wait for a background task, the session is over and the ticket is
  left half-done. Run tests, builds and installs in the foreground (use a
  long timeout if needed) and read their result in the same turn.
- If you hit a decision that CLAUDE.md says needs approval and it concerns one
  ticket, ask it IN THAT TICKET: add a `## Needs approval` section with one
  `### <YYYY-MM-DD HH:MM TZ> — <short topic>` block per question (the options,
  their tradeoffs and your recommendation), set the ticket to `status:
  blocked`, add a Progress line, commit, and move on to the next ticket. The
  owner is told at once and answers from the dashboard; the answer arrives as
  a Progress note and the ticket goes back to `next`. Only a question that must
  stop ALL work (it changes the whole product's direction, or every ticket
  depends on it) goes to NEEDS_APPROVAL.md instead: that pauses every session
  until it's answered, so use it rarely.
- Anything the owner must do (a key, an account, a device test) is a ticket
  with `roles: [human]`.
- New work you find is a new ticket file (`python3 scripts/tickets.py
  new-id` gives the number), not a note in another ticket. If no ticket is
  left, add the next logical set yourself based on the PRD/roadmap, in
  CLAUDE.md's spirit.

Before ending the session, always:
- Update every ticket you touched: `status` (next, in-progress, blocked,
  testing = built and waiting for the owner to try it, done), `updated`, and
  a dated line under `## Progress`. Then run `python3 scripts/tickets.py
  check` and fix anything it reports.
- Append a summary to daily-log/<TODAY'S DATE>.md covering: what you did,
  what you decided and why, what's blocked/pending approval, and what's
  next. Keep it readable — this is the summary a busy human will skim.
  This project runs on a schedule of multiple sessions per day, so a
  date-only file is not enough to tell sessions apart: run `date +'%Y-%m-%d
  %H:%M %Z'` and start your entry with that exact heading, e.g.
  `## 2026-09-17 14:32 GST — <one-line label for this session>` (label
  it by role/focus, e.g. "architect — Sprint 1 breakdown"), separated
  from the previous entry with a `---` line. Always append your entry at
  the END of the file (never insert it at the top): notifications send
  only the entries added during your run, found by their `## <timestamp>`
  heading. If you write no entry, the owner is told the session wrote none.
  IMMEDIATELY under that heading, before anything technical, write this
  block for the owner (a non-technical reader who will see it on Slack
  after every session and then test the app). Use EXACTLY this heading so
  Slack shows it first as its own section:

  `### In plain words (for the owner)`
  - **What got done:** 2-4 short bullets, everyday words, no ticket numbers, table names,
    function names or jargon. Say what the app can do now that it could not before.
  - **What you can test now:** FIRST line says whether a new build is needed to see
    it, in the form CLAUDE.md's "How the owner tests" section gives. Then numbered
    steps a non-technical person can follow, each naming the app role, the screen or
    button to tap, and what they should SEE if it works and what would mean it is
    broken. Say honestly if nothing is visible yet ("behind the scenes only, nothing
    to test").
  - **What I need from you:** any decision, key, account setup or test result the owner must
    give, or "Nothing".
  - **Coming next:** one plain sentence.
  Keep the whole block under about 900 characters (Slack cuts long sections). Then the
  technical details follow under the block as before. Use the same
  `YYYY-MM-DD HH:MM <TZ>` timestamp format (not date-only) for any new
  entries you add to DECISIONS.md or questions you add to
  NEEDS_APPROVAL.md, for the same reason.
