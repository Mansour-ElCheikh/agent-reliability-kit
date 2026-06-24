---
spec_version: 1
status: active
name: audit
description: Run a governance health check on the repository. Use to check repo health, review policy compliance, find boundary violations, detect naming issues, or run a pre-PR governance review.
purpose: |
  Periodic audits surface drift that incremental review misses. The rules
  engine's audit pass is read-only and cheap to run; this skill wraps it
  with severity-sorted output + suggested next actions. Also includes a
  hook-diagnostic flow for "why isn't the gate firing?" investigations.

applicable_phases: [audit]

requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: not_needed
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed
  session_lifecycle_hooks:
    level: not_needed

reads:
  - governance.yaml
  - project source files (per scope.include)
  - audit output (engine emits JSON findings)
  - hook log (for hook-diagnostic flow only)
  - .claude/settings.json or per-tool hook config (for hook-diagnostic flow only)

writes:
  - structured findings report (to chat; no filesystem writes by default)

invokes_skills: []
invokes_agents: []

trigger_phrases:
  - "/audit"
  - "audit"
  - "health check"
  - "governance check"
  - "is the repo clean?"
---

# Repo Governance Audit

Run a read-only governance audit against the live repository and present findings clearly.

## Overview

The human-facing **narration layer** over `reliability-engine audit` + the hook-diagnostic flow. The engine does the evaluation (reads `governance.yaml`, runs predicates, compares the ratchet); this skill runs it, presents the findings severity-sorted, diagnoses why the write-time hook didn't fire, and suggests next actions.

**This is not a second code review.** `review` inspects *a diff* before ship and gates the merge. `audit` inspects *the whole repo* on a cadence and is informational + ratchet-driven. They have different triggers, scopes, and gates — not two flavours of the same thing. If you want per-change feedback, use `review`; this skill is the engine's presentation layer, not a parallel reviewer.

## When to Use

- Before a release, milestone, or public flip
- On a weekly cadence to catch drift incrementally
- After any structural refactor to validate boundaries held
- When governance.yaml gains new rules and you need initial counts
- When investigating why the write-time hook didn't fire (hook-diagnostics flow)

**When NOT to use:**
- For per-file change feedback — `review` is faster and diff-scoped
- Before governance.yaml exists — bootstrap with `/scaffold` first
- As a substitute for the write-time hook — audit catches what bypassed the hook, not the other way around

## Steps

### 1. Run the engine

```bash
# the kit ships this engine (S6.3b):
node engine/dist/cli.js audit --format json     # or --format toon for LLM-context
# adopters who wired their own analyser substitute it here; the shape is the same
```

Exit codes: 0 clean, 1 error-severity findings, 2 ratchet exceeded. The JSON (or TOON) report lands in `.scaffold/audit-report.<ts>.<ext>`, findings severity-sorted (errors first, then warnings, then audit-only).

### 2. Summarize findings

Present findings grouped by severity. For each finding, show:
- Rule ID and description
- File path
- What's wrong

### 3. Assess overall health

Rate the repo as one of:
- **Clean** — zero errors, zero warnings
- **Healthy** — zero errors, some warnings
- **Needs attention** — errors present that block PRs

### 4. Suggest next steps

If there are actionable findings:
- For errors: suggest specific fixes
- For warnings: note them but don't block — these are advisory
- If cleanup is needed, suggest using `/refactor` with a proposed change map

## Policy sources

The audit checks rules defined in:
- `governance.yaml` (or wherever your project keeps it) — hard rules per the canonical governance rule schema
- Your project's steering file (e.g. CLAUDE.md) — soft rules (ADR format, stale references, documentation conventions)

## Example hard rule shapes

| Example rule | What it catches |
|------|----------------|
| Boundary | Only approved files may import a platform-specific API (e.g. `vscode`) |
| Legacy leaks | Production code can't import from `_legacy/` or `test-repos/` |
| Naming | Paths with discouraged fragments (old, copy, tmp, backup) |
| Test alignment | Source files without co-located test files |

## Hook diagnostics

If the user asks "why isn't the hook firing" or "inspect hook firing", run this diagnosis before anything else:

### Step 1 — Check recent log
```bash
tail -20 <your-hook-log-path>
```
Look for `INVOKE`, `PASS`, `BLOCKED`, or `CRASH` entries. If `INVOKE` never appears, the hook is not being called at all.

### Step 2 — Verify matcher coverage
Open `.claude/settings.json` (or your tool's equivalent hook-wiring file). Confirm `PreToolUse` (or the equivalent) has entries covering every tool surface that writes files (e.g. Claude Code's `Write`/`Edit`, plus other agent surfaces if used):

```json
{ "matcher": "^(Write|Edit)$", "hooks": [{ "type": "command", "command": "sh path/to/governance-gate.sh" }] }
```

### Step 3 — Smoke test the hook directly

Construct a synthetic tool payload that violates a known rule (e.g. a boundary rule), pipe it to the hook script, and confirm the hook exits non-zero with a `BLOCKED` message naming the rule id.

Example shape:
```bash
echo '{"tool_name":"Write","tool_input":{"filePath":"...","content":"..."}}' | sh path/to/governance-gate.sh
```
Expected on violation: non-zero exit + `BLOCKED: [<rule-id>] ...`

### Step 4 — Distinguish hook failure from empty commit
A `git commit` exit 1 after `git add <unchanged files>` is NOT a hook failure — it means nothing was staged.
Verify with `git diff --stat <file>` before blaming the hook chain.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I just audited yesterday; skip it" | Audits are cheap; skipping them after risky changes is how drift accumulates. |
| "Warnings can wait" | Warnings counted toward the ratchet keep accumulating until they error. Address them. |

## Red Flags

- Auditing before running tests. (Tests first; many "audit findings" are downstream of broken tests.)
- Ignoring the ratchet count drift across audit runs.

## Verification

- [ ] Audit run completed; findings recorded.
- [ ] Severity counts reported.
- [ ] Overall rating assigned.
- [ ] Next steps suggested for any errors.
