#!/usr/bin/env bash
# Runs one Claude Code headless session on the project and sends a summary.
# Intended to be called by cron or GitHub Actions. Safe to run multiple times a
# day; it just continues whatever tickets/ says is next. Behaviour is documented in the
# AppYard kit's SPEC.md ("run.sh").

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# shellcheck disable=SC1091
[ -f "$PROJECT_DIR/appyard.env" ] && . "$PROJECT_DIR/appyard.env"
MAX_BUDGET_USD="${AGENT_MAX_BUDGET_USD:-10.00}"
TZ_LABEL="${AGENT_TZ_LABEL:-$(date +%Z)}"
export AGENT_NEAR_CAP_USD="${AGENT_NEAR_CAP_USD:-9.0}"
MAX_BUDGET_RETRIES="${AGENT_MAX_BUDGET_RETRIES:-2}"
ALLOWED_TOOLS="${AGENT_ALLOWED_TOOLS:-Edit,Bash(git *),Bash(npm *),Bash(node *),Bash(python3 *),WebFetch,WebSearch}"
MAIN_BRANCH="${AGENT_MAIN_BRANCH:-main}"
DAILY_BUDGET="${AGENT_DAILY_BUDGET_USD:-}"
# 1 = after a session ends normally, start another in the same run while a ticket
# is ready and the session produced work (see "keep going" below). 0 = one per run.
CONTINUE_WHILE_WORK="${AGENT_CONTINUE_WHILE_WORK:-1}"
# Phase 0: architect-only run triggered by the AppYard dashboard. Reads PRD.md
# and generates the initial ticket backlog. Skips working-hours and approval gates
# (neither applies before the project starts), uses phase0-prompt.md, and stops
# after one session regardless of CONTINUE_WHILE_WORK.
PHASE0="${INPUT_PHASE0:-false}"

# Smart scheduling: skip this run if a usage-limit cooldown is still active.
if [ "${SMART_SCHEDULE:-false}" = "true" ] && [ "$PHASE0" != "true" ]; then
  _SKIP_FILE="$PROJECT_DIR/kit/rate-limit-skip-until"
  if [ -f "$_SKIP_FILE" ]; then
    if python3 "$PROJECT_DIR/scripts/smart_schedule.py" check-skip "$_SKIP_FILE" 2>/dev/null; then
      echo "Claude usage limit still active. Smart scheduling: skipping run until $(cat "$_SKIP_FILE")."
      exit 0
    else
      rm -f "$_SKIP_FILE"
    fi
  fi
fi

# TZ is set by the caller (agent.yml), so every date below, the daily-log
# filename and the session's own `date` calls agree. %Z prints its label (IST, UTC, ...).
TODAY="$(date +%F)"
LOG_DIR="$PROJECT_DIR/logs"
# Headings already in today's daily log before this run: notify.sh sends only entries added after this.
export LOG_HEADINGS_BEFORE_FILE="$(mktemp)"
grep -h '^## ' "$PROJECT_DIR/daily-log/$TODAY.md" > "$LOG_HEADINGS_BEFORE_FILE" 2>/dev/null || true
mkdir -p "$LOG_DIR" "$PROJECT_DIR/daily-log"

# --- Working hours (AGENT_ACTIVE_HOURS / AGENT_EVERY_HOURS in appyard.env) ---
# The hourly cron stays as it is (it lives in a workflow file, which only people
# edit); a scheduled run that isn't due exits here, quietly: no session, no
# Slack message. A run started by hand (the dashboard's "Run now") always goes.
if [ "$PHASE0" != "true" ]; then
  if ! WHY="$(AGENT_ACTIVE_HOURS="${AGENT_ACTIVE_HOURS:-}" AGENT_EVERY_HOURS="${AGENT_EVERY_HOURS:-}" python3 "$PROJECT_DIR/scripts/schedule.py" due)"; then
    echo "Not due ($WHY). Exiting without a session."
    exit 0
  fi
fi

