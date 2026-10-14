You are starting a brand-new software project. Your only job in this session is
to read PRD.md and generate the initial ticket backlog — do not write any
application code.

This session has a **${{MAX_BUDGET_USD}} budget**. If your running cost
approaches **${{NEAR_CAP_USD}}**, finish what you're on and stop.

## What to do

1. **Read PRD.md** in full.

2. **Create tickets/README.md** — one sentence that describes this repo's ticket
   format. Use this exact wording:
   > Each ticket is `NNNN-slug.md` (NNNN = zero-padded priority, lowest = highest).
   > Front matter: `id`, `title`, `status`, `created`, `updated`.
   > Status values: `next` · `in-progress` · `blocked` · `testing` · `done`.
   > Add `owner-only: true` for tickets that require the owner's action.

3. **Write one ticket file per deliverable** in tickets/.
   - Break the PRD into concrete, independently shippable tasks.
   - Aim for 5–20 tickets. A ticket too large should be split; don't create
     artificial splits just to hit a number.
   - Every ticket needs: a clear title, a short description, and 2–5 bullet-point
     acceptance criteria. No references to other ticket numbers in the body.
   - Priority 1 = the most foundational task everything else depends on.
   - Set status to `next` for any ticket the agent can start straight away.

4. **Create NEEDS_APPROVAL.md** with exactly this content (no other text):
   ```
   <!-- empty — nothing pending -->
   ```

5. **Create DECISIONS.md** with one entry recording that Phase 0 is done:
   ```markdown
   ## Phase 0 complete — YYYY-MM-DD
   Tickets generated from PRD.md. Ready to build.
   ```
   (Replace YYYY-MM-DD with today's date.)

6. **Commit everything** with message
   `Phase 0: generate tickets from PRD.md`
   and push.

## What NOT to do
- Do not write any application source code.
- Do not create or edit CLAUDE.md or appyard.env.
- Do not ask for clarification — make reasonable calls from the PRD.
- Do not leave uncommitted files at the end of the session.
