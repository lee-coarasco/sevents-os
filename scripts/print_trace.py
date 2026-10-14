#!/usr/bin/env python3
"""Print a readable step-by-step trace from a Claude Code stream-json log.

Reads the JSONL file run.sh captures (one `claude -p --output-format
stream-json --verbose` event per line) and prints a compact outline:
which subagent got delegated to (Task tool calls), which files were
read/written, which shell/MCP commands ran, and what the agent said.
Indentation follows `parent_tool_use_id` — nested lines are activity
that happened inside a subagent's own Task invocation, which is how
agent-to-agent delegation shows up in the raw log.

Best-effort only: this is a debugging aid, not the source of truth —
run.sh's own success/failure/rate-limit detection does not depend on
this script, and a parsing hiccup here should never fail the session.
"""
import json
import sys

MAX_LEN = 160


def truncate(s: str, n: int = MAX_LEN) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


def describe_tool_use(name: str, inp: dict) -> str:
    if name == "Task":
        subagent = inp.get("subagent_type", "?")
        desc = inp.get("description", "")
        return f"Task -> {subagent}: {truncate(desc)}"
    if name in ("Read", "Write"):
        return f"{name} {inp.get('file_path', '')}"
    if name == "Edit":
        return f"Edit {inp.get('file_path', '')}"
    if name == "Bash":
        return f"Bash: {truncate(inp.get('command', ''))}"
    if name.startswith("mcp__"):
        return f"{name} {truncate(json.dumps(inp))}"
    return f"{name} {truncate(json.dumps(inp))}"


def main(path: str) -> None:
    # ids of Task tool_use blocks -> depth, so nested activity indents
    # one level under the subagent that spawned it.
    task_ids: dict[str, int] = {}
    step = 0

    print("\n=== Session trace:", path, "===")
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                t = obj.get("type")
                parent = obj.get("parent_tool_use_id")
                depth = task_ids.get(parent, 0) + 1 if parent else 0
                indent = "  " * depth

                if t == "system" and obj.get("subtype") == "init":
                    print(f"[init] model={obj.get('model')} agents={obj.get('agents')}")
                    continue

                if t == "assistant":
                    for block in obj.get("message", {}).get("content", []):
                        btype = block.get("type")
                        if btype == "tool_use":
                            step += 1
                            name = block.get("name", "?")
                            desc = describe_tool_use(name, block.get("input", {}) or {})
                            # Every Anthropic tool_use id shares the same
                            # "toolu_01..." prefix, so a truncated id isn't
                            # actually distinguishing — a step counter is.
                            print(f"{indent}[{step}] {desc}")
                            if name == "Task":
                                task_ids[block.get("id")] = depth
                        elif btype == "text":
                            text = block.get("text", "").strip()
                            if text:
                                print(f"{indent}says: {truncate(text)}")
                    continue

                if t == "result":
                    print(
                        f"[result] turns={obj.get('num_turns')} "
                        f"cost=${obj.get('total_cost_usd')} "
                        f"error={obj.get('is_error')} "
                        f"reason={obj.get('subtype')}"
                    )
    except FileNotFoundError:
        print(f"(no log file at {path})")
    except Exception as e:  # noqa: BLE001 - best-effort diagnostic only
        print(f"(trace printing failed, non-fatal: {e})")
    print("=== end trace ===\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: print_trace.py <path-to-stream-json-log>", file=sys.stderr)
        sys.exit(0)  # never fail the calling script over this
    main(sys.argv[1])
