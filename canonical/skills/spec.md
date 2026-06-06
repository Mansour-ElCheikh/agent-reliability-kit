---
spec_version: 1
status: active
name: spec
description: SDLC Define phase — capture intent for a new feature as epic.md (+ tasks.md for 1-2 components, or per-component specs/*.md for 3+) + adr.md. Scales internally on component count; no separate skill to choose. Adversarial reviewer-agent gates the artefact before human review.
purpose: |
  The Define phase establishes intent before any code is written. A loose
  "let me just start implementing" approach is how teams ship the wrong
  thing. This skill produces the structured epic + task/spec artefact
  downstream Build and Review phases consume. It scales internally: small
  features get one inline tasks.md; multi-component features get an
  independent spec file per component. The user does not pick the shape
  up front — the skill decides it once the component count is known. The
  adversarial reviewer-agent gates the artefact, catching vagueness early.

applicable_phases: [define]

requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: required
  subagent_invocation:
    level: preferred
    degrades_to: inline_review_in_skill_body
  hook_intercept:
    level: not_needed
  session_lifecycle_hooks:
    level: not_needed

reads:
  - the project's plan-next context artefact (current milestone, priorities)
  - the project's last-session compact artefact (knownConstraints, governance errors)
  - the project's roadmap file (target milestone section only)
  - docs/decisions/ (last 3 ADRs for constraint context)
  - existing source files in the affected area (use exploration capability if unfamiliar)
  - docs/positioning-questions.md (if the project tracks positioning lenses)

writes:
  - dev/epics/{NNN}-{short-name}/epic.md (always)
  - dev/epics/{NNN}-{short-name}/tasks.md (1-2 components — inline shape)
  - dev/epics/{NNN}-{short-name}/specs/{NNN}-{spec-name}.md (3+ components — one per component)
  - dev/epics/{NNN}-{short-name}/adr.md (initial; empty entries)

invokes_skills: []
invokes_agents: [reviewer-agent]

trigger_phrases:
  - "/spec"
  - "/define"
  - "write a spec"
  - "spec this out"
  - "define this feature"
  - "create an epic"
  - "let's spec it"
---

# Spec / Define Phase

Capture intent for a new feature: `epic.md` + `adr.md` always, plus a task surface that scales with the feature's shape — one inline `tasks.md` for 1-2 components, an independent `specs/<NNN>-<name>.md` per component for 3+.

## Overview

The single Define-phase skill. It establishes intent and constraints before any code is written, and scales its artefact layout internally on component count: small features get a flat `tasks.md`; multi-component features get a per-component spec file each buildable in isolation. You do not choose a "flat vs spec" skill up front — that fork was retired (ADR-0006); the branch is decided here, after the component count is actually known. The adversarial reviewer-agent gates the result on Tier 1 (inline checklist on Tier 2/3).

## When to Use

- Starting a new feature from a rough idea or roadmap entry
- The feature touches a public surface, a contract, or multiple files
- You need scope + acceptance criteria aligned before writing code
- The work is committed (not a throwaway spike)

**When NOT to use:**
- Small typo or bug fixes — open a direct PR
- Exploratory spikes that may not ship — the Define phase is for committed work
- An existing epic is in-flight — use `/sdlc` to resume instead
- The feature is genuinely >5 components — split it into two epics first

## Preconditions

None — this is the mandatory entry phase. If `dev/epics/` does not exist, create it.

## Context (read in order, stop when sufficient)

1. The project's plan-next context artefact — current milestone, priorities, advisories
2. The project's last-session compact artefact → knownConstraints, governance error count
3. The project's roadmap file — find the target milestone heading, read that section only (15-30 lines). Do not full-read the roadmap.
4. `docs/decisions/` — list files, read the 3 highest-numbered ADRs for current constraints
5. Explore relevant existing source files (use your exploration capability if unfamiliar)

## Get feature description

- If user provided one (e.g. `/spec "progressive streaming"`): use it directly
- If no argument: ask "What feature? (or say 'next' to use the top roadmap priority)"
- If "next": use the first item from the plan-next stub's "Next unstarted items" section

## Positioning gate — REQUIRED before writing any artifact (if the project tracks positioning)

If your project maintains a positioning doc (e.g. `docs/positioning-questions.md` with brand or product lenses), answer two questions out loud:

**Q-A: Which positioning lenses does this epic touch?** List each applicable lens and state in one sentence how this epic moves it. If none apply, state "no positioning impact" — but that is a red flag for non-trivial work.

**Q-B: Does this epic lock any open question to a concrete answer?** If yes: name the question, state the answer, flag it as an ADR candidate to write *after* build (not now — after the signal confirms it). If no: confirm explicitly.

**Gate rule:** do not proceed until Q-A and Q-B are answered. If Q-A contradicts a locked decision in the positioning doc, stop and surface the conflict before continuing. If the project has no positioning doc, skip this gate.

## Determine epic number

List `dev/epics/` directories. Next number = highest existing + 1, zero-padded to 3 digits. First epic ever = `001`.

## Decide artefact shape (the internal branch)

Count the feature's distinct components (each warranting its own acceptance criteria + edge cases):

- **1-2 components → Branch A (inline).** One `tasks.md` with component sections inline. Lighter; the common case.
- **3-5 components → Branch B (per-component specs).** One `specs/<NNN>-<name>.md` per component. Independent specs unlock parallel build across sessions/teams and a per-component audit trail.
- **6+ components → stop.** Split the feature into two epics; re-run.

State the decision out loud (`{n} components → Branch {A|B}`) before writing anything. This is the only place the shape is chosen; it is an implementation branch, not a skill the user selects.

## Write epic.md (always)

Create `dev/epics/{NNN}-{short-name}/epic.md`:

```markdown
# {Feature name}

**Status:** Defining
**Date:** {YYYY-MM-DD}

## Positioning lenses touched (if tracking positioning)
{Q-A output: "- **{Lens}:** {one sentence impact}" per lens}
{Q-B output: "ADR candidate: {description}" or "No questions lock from this epic"}

## Problem
{1-2 sentences from roadmap or user description}

## Goal
{one sentence — what done looks like}

## Architecture
{2-4 sentences: how this fits the existing layer structure, new files/modules, dependency flow}

## Tech Stack
{new dependencies, or "no new dependencies"}

## Components
| # | Component | Description |
|---|---|---|
| 001 | {name} | {one-line purpose} |

## Acceptance Criteria
{bullet list — from roadmap acceptance criteria or derived from description}

## Dependencies
{prerequisites, or "none"}
```

## Branch A — Write tasks.md (1-2 components)

Create `dev/epics/{NNN}-{short-name}/tasks.md`:

```markdown
# Tasks — {epic name}

**Status:** Draft

## Component 001 — {name}

**What:** {what this component delivers — 2-3 sentences, no implementation details}

**Acceptance Criteria:**
- [ ] {criterion — testable, unambiguous}

**Edge Cases:**
- {at least 1-2 per component}

**Out of Scope:**
- {explicit exclusions}

| # | Task | TDD Behavior | Status |
|---|---|---|---|
| 1 | {description} | given {context} when {action} then {outcome} | Pending |
```

## Branch B — Write specs/*.md (3+ components)

For each component, create `dev/epics/{NNN}-{short-name}/specs/{NNN}-{spec-name}.md`:

```markdown
# Spec {NNN} — {name}

**Epic:** {NNN}-{short-name}
**Status:** Draft

## What
{what this spec delivers — no implementation details, no language syntax, no file paths}

## User Stories
- As a {actor}, I want {capability} so that {value}

## Acceptance Criteria
- [ ] {criterion — testable and unambiguous}

## Edge Cases
- {at least 1-2 identified edge cases}

## Out of Scope
- {explicit exclusions to prevent scope creep}

## Constraints
{governance rule IDs that apply, or relevant ADR numbers}
```

Add the spec row to `epic.md`'s `## Components` table (use it as the spec index).

## Rules (enforce strictly, both branches)

- 2-5 components per epic. 6+ → split the epic.
- Max 6-8 acceptance criteria per component/spec. More → split it.
- One task = one TDD cycle. If a task description contains "and", split it.
- Tasks within a component: happy path → edge cases → error handling → integration wiring.
- TDD Behavior must be concrete: `given X when Y then Z`. No vague descriptions.
- "What" sections describe WHAT only. HOW lives in `epic.md §Architecture`; tasks/specs reference the epic, never duplicate it.
- Each spec/component must be buildable in isolation from its own file + the epic.

## Coverage cross-check

Before presenting, verify every acceptance criterion (from every component or spec) maps to at least one task's TDD Behavior. Report: `Coverage: all {n} criteria across {m} components have tasks`.

## Initialize adr.md

Create `dev/epics/{NNN}-{short-name}/adr.md`:

```markdown
# ADR — {epic name}

Append-only. Record approaches tried and why they failed.
Format: **Tried:** {what} | **Chose instead:** {alternative} | **Why:** {reason}

---

(no entries yet)
```

## Reviewer gate (single pass — after coverage cross-check, before presentation)

Invoke `reviewer-agent`:
- Tier 1 (Claude Code, Copilot agent): dispatch the subagent with `review epic=dev/epics/{NNN}-{short-name}`
- Tier 2/3 (no subagent): walk the reviewer-agent checklist inline. The checklist still applies; the fresh-context isolation is what's lost.

**FAIL:** fix all BLOCKING issues, re-run until PASS or PASS WITH WARNINGS. Max 2 cycles — if still FAIL, present to human with the issues list.
**PASS WITH WARNINGS:** include warnings in the presentation.
**PASS:** proceed.

Do not present `epic.md` or the task/spec files until reviewer-agent passes (or 2 cycles exhausted).

## Present for approval

```
Epic: {NNN}-{name}  ({n} components → Branch {A|B})
  001 — {component/spec title} ({n} criteria, {m} tasks)
  002 — {component/spec title} ({n} criteria, {m} tasks)

Total: {total tasks} tasks, {total criteria} acceptance criteria covered
Files written to dev/epics/{NNN}-{name}/

Review and say "approved" to proceed to Build, or tell me what to change.
```

## On approval

1. Update `epic.md` **Status:** → `Approved`
2. Update `tasks.md` (Branch A) or each spec file (Branch B) **Status:** → `Approved`
3. Commit the epic dir with the project's commit convention

## On changes requested

Edit files as requested. Re-present. Do not commit until approved.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "Acceptance criteria can be vague; I'll clarify in build" | Vague criteria mean ambiguous tests. Tighten now, ship faster. |
| "I'll pick the spec shape up front to save a step" | The shape depends on the component count, which you don't know until you've done the problem/goal. That's why the branch is here, not a skill choice. |
| "5 components feels conservative; let me do 8" | 6+ → split the epic. Wide epics drift. |
| "I don't need ReviewerAgent; I'll self-review" | The adversarial pass catches what self-review misses (Tier 1). On Tier 2/3, walk the checklist anyway. |

## Red Flags

- Acceptance criteria that aren't testable.
- Tasks that contain "and" or "or" — split them.
- Components/specs without an Out of Scope section.
- Choosing Branch B for a 1-component feature (over-structuring) or Branch A for 4 components (under-structuring).
- Skipping the coverage cross-check or the reviewer-agent (or its inline-checklist degraded form).

## Verification

- [ ] epic.md + adr.md written; tasks.md (Branch A) or specs/*.md (Branch B) written per the stated component count.
- [ ] Branch decision stated out loud before writing.
- [ ] Coverage cross-check passed.
- [ ] Reviewer-agent (or inline checklist) PASSed.
- [ ] User reviewed and approved; Status fields updated; commit pushed.
