---
id: 151
title: CI — health-check step after each deploy (roles: human)
status: next
roles: [human]
priority: 2
created: 2026-10-17
updated: 2026-10-17
---

Add a health-check step to the existing GitHub Actions deploy workflow so that
every deploy to Vercel is verified with a live HTTP ping before reporting success.

## Why
Backend is deployed at https://sevents-os.vercel.app but there is no automated
verification that the deploy succeeded and the server is responding. A broken
deploy currently goes unnoticed until someone manually checks.

## What to do
In `.github/workflows/` (agent cannot touch this directory — human only):

1. After the Vercel deploy step in the frontend workflow, add:
   ```yaml
   - name: Health-check deployed backend
     run: |
       sleep 15  # wait for cold start
       curl -f https://sevents-os.vercel.app/health || exit 1
   ```

2. Ensure the backend exposes `GET /health` returning `{ status: "ok" }` with
   HTTP 200. (The backend engineer can add this route — it doesn't touch the
   workflow file.)

## Backend change (agent can do this)
Add `GET /health` to /home/user/sevents-os/backend/src/index.ts:
```ts
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
```

## Notes
- `.github/workflows/` changes require a human to commit and push per CLAUDE.md
  (agent token has no workflows permission)
- This ticket is intentionally scoped small — the health endpoint is trivial,
  the workflow change is a one-liner

## Progress
- [x] GET /health endpoint already exists at /backend/src/routes/health.ts (returns { status, supabase })
- [ ] GitHub Actions workflow updated by human (curl -f https://sevents-os.vercel.app/health in deploy step)
