---
spec_version: 1
status: active
name: build
description: SDLC Build phase — execute an approved epic's task table one task at a time through RED→GREEN→REFACTOR, in thin vertical slices that each leave the system green. The instructional TDD layer; composes with the mechanical co-located-test rule (R2/R2b), which it does not replace.
purpose: |
  The Build phase had a task *contract* (spec/plan produce a TDD-shaped
  task table with Min-Invariants) but no *runner*. Loose "write tests,
  probably" guidance is the no-anatomy drift mode ADR-0020 named. This
  skill is the structured runner: it takes one task, proves the test
  RED before any production code exists, makes it GREEN with the minimal
  change, refactors on green, and only then advances. The mechanical
  rule (R2/R2b) enforces that a test file exists; this skill enforces
  that the test is written first and observed to fail — the part no
  artifact check can prove. Remove either layer and there is a hole.
applicable_phases: [build]
requires:
  llm_inline_invocation:
    level: required
    degrades_to: inline_in_steering
  filesystem_writes:
    level: required
  bash_invocation:
    level: required
  hook_intercept:
    level: not_needed
  subagent_invocation:
    level: not_needed
  session_lifecycle_hooks:
    level: not_needed
reads:
  - dev/epics/{epic}/epic.md (Status must be Approved/Planned/Building)
  - dev/epics/{epic}/tasks.md (Branch A) or dev/epics/{epic}/specs/*.md (Branch B)
  - dev/epics/{epic}/approaches.md (approaches already tried + rejected — do not retry)
  - the project's test command(s) from testing-manifest.json
  - existing source + test files in the affected area
writes:
  - production + test source files (one task's slice at a time)
  - dev/epics/{epic}/approaches.md (append when an approach is tried and abandoned)
  - dev/epics/{epic}/epic.md Status (→ Building on start, → Built on completion)
invokes_skills: []
invokes_agents: []
trigger_phrases:
  - "/build"
  - "build this"
  - "implement the tasks"
  - "run the build phase"
  - "start building"
---

# Build Phase

Execute the approved task table one task at a time, each task a full RED→GREEN→REFACTOR cycle landing the system in a green, committable state.

## Overview

The instructional TDD runner. It consumes the task table `spec` produced (inline `tasks.md` for 1-2 components, per-component `specs/*.md` for 3+) and drives each task: test first, prove RED, minimal GREEN, refactor on green, commit. It builds in thin vertical slices — never a whole feature in one pass. It is the *behavioural* TDD layer; the *mechanical* layer (the co-located-test rule R2/R2b on the PreToolUse hook) is separate and composes with it. The hook can prove a test file exists; only this skill enforces test-first ordering and the observed-RED step, which no artifact check can prove.

## When to Use

- An epic is Approved/Planned and has a task table (from `spec`)
- Resuming a Building epic mid-stream (pick up at the first non-done task)
- Any change with behavioural impact — new logic, a bug fix, a modification

**When NOT to use:**
- No approved task table yet — run `/spec` then `/plan` first
- Pure config / docs / static-content changes with no behavioural impact (testing-manifest `static` layer; no RED→GREEN to run)
- Controlled file moves / renames / restructuring — that's `/refactor` (rollback-disciplined), not a TDD cycle
- A one-line obvious fix already covered by an existing test — just make it green

## The cycle (one task at a time)

For each task in table order (happy path → edge → error → integration):

### RED — prove the test fails first

1. Read the task's `TDD Behavior` (`given X when Y then Z`) and `Min-Invariant` (rule `min_invariant_per_task`: the concrete fact the test must assert — never a shape like `defined`/`array`).
2. Write the test FIRST, asserting the Min-Invariant. No production code yet.
3. Run the project's test command (from `testing-manifest.json`). **Confirm the new test FAILS.** A test that passes before any implementation exists asserts nothing — rewrite it until it fails for the right reason.

**Two RED edge cases (battle-test D2):**
- **Coarse RED — failing at import, not at the assertion.** A test against a module that does not exist yet fails at *import*, which is a valid RED but does not prove the *assertion* can fail for the right reason. Add the minimal stub (a module/function that imports cleanly but returns nothing useful), then re-run: the test must now fail at the **assertion**. Only then write the real GREEN code. (import-RED → stub → assertion-RED → GREEN.)
- **Characterization / regression-lock tests have no RED.** A test that pins *existing* behaviour (e.g. a Review-phase lock on a coverage constant or current output) asserts something already true, so there is no red step. That is legitimate — but prove the lock bites: **temporarily mutate the pinned value, confirm the test goes red, then restore it.** That mutation check is the substitute for RED.

### GREEN — minimal code to pass

4. Write the smallest production change that makes the failing test pass. No extra scope, no speculative generality.
5. Run the test command. **Confirm the target test passes AND no previously-green test went red.**

**Post-GREEN assertion-quality check (rule `test_invariants`).** Before advancing, confirm the now-green test asserts domain behaviour, not shape. Block if either holds: the Min-Invariant specifies a concrete value but the test asserts only `toBeDefined` / `Array.isArray` / `toHaveProperty`; or the test still passes when the production code is replaced with `return []` / `return {}`. Either is a false green — rewrite the assertion to match the task's Min-Invariant exactly and re-run. This is the behavioural counterpart of the mechanical `test_shape_assertions` predicate; `tasks_min_invariant` governs the column the assertion must match.

### REFACTOR — clean on green

6. With the bar green, improve names / structure / duplication. Behaviour unchanged.
7. Run the test command again. **Still green.** If refactor breaks a test, revert the refactor (not the feature).

### COMMIT — land the slice

8. Stage the test + production change together. Commit with the project's convention. The test and its implementation may share one commit, but the RED run must have happened before the GREEN implementation existed.
9. Advance to the next task. If an approach was tried and abandoned, append it to `approaches.md` (`Tried / Chose instead / Why`) so it is never retried.

## Slice discipline

- **One slice = one RED→GREEN→REFACTOR = one commit.** A slice is normally one task, but it may be a **small group of sibling tasks** (≈2–4) that form a single vertical increment — e.g. a happy-path row plus its edge-case rows for the same unit. Each *behavior* still gets its own test-first RED inside the slice; the grouping is the **commit boundary**, not a licence to skip RED. (At ~25 tasks, a literal one-commit-per-task is noise, not discipline — battle-test finding D1.)
- If a task needs >~100 lines before a test can run, it was too big — split it (update the task table, note it).
- Each commit leaves the full suite green. Never commit a red bar "to fix later."
- Tasks within a component run in table order. Do not jump ahead to an interesting task and leave earlier ones red.

## Governance integration

The mechanical co-located-test rule fires at write time independently of this skill. If it blocks a production-file Write because the test file does not yet exist, that is the rule and this skill agreeing — write the test first (RED), which is step 2 anyway. Do not work around the hook; satisfying it is the cycle working as designed.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll write the test after, it's faster" | A test written after asserts what the code does, not what it should do. The RED step is the whole point — it proves the test can fail. |
| "The test obviously passes, no need to run RED" | "Obviously" is how vacuous tests ship. Run it red. The 5 seconds is the cheapest bug insurance there is. |
| "I'll batch five tasks then test once" | That loses which change broke what. Each behavior still gets its own RED. Grouping ≈2–4 sibling tasks into one commit is fine; batching their *tests* into one late run is not. |
| "Refactor broke a test — I'll fix the test" | A refactor must not change behaviour. A red test after refactor means revert the refactor, not edit the test. |
| "The mechanical hook already enforces TDD" | The hook proves a test file exists. It cannot prove you wrote it first or saw it fail. That is this skill's job. |

## Red Flags

- Production code written before its test exists / fails.
- A new test that passes on first run (asserts nothing, or tests already-built behaviour).
- Min-Invariant ignored — test asserts a shape (`defined`, `array`) instead of the concrete fact (violates `min_invariant_per_task` / `test_invariants`).
- A commit with a red bar (a slice may group ≈2–4 sibling tasks, but never lands red).
- Refactor step edits a test to stay green.
- Skipping ahead past a failing earlier task.

## Verification

- [ ] Every task ran RED (observed failing) before its GREEN implementation.
- [ ] Each task's test asserts its Min-Invariant (concrete fact, not a shape).
- [ ] Every commit left the full suite green; each commit is one coherent slice (one task, or ≈2–4 sibling tasks).
- [ ] Refactor steps changed structure only, never behaviour or tests.
- [ ] Abandoned approaches appended to approaches.md; epic.md Status → Built on completion.
