#!/usr/bin/env bash
# governance-gate.sh — PreToolUse hook (engine-backed).
#
# Thin wrapper: forwards the Claude Code / Copilot PreToolUse payload on stdin
# to the scaffold's rules engine, which evaluates `enforcement: [hook]` rules
# from governance.yaml and exits 0 (allow) or 2 (block, reason on stderr).
#
# Only error-severity findings block a write. warn/audit findings are recorded
# by the engine's audit pass + ratchet, not the write-time gate. To make a rule
# block at write time, give it `severity: error` + `enforcement: [hook]` (see
# R2b_tdd_test_first in governance.yaml.example).
#
# Wire it in .claude/settings.json under PreToolUse:
#   {
#     "PreToolUse": [
#       {
#         "matcher": "^(Write|Edit)$",
#         "hooks": [
#           { "type": "command", "command": "bash governance/hook.example.sh" }
#         ]
#       }
#     ]
#   }
#
# Tier 2/3 tools (Cursor, Codex, Aider, Continue) have no write-time hook
# surface; they run `node engine/dist/cli.js audit --staged` at git
# pre-commit instead. Same engine, different invocation point (ADR-0004).

set -euo pipefail

# Resolve the engine relative to this script. Adopters who vendor the engine
# elsewhere edit ENGINE_CLI to point at their built dist/cli.js.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_CLI="${ENGINE_CLI:-$SCRIPT_DIR/../engine/dist/cli.js}"

if [ ! -f "$ENGINE_CLI" ]; then
  echo "GOVERNANCE HOOK ERROR: engine not built at $ENGINE_CLI" >&2
  echo "  run: pnpm -F @reliability-scaffold/engine build" >&2
  # Fail open (exit 0) so a missing build doesn't wedge every Write/Edit.
  # Flip to 'exit 2' if you want a missing engine to hard-block instead.
  exit 0
fi

exec node "$ENGINE_CLI" hook
