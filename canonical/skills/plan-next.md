---
spec_version: 1
status: active
name: plan-next
description: Suggest the next step to work on based on recent commits, governance findings, and project state. Use at session start when the user wants direction, or after completing a milestone to decide where to focus next.
purpose: |
  At the start of a session or after finishing a task, choosing what to work on
  next requires synthesizing multiple signals: what just shipped, what governance
  flags are active, what the roadmap says is next. This skill does that synthesis
  and presents a prioritized recommendation, so the agent doesn't drift into
  the wrong work.

applicable_phases: [cross-phase]

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
  - the project's plan-next context stub (small file auto-refreshed on commits)
  - the project's last-session compact artefact (commit-level detail)
  - the project's analyser's structural summary (hot files, violation counts)
  - recent git log
  - governance audit findings (errors + warnings)

writes:
  - structured recommendation output (to chat; no filesystem writes)

invokes_skills: []
invokes_agents: []

trigger_phrases:
  - "/plan-next"
  - "what should I do next"
  - "what's the priority"
  - "suggest next step"
---

# Plan Next

Analyze recent project activity and governance state to recommend the highest-value next step.

## Overview

Auto-discover the right next feature based on roadmap state, in-flight epics, governance findings, and recent commits. Surfaces a prioritized recommendation; doesn't auto-start work.

## When to Use

- At session start when you're unsure what to work on
- Before `/sdlc` with no argument (`plan-next` produces the argument)
- When rotating focus across multiple in-flight tracks
- After completing a milestone and choosing the next push

**When NOT to use:**
- When you already know exactly what to build — just call `/sdlc "feature description"`
- For strategic, multi-feature planning at higher altitudes — use a wave-planning skill instead
- When governance has error-severity findings — fix those first regardless of this skill's output

## Why this skill exists

At session start or after finishing a task, choosing what to work on requires synthesizing multiple signals. This skill does the synthesis once and produces a prioritized recommendation, so the agent doesn't pick the wrong work because of missing context.

## Input sources (in priority order)

### 1. Plan-next context stub (primary — always read this first)

Read the project's plan-next context stub — a ≤40-line file regenerated on every commit (contract: `canonical/plan-next-stub.schema.md`; a worked-example refresher ships at `governance/plan-next-stub.refresher.example.mjs`, which scans `dev/epics/*/epic.md` statuses + git + the last audit). Contains: current milestone, next unstarted items, epic status (authoritative), active seam advisories, governance summary.

**Epic status takes precedence over "Next unstarted items":** the `## Epic status` section is scanned directly from `dev/epics/*/epic.md` on every commit and is always current. The "Next unstarted items" section comes from a roadmap file which may lag — treat it as advisory only. When the two conflict, trust Epic status.

**Routing from Epic status:** map each epic's status to its phase using the canonical **Epic-status routing** table (`canonical/phases.md` §"Epic-status routing") — the single source of truth the `sdlc` orchestrator also consumes (ADR-0011, closes F15). `plan-next` reads that table; it does not keep its own copy (this is the deduplication F15 named). A `Shipped` epic is skipped (do not re-suggest); routing then continues to the next unstarted epic.

**Read this file and stop here unless** the user asks something that requires commit-level detail — only then proceed to sources 2 or 3.

### 1b. Structural signal from your analyser

After reading the stub, get grounded structural data from whatever analyser your project uses. Two common surfaces:
- **MCP tool** (if the analyser exposes one): call it directly with `{ repo: '.', format: 'summary' }` or your tool's equivalent.
- **CLI fallback**: invoke the analyser's CLI to emit the same compact summary.

The output should give you, at minimum: a hot-file list (the ~20% of files carrying the bulk of import traffic) and a violation count. Use the hot-file list to **rank roadmap candidates by structural risk**: if the recommended next epic touches a hot file, flag it as higher-risk and surface that in the output.

### 2. Session compact (for commit-level detail only)

Read your project's last-session compact artefact only when source 1 is insufficient. Contains: changedFiles, diffSummary, lastCommitMessage, governanceFindings (top-5).

### 3. Live audit (fallback — only if both files are missing or >1 hour old)

```bash
# Recent commits
git log --oneline -5

# Governance findings — invoke your project's audit script, then summarise:
# count errors, list seam advisories by rule id, count warnings.
```

**Do not read your project's roadmap or refactor-plan files in full** — the stub contains their essential content. Reading those files directly defeats the context-growth guardrail.

## Analysis framework

Evaluate each candidate next step on three dimensions:

1. **Urgency**: Does governance flag it? Is it blocking other work? Is there a deadline?
2. **Value**: Does it ship user-facing improvement? Does it reduce tech debt? Does it unblock a milestone?
3. **Risk**: How likely is regression? How much existing behavior does it touch? Is there test coverage?

## Output format

```
## Recommended next step
[One sentence: what to do]

## Why
[2-3 sentences: what signals led to this recommendation]

## Sources used
- Stub: [path] (mtime: [timestamp]) — [used / not found / stale]
- Structural: [your analyser] — [used / skipped]
- Live audit: git log / governance — [used / skipped]

## Alternatives considered
1. [Alternative A] — [why deprioritized]
2. [Alternative B] — [why deprioritized]

## Active governance warnings
- [advisory findings, if any]

## Suggested approach

Group steps into batches. Between batches, call out explicit gates:

**Batch 1** — [what changes]
- step
- Gate: [test command or manual check]

**Batch 2** — [what changes]
- step
- Gate: [test command or manual check]
```

## Guardrails

- Recommendations must be concrete and actionable — not "improve performance" but "extract X from Y per the refactor plan."
- If governance has error-severity findings, always recommend fixing those first regardless of roadmap priorities.
- If the roadmap has a clear "next" item marked Not Started, bias toward that unless governance findings override.
- Never recommend skipping tests or governance gates to go faster.
- If you don't have enough context to recommend confidently, say so and ask the user what they're trying to accomplish.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll just pick the first thing in the roadmap" | The roadmap may be stale. Read the stub first. |
| "Governance warnings are nice-to-have" | Error-severity findings block; addressing them is always P0. |
| "I know what to do without reading the stub" | The stub takes 5 seconds to read; trust it over recall. |

## Red Flags

- Recommending work that touches a hot file without acknowledging the structural risk.
- Skipping the stub and reading full roadmap files (context-growth violation).
- Outputting recommendations as paragraphs of prose instead of the structured format.

## Verification

- [ ] Recommendation is concrete (file paths, specific change, gate).
- [ ] Sources-used section lists every source consulted.
- [ ] Governance errors (if any) appear in the recommendation.
- [ ] Alternatives section names ≥1 alternative that was considered + rejected.
