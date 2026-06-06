---
spec_version: 1
status: active
name: plan
description: SDLC Phase 2 — Write plan.md and tasks.md for an approved epic. Reads epic + specs + adr, produces an ordered task table where each row is one TDD cycle. Includes coverage cross-check before presenting.
purpose: |
  Define produces intent; Plan produces the build sequence. Without Plan,
  Build phases pick task order ad-hoc and skip integration wiring. Plan
  forces a coverage check (every acceptance criterion maps to a task) and
  a Min-Invariant check (every task asserts a concrete domain fact, not
  a shape) — both prevent false-green tests downstream.

applicable_phases: [plan]

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
  - dev/epics/{epic}/adr.md (read first — do not re-plan a failed approach)
  - dev/epics/{epic}/epic.md (goal, specs table, acceptance criteria)
  - dev/epics/{epic}/specs/*.md (each spec file in full)
  - the project's architecture summary (e.g. CLAUDE.md Architecture section, analyser context artefact)
  - existing source files in the affected area

writes:
  - dev/epics/{epic}/plan.md
  - dev/epics/{epic}/tasks.md
  - updates to dev/epics/{epic}/epic.md Status

invokes_skills: []
invokes_agents: []

trigger_phrases:
  - "/plan"
  - "plan this epic"
  - "write the tasks"
  - "break down the spec"
---

# Plan Phase

Produce `plan.md` (architecture + per-spec approach) and `tasks.md` (ordered TDD task list) for an approved epic.

## Overview

After an epic is defined and approved, break it into an ordered, test-first task list. Produces `plan.md` (architecture + per-spec approach) + `tasks.md` (ordered TDD cycles with Min-Invariant assertions). Coverage cross-check + Min-Invariant cross-check both must pass before presenting.

## When to Use

- After `/spec` completes and the epic is approved
- When tasks.md needs re-planning (scope changed mid-flight or a build attempt produced failure entries in adr.md)
- For any epic with multiple components needing test-first sequencing

**When NOT to use:**
- Before the epic is defined — run `/spec` first
- For epics that are essentially one task — just code it
- When you intend to skip TDD — this skill enforces it; if that's wrong for your context, write tasks.md by hand

## Precondition

Read `dev/epics/{epic}/epic.md` → check `**Status:**` line.
- Status = `Approved` → proceed
- Anything else → "No approved epic found. Run `/spec` first."

## Context (Plan Mode — read-only)

Operate read-only until the plan is written. Do not edit source while planning; planning that drifts into implementation skips the step that would have told you what to plan. Read, in order:

1. `dev/epics/{epic}/adr.md` — **read first** — do not plan an approach already recorded as abandoned
2. `dev/epics/{epic}/epic.md` — goal, components/specs table, acceptance criteria
3. `dev/epics/{epic}/specs/*.md` — every spec file in full (Branch B epics; short)
4. The project's architecture summary (e.g. CLAUDE.md Architecture + Boundaries, or your analyser's context artefact) — dependency flow, boundary files
5. Explore the affected source to learn current patterns + conventions

Before writing the plan, produce two artefacts in your head (then onto the page in §Per-spec approach):

- **Dependency map:** which specs/components depend on which. Shared infrastructure first; dependents after. A spec that everything imports is planned + built before its consumers.
- **Risks + unknowns:** anything the spec leaves underspecified, any approach with a known failure mode (check adr.md), any boundary rule the work pressures. Name them now; an unknown surfaced at plan time is cheap, the same unknown surfaced mid-build is a re-plan.

## Write plan.md

Create `dev/epics/{epic}/plan.md`:

```markdown
# Plan — {epic name}

**Status:** Draft
**Date:** {YYYY-MM-DD}

## Architecture
{1–2 sentences: how this feature fits the existing layer structure}

## Tech Stack
{new dependencies required, or "no new dependencies"}

## File Structure
| File | Action | Purpose |
|---|---|---|
| src/... | create / modify | ... |

## Per-spec approach

### Spec 001 — {name}
**Approach:** {HOW this spec is implemented — 2–4 sentences, concrete}
**Files:** {comma-separated list of files this spec touches}
**Depends on spec:** {spec NNN, or "none"}
```

**Planning constraints (non-negotiable):**
- ADR decisions are architectural constraints — check `docs/decisions/` for relevant ADRs before writing approach
- Dependency flow is enforced — consult your project's layer rules (see `governance.yaml`). Never add a reverse import.
- Boundary rules: each project enumerates which files may import which platform APIs. Any new module needing a boundary API must inject it via an interface.
- Plan what the specs say. Nothing more.

## Write tasks.md

Create `dev/epics/{epic}/tasks.md`:

```markdown
# Tasks — {epic name}

**Status:** Draft

| # | Spec | Task | TDD Behavior | Min-Invariant | Status |
|---|---|---|---|---|---|
| 1 | 001 | {description} | given {context} when {action} then {outcome} | {concrete threshold or named fact} | Pending |
```

**Task rules:**
- One task = one TDD cycle (RED → GREEN → REFACTOR)
- Tasks within a spec: happy path first → edge cases → error handling
- If a task description contains "and": split into two tasks
- Cross-spec dependencies determine spec ordering; shared infrastructure tasks come first
- TDD Behavior column must be concrete: `given X when Y then Z` — no vague descriptions
- **Min-Invariant column is mandatory** (governed by rule `min_invariant_per_task`): must be a concrete value the test asserts — a count (`> 0`), a named fact (`contains 'workspaceRoot'`), a file path, or a specific value. Shape descriptions (`array`, `object`, `defined`, `valid JSON`) are forbidden — they pass against empty / wrong-shape data and are flagged by the `tasks_min_invariant` engine predicate. This column is what prevents false greens.

## Coverage cross-check

Before presenting to the user, run two checks:

**Check 1 — Criterion coverage:**
1. Read each spec's `## Acceptance Criteria`
2. For each criterion, confirm a task's TDD Behavior covers it
3. If any criterion has no task: add one
4. Report: `Coverage: all {n} criteria across {m} specs have tasks`

**Check 2 — Min-Invariant completeness (rule `min_invariant_per_task`):**
1. Scan every task row in tasks.md
2. For each row, verify the Min-Invariant cell is non-empty and does NOT contain forbidden values: `array`, `object`, `defined`, `not empty`, `truthy`, `valid JSON`. This is the same column and forbidden list the `tasks_min_invariant` engine predicate audits — doing it here at Plan time is the cheap catch; the predicate is the backstop.
3. If any cell is empty or forbidden: fill it with the concrete observable value the test must assert
4. Report: `Min-Invariant: all {n} tasks have concrete invariants` or `Fixed {n} tasks missing invariants`

Both checks must pass before presenting for approval.

## Present for approval

```
Plan: {epic name}

Architecture: {1-sentence summary}
Tech: {new deps or "no new dependencies"}
Tasks: {n} tasks across {m} specs

Spec order: {ordered list with brief dependency rationale}
Coverage: all {n} acceptance criteria covered

Files written to dev/epics/{epic}/
Review plan.md and tasks.md, then say "approved" to proceed to Build phase,
or tell me what to change.
```

## On approval

1. Update `epic.md` **Status:** → `Planned`
2. Update `plan.md` **Status:** → `Approved`
3. Update `tasks.md` **Status:** → `Approved`
4. Commit the epic dir with the project's commit convention

## On changes requested

Edit files as requested. Re-present. Do not commit until approved.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "Min-Invariant is overkill" | False-green tests are the #1 cause of "it shipped but didn't work." Min-Invariant is the cheapest catch. |
| "I'll figure out task ordering during build" | Mid-build re-ordering means re-writing tests. Order now, write once. |

## Red Flags

- Min-Invariant cells with `defined` / `array` / `not empty` (violates `min_invariant_per_task`).
- Tasks containing "and" or "or".
- Plan that contradicts an entry in adr.md (re-trying a failed approach without new evidence).

## Verification

- [ ] plan.md + tasks.md written; both Status = Approved on user approval.
- [ ] Coverage cross-check passed.
- [ ] Min-Invariant cross-check passed (zero forbidden values).
- [ ] adr.md was read before approach was written.