# --- Guard: if NEEDS_APPROVAL.md has unanswered questions, don't burn tokens ---
# (crude check: file has more than just the template's empty-state line)
# Skipped in Phase 0: NEEDS_APPROVAL.md doesn't exist yet.
if [ "$PHASE0" != "true" ] && ! grep -q "empty — nothing pending" "$PROJECT_DIR/NEEDS_APPROVAL.md"; then
  echo "NEEDS_APPROVAL.md has pending questions. Skipping build run, sending reminder."
  BLOCK_MSG="⏸️ Agent is blocked waiting on your approval. Check NEEDS_APPROVAL.md."
  if [ -n "${SLACK_WORKFLOW_LINK:-}" ]; then
    BLOCK_MSG="$BLOCK_MSG
Reply here: $SLACK_WORKFLOW_LINK"
  fi
  "$PROJECT_DIR/notify.sh" "$BLOCK_MSG"
  exit 0
fi

# Commits any uncommitted changes AND pushes, unconditionally, after every
# attempt (success, budget retry, or failure): a session cut off by the cap
# still leaves real changes, and the next attempt should start clean.
#
# The push must not depend on there being something to stage now: a session
# often commits its own work last, leaving a clean tree, and skipping the push
# then strands that commit on a runner that is thrown away (DAS-X, 2026-09-18:
# ticket #23's files were lost for good this way).
# Smart scheduling: when SMART_SCHEDULE=true and a rate-limit run fires, write
# the reset time to kit/rate-limit-skip-until so subsequent runs skip until then.
_write_skip_until() {
  local log_file="$1"
  local skip_until
  skip_until="$(python3 "$PROJECT_DIR/scripts/smart_schedule.py" skip-until "$log_file" 2>/dev/null)" || return 0
  [ -z "$skip_until" ] && return 0
  echo "$skip_until" > "$PROJECT_DIR/kit/rate-limit-skip-until"
  git add kit/rate-limit-skip-until
  git diff --cached --quiet || git commit -m "Smart schedule: skip until $skip_until"
  push_with_retry || true
  echo "Smart scheduling: next runs skipped until $skip_until."
}

commit_and_push() {
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "Agent session $(date +'%Y-%m-%d %H:%M %Z')"
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    push_with_retry
  fi
}

# Pushes HEAD to its branch on origin. Someone else may have pushed since this run
# checked out, which makes a plain push fail - and the runner's commits die with
# it (DAS-X, 2026-09-19). So: rebase onto the latest branch and retry; if the
# rebase conflicts, push the work to a rescue branch instead of losing it.
push_with_retry() {
  local i
  for i in 1 2 3; do
    if git push origin HEAD; then
      return 0
    fi
    echo "Push rejected (attempt $i/3) - rebasing onto latest $MAIN_BRANCH and retrying."
    if ! git pull --rebase --autostash origin "$MAIN_BRANCH"; then
      git rebase --abort 2>/dev/null || true
      break
    fi
  done
  local rescue="agent-rescue-$(date +%Y%m%d-%H%M%S)"
  if git push origin "HEAD:refs/heads/$rescue"; then
    echo "Could not update $MAIN_BRANCH; saved this run's commits to branch $rescue."
    "$PROJECT_DIR/notify.sh" "⚠️ Agent work couldn't be merged into $MAIN_BRANCH automatically (conflict). Saved to branch $rescue - needs a manual merge."
  else
    echo "Warning: git push failed AND the rescue branch push failed, check manually."
  fi
  return 1
}

# prompt.md carries {{MAX_BUDGET_USD}} / {{NEAR_CAP_USD}} placeholders so the
# numbers the agent is told match the cap actually enforced - including a
# smaller last session of the day, where the wrap-up point scales down too.
PROMPT_FILE="$PROJECT_DIR/$([ "$PHASE0" = "true" ] && echo "phase0-prompt.md" || echo "prompt.md")"

prompt_for() {
  local budget="$1" near="$AGENT_NEAR_CAP_USD"
  if [ "$budget" != "$MAX_BUDGET_USD" ]; then
    near="$(python3 -c "import sys; print(f'{float(sys.argv[1]) * 0.9:.2f}')" "$budget")"
  fi
  sed -e "s/{{MAX_BUDGET_USD}}/$budget/g" -e "s/{{NEAR_CAP_USD}}/$near/g" -e "s/{{TZ_LABEL}}/$TZ_LABEL/g" "$PROMPT_FILE"
}

