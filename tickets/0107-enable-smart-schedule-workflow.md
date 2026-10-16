---
id: 107
title: Enable smart scheduling in GitHub Actions workflow
status: next
roles: [human]
priority: 2
created: 2026-10-16
updated: 2026-10-16
---

When a scheduled agent session hits the Claude usage-rate limit, the next
scheduled run fires anyway and immediately exits with the same limit error —
wasting a run and producing a confusing log line.

The `run.sh` already has smart-scheduling logic built in: when `SMART_SCHEDULE=true`,
it writes the reset timestamp to `kit/rate-limit-skip-until` and every subsequent
run skips itself until that time passes. The feature is dormant because
`SMART_SCHEDULE` is never set in the workflow.

## What the owner needs to do

In `.github/workflows/agent.yml`, find the `env:` block under "Run the agent
session" (around line 99) and add one line:

```yaml
      - name: Run the agent session
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          # ... existing env vars ...
          SMART_SCHEDULE: 'true'   # ← add this
        run: |
          chmod +x run.sh notify.sh
          ./run.sh
```

## What was already fixed (agent-side, in this session)

- Created `kit/` directory with a `.gitkeep` so the rate-limit file has
  somewhere to live.
- Added `mkdir -p "$PROJECT_DIR/kit"` before the write in `run.sh` (line 92)
  so the script never errors even if the directory is absent.

## Acceptance

- [ ] `SMART_SCHEDULE: 'true'` added to the workflow env block (human).
- [ ] Next rate-limit hit: agent writes `kit/rate-limit-skip-until`, subsequent
      runs skip until the reset time, then the file is deleted automatically.
