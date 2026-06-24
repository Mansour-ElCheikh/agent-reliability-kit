#!/usr/bin/env bash
# gate-hook.example.sh - OPTIONAL Stop-hook shape for the ship gate (ADR-0013).
#
# Copy + wire as a Stop hook to make a red ship gate block the agent from stopping until
# the suite + governance are green. This is the SHAPE; adopters wire it (like hook.example.sh).
#
# Wire in .claude/settings.json:
#   "Stop": [ { "hooks": [ { "type": "command",
#       "command": "bash /abs/path/to/governance/gate-hook.example.sh", "timeout": 120 } ] } ]
#
# COST: a Stop hook fires on EVERY agent stop, so this runs the full suite each turn. For a
# large suite, prefer invoking `reliability-engine gate` at the ship step (sdlc/review skill)
# instead, or keep the "Built epic only" guard below so it runs only when a ship is imminent.
#
# Fail-open: any hook error lets the session stop (a buggy gate hook must never trap a session).

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ENGINE_CLI="${SCAFFOLD_ENGINE_CLI:-$REPO_ROOT/engine/dist/cli.js}"

# Guard (recommended): only gate when an epic is at **Status:** Built (a ship is imminent),
# so the suite does not run on every unrelated stop. Remove to gate on every stop.
if ! grep -rIlqE '^\*\*Status:\*\*[[:space:]]*Built[[:space:]]*$' "$REPO_ROOT"/dev/epics/*/epic.md 2>/dev/null; then
  exit 0   # no epic awaiting ship; nothing to gate
fi

# Need the built engine; if it is absent, do not silently pass (F3) - say so and let the stop
# proceed (the ship-step `reliability-engine gate` invocation remains the enforced path).
if [ ! -f "$ENGINE_CLI" ]; then
  echo "gate-hook: engine CLI not found at $ENGINE_CLI (run 'pnpm -F @reliability-kit/engine build'); skipping Stop-gate" >&2
  exit 0
fi

# --stop-hook prints {"decision":"block","reason":...} on a red gate (the harness makes the
# agent continue and fix) and nothing on a green gate. Always exit 0; the JSON does the block.
node "$ENGINE_CLI" gate --repo-root "$REPO_ROOT" --stop-hook 2>/dev/null || true
exit 0
