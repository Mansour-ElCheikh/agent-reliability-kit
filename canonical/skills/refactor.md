---
spec_version: 1
status: active
name: refactor
description: Plan and execute controlled repository refactors (moves, renames, restructuring) with governance guardrails. Use when the user wants to move files, rename modules, restructure directories, or execute a change map.
purpose: |
  Free-form refactors break reference graphs silently. This skill enforces
  a change-map gate (user-approved before execution) and a baseline-vs-final
  governance diff (no new regressions). Both prevent the most common
  refactor failures: missed reference updates and new boundary violations.

applicable_phases: [refactor]

requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: required
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed
  session_lifecycle_hooks:
    level: not_needed

reads:
  - governance.yaml (for scope rules + protected paths)
  - existing source files (to identify references before moves)
  - governance audit baseline (before changes)

writes:
  - moves/renames executed against the working tree
  - updated reference paths across the codebase
  - a refactor summary at session end (presented to user)

invokes_skills: []
invokes_agents: []

trigger_phrases:
  - "/refactor"
  - "restructure"
  - "move files"
  - "rename"
  - "cleanup"
---

# Governed Refactor

Execute controlled repository changes (moves, renames, restructuring) with safety guardrails.

## Overview

Plan and execute a controlled refactor (rename, move, file split, restructuring) with mechanical safety gates: change-map approval, baseline-vs-final governance diff, reference-update verification. Per-step gates prevent the "refactor broke prod" pattern.

## When to Use

- Renaming a symbol used in 5+ places
- Moving a file with imports across many consumers
- Restructuring a directory (splitting one module into two, merging two into one)
- Any refactor where rollback isn't trivial
- After identifying boundary violations during audit that need a structural fix

**When NOT to use:**
- For 1-line renames — just do it
- For exploratory restructuring without a clear target shape — sketch the destination first
- When tests are red — fix them before refactoring (refactor on green)
- For non-code changes (docs cleanup, asset moves) — those don't need this skill's gates

## Safety rules — non-negotiable

1. No destructive operations without explicit user approval
2. No moves/renames without presenting a change map first
3. Never modify paths outside policy scope defined in `governance.yaml`
4. Prefer minimal, reversible changes
5. Paths inside the project's protected source paths require explicit user approval before changes

## Workflow

### Step 1: Establish baseline

Run the project's governance audit (e.g. `npm run governance:audit` or whatever your project exposes). Note existing findings so we don't introduce regressions.

### Step 2: Propose change map

Present a change map to the user as a table:

| Action | From | To | Reason |
|--------|------|----|--------|
| move | old/path | new/path | why |
| rename | old-name | new-name | why |

Wait for user approval before proceeding. If any entry touches a protected path, explicitly flag it and ask for confirmation.

### Step 3: Execute changes

For each approved entry:
1. Execute the move/rename
2. Grep for all references to the old path across the codebase
3. Update every reference to point to the new path
4. Verify the file exists at the new location

### Step 4: Verify — zero regressions

Run the project's verification commands — build, test, and governance audit. Compare governance findings against the baseline from Step 1. If new errors appeared, fix them before finishing. Present a summary of what changed.

## When to split into batches

If the change map has more than 5 entries, split into batches of 3–5 and verify between each batch. This limits blast radius if something goes wrong.

## Reference update patterns

When updating references after a move, check these file types:
- Source files (`.ts`, `.tsx`, `.js`, `.py`, etc.) — import statements
- Markdown (`*.md`) — documentation links
- Config (`*.yaml`, `*.json`, `*.toml`) — config paths
- Top-level project docs — key file references

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll skip the change map for a small move" | Even one move can miss references. The change map takes 30 seconds; missed references take hours. |
| "Build is green; references must all be updated" | Type checkers don't catch every reference (e.g., dynamic imports, doc links). Grep before declaring done. |

## Red Flags

- Moves without a change map approval.
- Skipping the baseline-vs-final governance diff.
- Touching protected paths without explicit user confirmation.
- Batches larger than 5 without intermediate verification.

## Verification

- [ ] Change map presented + approved.
- [ ] All references updated (grep confirms zero stale paths).
- [ ] Build green; tests green.
- [ ] Governance audit: zero new errors vs baseline.
- [ ] Summary presented to user.
