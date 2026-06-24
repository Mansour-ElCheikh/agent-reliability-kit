---
spec_version: 1
status: active
name: performance-optimization
description: Measure-first performance work. Use when the spec carries a performance budget, monitoring reports slow behaviour, or you suspect a regression. Drives measure→identify→fix→verify→guard; refuses to optimize without evidence of a real bottleneck.
purpose: |
  Performance work without measurement is guessing, and guessing leads
  to premature optimization — complexity added where it doesn't matter,
  the actual bottleneck untouched. This skill enforces the discipline:
  establish a baseline with real data, identify the proven bottleneck
  (not the assumed one), fix that, measure again to confirm, then guard
  with a regression check. Adapted from addyosmani/agent-skills
  performance-optimization, generalised from web-only to any project
  with a declared performance budget.
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
  - the project's performance budget (from the epic/spec, or testing-manifest)
  - profiler / benchmark output (baseline, captured from a real run)
  - the change or commit suspected of a regression
  - existing perf-regression tests/benchmarks if the project has them
writes:
  - the targeted fix for the proven bottleneck
  - a perf-regression guard (benchmark or budgeted test)
  - a short before/after measurement note (numbers, not adjectives)
invokes_skills: []
invokes_agents: []
trigger_phrases:
  - "/perf"
  - "optimize performance"
  - "this is slow"
  - "performance regression"
  - "make it faster"
---

# Performance Optimization

Measure first. Identify the proven bottleneck. Fix only that. Measure again. Guard against regression.

## Overview

Measure-before-optimize discipline. The failure mode is optimizing what feels slow instead of what is slow: complexity is added, the real bottleneck survives, and the change can't be shown to have helped. This skill refuses to start without a baseline from real data, fixes the one bottleneck measurement proves dominates, then re-measures to confirm the gain is real (numbers, not "feels faster"). Generalised from web frontends to any project: the *budget* is whatever the spec declares — Core Web Vitals for web, latency SLAs / throughput / memory ceilings for services, wall-clock for batch jobs.

## When to Use

- The spec carries a performance budget (load-time, latency SLA, throughput, memory ceiling) and a change risks it
- Monitoring or users report slow behaviour
- You suspect a specific change introduced a regression
- Building a feature over large datasets or high traffic where the budget is explicit

**When NOT to use:**
- No evidence of a problem and no budget in the spec — premature optimization costs more complexity than the speed it buys. Stop.
- The "slowness" hasn't been measured yet — measure first; a hunch is not a baseline
- A correctness bug is masquerading as slowness — that's `debugging-and-error-recovery`

## The workflow

```
1. MEASURE  → baseline from real data (profiler / benchmark / RUM) — record numbers
2. IDENTIFY → the bottleneck the measurement proves dominates (not the assumed one)
3. FIX      → the smallest change addressing THAT bottleneck only
4. VERIFY   → measure again under the same conditions; confirm the budget is met
5. GUARD    → a benchmark or budgeted test so the engine/CI catches the next regression
```

### 1. Measure
Capture a baseline under conditions that resemble production, using whatever the project's stack exposes (a profiler, a benchmark harness, a load test, RUM telemetry). Record concrete numbers against the budget. "Slow" is not a measurement; "p95 1.8s vs 800ms budget" is.

### 2. Identify
Read the profile. Name the single dominant cost (the function, query, render, allocation, round-trip). If two costs look comparable, instrument finer until one clearly dominates. Optimize the proven one; ignore the rest until they dominate.

### 3. Fix
The smallest change that addresses the identified bottleneck. No speculative rewrites elsewhere "while we're here" — that's the premature-optimization failure mode wearing a different hat.

### 4. Verify
Re-measure under the same conditions as step 1. The number must move past the budget. If it didn't, the bottleneck was misidentified — return to step 2 with the new profile, do not stack another guess.

### 5. Guard
Add a benchmark or a budgeted test so a future regression fails mechanically (a governance predicate or a CI perf gate), not "someone notices in production."

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I know what's slow, skip the profiler" | The bottleneck is almost never where intuition says. Measure or you'll optimize the wrong thing. |
| "While I'm here I'll speed up this other bit" | Unmeasured changes add complexity for unproven gain. Fix only the proven bottleneck. |
| "It feels faster now, ship it" | "Feels" is not a number. Re-measure against the budget or you can't claim a fix. |
| "No budget in the spec but this looks slow" | No evidence + no budget = premature optimization. Get a budget or evidence first. |

## Red Flags

- Optimizing before a baseline measurement exists.
- The fix targets an assumed bottleneck, not one the profile proved.
- "Faster" claimed with no before/after numbers.
- Scope creep into unrelated "while we're here" speedups.
- No regression guard added — the next regression will be silent.

## Verification

- [ ] Baseline captured from real data, recorded as numbers vs the budget.
- [ ] Bottleneck identified from the measurement, not assumed.
- [ ] Fix scoped to that bottleneck only.
- [ ] Re-measured under identical conditions; budget now met (numbers cited).
- [ ] Regression guard (benchmark / budgeted test / predicate) added.
