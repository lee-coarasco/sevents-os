#!/usr/bin/env bash
# Sends a notification with this run's new daily-log entries, or a custom
# message passed as $1 (used for the "blocked on approval" / "error" cases).
# Behaviour is documented in the AppYard kit's SPEC.md ("notify.sh").
#
# Configure one or both via environment variables (GitHub secrets in CI):
#   SLACK_WEBHOOK_URL   - a Slack Incoming Webhook URL
#   NOTIFY_EMAIL        - an email address (requires `mail`/`sendmail` on the host)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
[ -f "$PROJECT_DIR/appyard.env" ] && . "$PROJECT_DIR/appyard.env"
TODAY="$(date +%F)"
LOG_FILE="$PROJECT_DIR/daily-log/$TODAY.md"
SLACK_MODE="--text"

if [ -n "${1:-}" ]; then
  MESSAGE="$1"
elif [ -f "$LOG_FILE" ]; then
  # Send only the entries THIS run added, found by their "## <timestamp>" heading
  # compared with the headings run.sh recorded before the session started
  # (LOG_HEADINGS_BEFORE_FILE). With no "before" file (a manual run) it sends the
  # newest entry only.
  MESSAGE="$(python3 "$PROJECT_DIR/scripts/new_log_entries.py" "$LOG_FILE")"
  if [ -z "$(printf '%s' "$MESSAGE" | tr -d '[:space:]')" ]; then
    MESSAGE="The agent session finished but wrote NO new entry in the daily log (usually it ran out of budget or time before summarising). Check the latest commits and the tickets it touched for what it did. Nothing new to test from this session's notes."
    SLACK_MODE="--text"
  else
    SLACK_MODE="--session"
  fi
else
  MESSAGE="No daily-log entry was written for $TODAY. Check the run manually."
fi

# --- Build the "latest links" footer included on every Slack message ---
# so the newest build/preview are always one tap away, not just on whichever
# run produced them. Best-effort: missing gh auth or no release yet just means a
# shorter (or empty) footer, never a failed notification.
SLACK_FOOTER=""
add_link() {
  if [ -n "$SLACK_FOOTER" ]; then
    SLACK_FOOTER="$SLACK_FOOTER   |   <$2|$1>"
  else
    SLACK_FOOTER="<$2|$1>"
  fi
}
if [ -n "${NOTIFY_RELEASE_LABEL:-}" ] && command -v gh >/dev/null 2>&1; then
  RELEASE_URL="$(gh release view --json url -q .url 2>/dev/null || true)"
  [ -n "$RELEASE_URL" ] && add_link "$NOTIFY_RELEASE_LABEL" "$RELEASE_URL"
fi
if [ -n "${NOTIFY_PREVIEW_URL_FILE:-}" ] && [ -f "$PROJECT_DIR/$NOTIFY_PREVIEW_URL_FILE" ]; then
  PREVIEW_URL="$(tr -d '[:space:]' < "$PROJECT_DIR/$NOTIFY_PREVIEW_URL_FILE")"
  [ -n "$PREVIEW_URL" ] && add_link "${NOTIFY_PREVIEW_LABEL:-🌐 Latest web preview}" "$PREVIEW_URL"
fi
if [ -n "${NOTIFY_LINKS:-}" ]; then
  IFS=';' read -ra PAIRS <<< "$NOTIFY_LINKS"
  for pair in "${PAIRS[@]}"; do
    label="${pair%%|*}"
    url="${pair#*|}"
    [ -n "$label" ] && [ -n "$url" ] && [ "$label" != "$pair" ] && add_link "$label" "$url"
  done
fi
export SLACK_FOOTER

if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  PAYLOAD="$(printf '%s' "$MESSAGE" | python3 "$PROJECT_DIR/scripts/slack_format.py" "$SLACK_MODE")"
  curl -s -X POST -H "Content-Type: application/json" \
    -d "$PAYLOAD" "$SLACK_WEBHOOK_URL" > /dev/null
  echo "Sent notification to Slack."
fi

if [ -n "${NOTIFY_EMAIL:-}" ]; then
  echo "$MESSAGE" | mail -s "Agent daily summary - $TODAY" "$NOTIFY_EMAIL" \
    && echo "Sent notification email to $NOTIFY_EMAIL"
fi

if [ -z "${SLACK_WEBHOOK_URL:-}" ] && [ -z "${NOTIFY_EMAIL:-}" ]; then
  echo "No SLACK_WEBHOOK_URL or NOTIFY_EMAIL set — printing summary instead:"
  echo "$MESSAGE"
fi
