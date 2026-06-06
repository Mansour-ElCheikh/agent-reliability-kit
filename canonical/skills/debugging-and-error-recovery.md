---
spec_version: 1
status: active
name: debugging-and-error-recovery
description: Systematic root-cause debugging. Use when tests fail, the build breaks, behaviour doesn't match expectations, or any unexpected error appears. Drives reproduce→isolate→root-cause→fix→guard instead of guess-and-patch, and lands a regression test before the fix.
purpose: |
  Guessing wastes time and compounds errors: an unfixed bug in step 3
  makes steps 4-10 wrong. This skill is the stop-the-line discipline —
  when something unexpected happens, stop adding features, preserve
  evidence, work a fixed triage checklist to the root cause, prove the
  bug with a failing test before fixing it, then guard against
  recurrence. Adapted from addyosmani/agent-skills
  debugging-and-error-recovery; the "prove it with a test first" step
  is wired to this scaffold's TDD layer (the `build` skill's RED).
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
  - the failing test output / build error / stack trace / log lines (preserve verbatim)
  - the diff or commit that preceded the failure (git log / git diff)
  - dev/epics/{epic}/adr.md (was this approach already tried + abandoned?)
  - the project's test command(s) from testing-manifest.json
writes:
  - a regression test reproducing the bug (RED before the fix)
  - the minimal root-cause fix
  - dev/epics/{epic}/adr.md (append when an approach is tried and abandoned)
invokes_skills: []
invokes_agents: []
trigger_phrases:
  - "/debug"
  - "tests are failing"
  - "the build broke"
  - "this isn't working"
  - "unexpected error"
  - "it worked before"
---

# Debugging and Error Recovery

Stop the line, preserve evidence, work the triage checklist to the root cause, prove the bug with a failing test, fix it, guard against recurrence.

## Overview

Systematic root-cause debugging. When something breaks, the failure mode is guessing — patching symptoms, re-running hopefully, stacking changes on an unstable base. This skill replaces that with a fixed process: stop, preserve evidence, reproduce reliably, isolate, find the root cause, write a test that fails *because of the bug*, fix the root cause, confirm the test goes green, guard. The reproduce-with-a-failing-test step is the same RED the `build` skill enforces — a bug fix without a regression test is unfinished.

## When to Use

- A test fails after a change
- The build breaks
- Runtime behaviour doesn't match expectations
- A bug report arrives, or an error appears in logs/console
- Something worked before and stopped

**When NOT to use:**
- The "failure" is an expected, intended behaviour change — update the test, this isn't a bug
- A genuine environment/credential outage with no code component — fix the environment, no regression test applies
- You haven't yet read the actual error output — read it first; this skill starts from evidence, not a hunch

## The Stop-the-Line rule

When anything unexpected happens:

```
1. STOP   adding features or unrelated changes
2. PRESERVE evidence (error text, logs, repro steps, the offending diff) — verbatim
3. DIAGNOSE via the triage checklist below
4. PROVE   reproduce the bug with a failing test (RED)
5. FIX     the root cause (not the symptom)
6. GUARD   confirm the test is green; keep it as the regression guard
7. RESUME  only after the full suite is green again
```

Do not push past a failing test or broken build to work the next feature. Errors compound.

## Triage checklist (in order — do not skip)

### 1. Reproduce
Make the failure happen reliably. If you cannot reproduce it, you cannot fix it with confidence. Non-reproducible: gather more context (logs, env, timing), try a minimal environment, document the conditions and monitor — do not blind-patch.

### 2. Isolate
Bisect the surface. What is the smallest input / code path / commit that still triggers it? `git bisect` or binary-comment the change set. Narrow until one component owns the failure.

### 3. Root cause
State the cause as one sentence: "X fails because Y." If the sentence needs an "and" or a "probably", keep isolating — you have a symptom, not the cause. Check `adr.md`: was this approach already tried and abandoned? If so, do not retry it.

### 4. Prove (RED)
Write a test that fails *specifically because of this bug*, asserting the concrete correct behaviour (a Min-Invariant, not a shape). Run it. Confirm it fails for the right reason. This is the same RED gate as the `build` skill.

### 5. Fix the root cause
Smallest change that addresses the cause from step 3 — not the symptom. Run the test: it goes green, and no previously-green test went red.

### 6. Guard
Keep the regression test. If the bug class can recur elsewhere, consider a governance rule (a predicate) so the engine catches the next instance mechanically.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I see the fix, I'll just patch it" | A patch without a failing test first can't prove it fixed the bug or that the bug stays fixed. Reproduce → RED → fix. |
| "Can't reproduce, I'll fix it anyway" | A fix for a bug you can't trigger is a guess you can't verify. Reproduce first or monitor — don't blind-patch. |
| "It's probably the same as last time" | "Probably" is a symptom, not a root cause. State "X fails because Y" with no hedge, or keep isolating. |
| "I'll fix the symptom now, root cause later" | Symptom fixes mask the cause and make the next failure harder to trace. Root cause now. |

## Red Flags

- Production change before a failing test reproduces the bug.
- Root cause stated with "and"/"probably"/"might be" — that's a symptom.
- Re-running the suite "hoping" without a changed hypothesis.
- Stacking new changes on top of an unresolved failure.
- Retrying an approach already recorded as abandoned in adr.md.
- Bug fix committed with no regression test.

## Verification

- [ ] Failure was reproduced reliably before any fix.
- [ ] Root cause stated in one unhedged sentence.
- [ ] A regression test failed for the right reason (RED) before the fix.
- [ ] Fix addressed the root cause; suite fully green after.
- [ ] Regression test retained; recurrence-prone classes flagged for a governance rule.
- [ ] Abandoned approaches appended to adr.md.