LEDGER="$PROJECT_DIR/scripts/usage_ledger.py"

# Files the pipeline owns: the settings (which hold the daily limit) and the
# usage ledger. A session that edits them could raise its own limit, so their
# state at PROTECT_BASE is put back after every session. PROTECT_BASE moves
# forward after each commit, so run.sh's own ledger lines are kept.
PROTECTED=(appyard.env usage/ledger.tsv)
PROTECT_BASE="$(git rev-parse HEAD)"
protect_pipeline_files() {
  local p changed=()
  for p in "${PROTECTED[@]}"; do
    if [ -n "$(git diff --name-only "$PROTECT_BASE" -- "$p")" ] || [ -n "$(git status --porcelain -- "$p")" ]; then
      changed+=("$p")
      if git cat-file -e "$PROTECT_BASE:$p" 2>/dev/null; then
        git checkout "$PROTECT_BASE" -- "$p"
      else
        git rm -q --cached --ignore-unmatch -- "$p"
        rm -f -- "$p"
      fi
    fi
  done
  if [ ${#changed[@]} -gt 0 ]; then
    echo "The session edited pipeline-owned files (${changed[*]}); put them back."
    "$PROJECT_DIR/notify.sh" "⚠️ The agent session edited ${changed[*]}, which only people may change. Put back as they were."
  fi
}

# Daily usage limit (AGENT_DAILY_BUDGET_USD, estimated dollars; empty = none).
# Checked before every session against usage/ledger.tsv. A session never gets
# more budget than is left for the day, so the limit can't be overshot by a
# whole session. When it is reached the run stops, and Slack hears about it
# once per day (the "capped" ledger line remembers that it was said).
session_budget_or_stop() {
  SESSION_BUDGET="$MAX_BUDGET_USD"
  [ -n "$DAILY_BUDGET" ] || return 0
  SESSION_BUDGET="$(python3 "$LEDGER" session-budget "$DAILY_BUDGET" "$MAX_BUDGET_USD")"
  if [ "$SESSION_BUDGET" = "0.00" ]; then
    local spent
    spent="$(python3 "$LEDGER" spent-today)"
    echo "Daily usage limit reached: \$$spent of \$$DAILY_BUDGET estimated today. Skipping until tomorrow."
    if ! python3 "$LEDGER" capped-today; then
      python3 "$LEDGER" mark-capped
      commit_and_push
      "$PROJECT_DIR/notify.sh" "🛑 Daily usage limit reached: \$$spent of \$$DAILY_BUDGET estimated today. The agent pauses until midnight. The limit can be changed in the AppYard dashboard."
    fi
    exit 0
  fi
}

# Hitting --max-budget-usd is NOT an account-level usage limit: the cap is per
# session, so a fresh session gets a fresh budget at once. Retry in this same
# job, up to MAX_BUDGET_RETRIES extra times (each retry starts from whatever the
# previous attempt already committed, so no work is redone).
attempt=0

# Owner questions inside tickets ("## Needs approval"): one "#<id><TAB><heading>"
# line each. New ones after a session are sent to Slack straight away.
ticket_questions() {
  [ -d "$PROJECT_DIR/tickets" ] || return 0
  PYTHONIOENCODING=utf-8 python3 "$PROJECT_DIR/scripts/tickets.py" questions "$PROJECT_DIR/tickets" 2>/dev/null | tr -d '\r' | sort || true
}

while true; do
  attempt=$((attempt + 1))
  session_budget_or_stop
  NOW="$(date +'%Y-%m-%d %H:%M:%S %Z')"
  # .jsonl: --output-format stream-json emits one event per line - the full
  # transcript, including subagent delegation. scripts/print_trace.py reads it.
  RUN_LOG="$LOG_DIR/run-$TODAY-$(date +%H%M%S)-attempt$attempt.jsonl"

  echo "Starting Claude Code session (attempt $attempt, budget \$$SESSION_BUDGET) at $NOW..."

  # In non-interactive -p mode this --allowedTools list is the permission gate
  # that is actually enforced; a subagent's own frontmatter can only narrow it.
  SESSION_OK=true
  SESSION_START="$(git rev-parse HEAD)"
  QUESTIONS_BEFORE="$(ticket_questions)"
  claude -p "$(prompt_for "$SESSION_BUDGET")" \
    --output-format stream-json \
    --verbose \
    --permission-mode acceptEdits \
    --allowedTools "$ALLOWED_TOOLS" \
    --max-budget-usd "$SESSION_BUDGET" \
    > "$RUN_LOG" 2>&1 || SESSION_OK=false

  # Best-effort diagnostic — never fails the script over a parse hiccup.
  python3 "$PROJECT_DIR/scripts/print_trace.py" "$RUN_LOG" || true

  # Did the session produce any work? (its own commits, or changes it left
  # uncommitted; pipeline files don't count). Decides whether to keep going.
  WORK_DONE=0
  if [ "$(git rev-parse HEAD)" != "$SESSION_START" ] \
    || [ -n "$(git status --porcelain -- . ':(exclude)usage/ledger.tsv' ':(exclude)appyard.env')" ]; then
    WORK_DONE=1
  fi

  # Whatever the outcome: undo edits to pipeline files, record this session's
  # usage, then commit and push (so a retry, or the next run, starts clean).
  protect_pipeline_files
  REASON="$(python3 "$PROJECT_DIR/scripts/classify_result.py" "$RUN_LOG")"
  python3 "$LEDGER" record "$RUN_LOG" "$REASON" "$attempt"
  # Ticket files must stay machine-readable: the dashboard's board reads them.
  # A bad file is reported, not reverted (it's the session's own work).
  if [ -d "$PROJECT_DIR/tickets" ] && ! TICKET_PROBLEMS="$(python3 "$PROJECT_DIR/scripts/tickets.py" check "$PROJECT_DIR/tickets")"; then
    echo "$TICKET_PROBLEMS"
    "$PROJECT_DIR/notify.sh" "⚠️ The session left ticket files that don't follow tickets/README.md:
$(printf '%s\n' "$TICKET_PROBLEMS" | head -6)"
  fi
  NEW_QUESTIONS="$(comm -13 <(printf '%s\n' "$QUESTIONS_BEFORE") <(ticket_questions) | grep . || true)"
  if [ -n "$NEW_QUESTIONS" ]; then
    WHERE="the ticket files (## Needs approval)"
    [ -n "${NOTIFY_DASHBOARD_URL:-}" ] && WHERE="<${NOTIFY_DASHBOARD_URL%/}/approvals|Approvals in AppYard>"
    "$PROJECT_DIR/notify.sh" "❓ The agent needs your decision. Only these tickets wait; other work carries on.
$(printf '%s\n' "$NEW_QUESTIONS" | sed -E 's/^#([0-9]+)\t([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9:]+( [A-Za-z0-9+-]+)? (—|-) )?/• #\1 /' | head -6)
Answer in $WHERE."
  fi
  commit_and_push
  PROTECT_BASE="$(git rev-parse HEAD)"

  if [ "$SESSION_OK" = "true" ]; then
    echo "Session finished. Raw output: $RUN_LOG"

    # An account-level usage-limit rejection can still exit 0: the CLI reports it
    # as data in its result, not as a process failure (DAS-X, 2026-09-23).
    if [ "$REASON" = "rate_limit" ]; then
      echo "Claude usage limit still active (not an error) — will retry at the next scheduled check. See $RUN_LOG"
      [ "${SMART_SCHEDULE:-false}" = "true" ] && _write_skip_until "$RUN_LOG"
      "$PROJECT_DIR/notify.sh" "⏳ Claude usage limit still active — skipping this run, will retry automatically at the next scheduled check."
      exit 0
    fi

    "$PROJECT_DIR/notify.sh"
    # Phase 0 stops here: tickets were just created; don't loop into a build session.
    [ "$PHASE0" = "true" ] && exit 0
    # The agent can stop itself just under the cap; that exits normally, so it
    # never counts as a cap hit. If it stopped for budget with work left, start a
    # fresh session now (DAS-X, 2026-09-21).
    # A session that ended its turn to "wait" for a background task never gets it
    # back in an unattended run: it just stops, mid-ticket (DAS-X, 2026-09-24).
    if [ "$REASON" = "stalled" ]; then
      echo "Session ended while waiting for a background task - its ticket may be half-done."
      "$PROJECT_DIR/notify.sh" "⚠️ The agent session ended while waiting for a background task (tests or a build), so its ticket may be half-done. A new session picks it up$([ "$CONTINUE_WHILE_WORK" = "1" ] && [ "$attempt" -le "$MAX_BUDGET_RETRIES" ] && echo " now" || echo " at the next run")."
    fi

    if [ "$attempt" -le "$MAX_BUDGET_RETRIES" ]; then
      # The agent can stop itself just under the cap; that exits normally, so it
      # never counts as a cap hit. If it stopped for budget with work left, start a
      # fresh session now (DAS-X, 2026-09-21).
      NEXT_REASON=""
      if [ "$REASON" = "budget_near" ]; then
        NEXT_REASON="Session stopped itself near the budget cap with work left"
      # Keep going: after a normal (or stalled) ending, start another session in
      # this run while a ticket is ready - but only if this session produced work,
      # so a session that finds nothing to do can't loop. The daily limit is
      # checked again before every session, and a run never has more than
      # MAX_BUDGET_RETRIES + 1 sessions.
      elif [ "$CONTINUE_WHILE_WORK" = "1" ] && { [ "$REASON" = "stalled" ] || [ "$WORK_DONE" = "1" ]; } \
        && [ -d "$PROJECT_DIR/tickets" ] \
        && python3 "$PROJECT_DIR/scripts/tickets.py" next "$PROJECT_DIR/tickets" | grep -q '^#'; then
        NEXT_REASON="Session ended ($REASON) and a ticket is ready: $(python3 "$PROJECT_DIR/scripts/tickets.py" next "$PROJECT_DIR/tickets" | cut -c1-120)"
      fi
      if [ -n "$NEXT_REASON" ]; then
        echo "$NEXT_REASON - starting a fresh session (attempt $((attempt + 1))/$((MAX_BUDGET_RETRIES + 1)))."
        # Only entries written from now on go out next time (no repeats of what was just sent).
        grep -h '^## ' "$PROJECT_DIR/daily-log/$TODAY.md" > "$LOG_HEADINGS_BEFORE_FILE" 2>/dev/null || true
        continue
      fi
    fi
    exit 0
  fi

  if [ "$REASON" = "budget_cap" ] && [ "$attempt" -le "$MAX_BUDGET_RETRIES" ]; then
    echo "Hit the per-session \$$SESSION_BUDGET budget cap (not a real usage limit) — a fresh session gets a new budget immediately. Retrying now (attempt $((attempt + 1))/$((MAX_BUDGET_RETRIES + 1)))."
    continue
  fi

  if [ "$REASON" = "budget_cap" ]; then
    echo "Hit the per-session budget cap $attempt times in a row this run — stopping here rather than retrying indefinitely. See $RUN_LOG"
    "$PROJECT_DIR/notify.sh" "⚠️ Hit the \$$MAX_BUDGET_USD per-session budget cap $attempt times in a row — stopping for now, will try again at the next scheduled check."
    exit 0
  fi

  if [ "$REASON" = "rate_limit" ]; then
    # Claude subscription usage is a rolling window: the next scheduled check,
    # once it has reset, picks the work back up.
    echo "Claude usage limit still active (not an error) — will retry at the next scheduled check. See $RUN_LOG"
    [ "${SMART_SCHEDULE:-false}" = "true" ] && _write_skip_until "$RUN_LOG"
    "$PROJECT_DIR/notify.sh" "⏳ Claude usage limit still active — skipping this run, will retry automatically at the next scheduled check."
    exit 0
  fi

  echo "Claude Code run exited with an error. See $RUN_LOG"
  # On GitHub with run-alerts.yml installed, the failed job brings a Slack alert
  # with the failing step and a link to the run; don't send a second message.
  if [ "${GITHUB_ACTIONS:-}" != "true" ] || [ ! -f "$PROJECT_DIR/.github/workflows/run-alerts.yml" ]; then
    "$PROJECT_DIR/notify.sh" "⚠️ The agent session errored out ($REASON). Its log: $RUN_LOG"
  fi
  exit 1
done
