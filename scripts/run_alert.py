#!/usr/bin/env python3
"""Slack alert for a workflow run that failed, timed out or couldn't start.

Called by run-alerts.yml (on: workflow_run) with the finished run's details in
the environment. Cancelled runs are not alerted: they were stopped on purpose
(from the dashboard or GitHub). The alert names the jobs and steps that failed
and links to the run, so the owner knows where to look without opening logs.

Environment:
  RUN_ID, RUN_NAME, RUN_CONCLUSION, RUN_EVENT, RUN_URL   from the workflow_run event
  GH_REPO, GH_TOKEN                                       to list the run's jobs (gh api)
  SLACK_WEBHOOK_URL                                       where to send; printed when unset
  NOTIFY_DASHBOARD_URL (appyard.env, optional)            adds a link to the dashboard's Runs page

Usage: run_alert.py [--dry-run]   (--dry-run prints the message and sends nothing)
"""
import json
import os
import subprocess
import sys
import urllib.request

ALERT_ON = {"failure", "timed_out", "startup_failure"}
EVENTS = {"schedule": "scheduled run", "workflow_dispatch": "started by hand", "workflow_call": "called by another workflow"}


def failed_steps(repo: str, run_id: str) -> list[str]:
    """'job → step' for every job that didn't succeed. Best effort: [] when the API can't be read."""
    try:
        out = subprocess.run(
            ["gh", "api", f"repos/{repo}/actions/runs/{run_id}/jobs?per_page=100"],
            capture_output=True, text=True, check=True, timeout=60,
        ).stdout
        jobs = json.loads(out).get("jobs", [])
    except (OSError, subprocess.SubprocessError, ValueError):
        return []
    found = []
    for job in jobs:
        if job.get("conclusion") not in ALERT_ON:
            continue
        steps = [s["name"] for s in job.get("steps") or [] if s.get("conclusion") in ALERT_ON]
        if job.get("conclusion") == "timed_out" and not steps:
            steps = ["ran past its time limit"]
        found.append(f"{job['name']} → {', '.join(steps)}" if steps else job["name"])
    return found


def message(env: dict, steps: list[str]) -> str:
    name, conclusion = env.get("RUN_NAME", "A workflow"), env.get("RUN_CONCLUSION", "failure")
    how = EVENTS.get(env.get("RUN_EVENT", ""), env.get("RUN_EVENT", ""))
    head = {
        "timed_out": f"⏱️ *{name}* timed out",
        "startup_failure": f"❌ *{name}* couldn't start (usually a problem in the workflow file)",
    }.get(conclusion, f"❌ *{name}* failed")
    lines = [head + (f" ({how})." if how else ".")]
    if steps:
        lines.append("Where: " + "; ".join(steps[:4]) + ("; …" if len(steps) > 4 else ""))
    links = []
    if env.get("RUN_URL"):
        links.append(f"<{env['RUN_URL']}|Open the run on GitHub>")
    if env.get("NOTIFY_DASHBOARD_URL"):
        links.append(f"<{env['NOTIFY_DASHBOARD_URL'].rstrip('/')}/runs|Runs in AppYard>")
    if links:
        lines.append("   |   ".join(links))
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    env = dict(os.environ)
    if env.get("RUN_CONCLUSION") not in ALERT_ON:
        print(f"Run ended '{env.get('RUN_CONCLUSION')}': no alert.")
        return 0
    text = message(env, failed_steps(env.get("GH_REPO", ""), env.get("RUN_ID", "")))
    hook = env.get("SLACK_WEBHOOK_URL", "")
    if "--dry-run" in argv or not hook:
        print(text)
        return 0
    req = urllib.request.Request(hook, json.dumps({"text": text}).encode(), {"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=30).read()
    print("Sent the failure alert to Slack.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
