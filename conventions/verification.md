# Verification: every task terminates in concrete evidence

The kit enforces this in pieces (skill `Gate` sections, the governance
engine, the reviewer-agent verdict, the ratchet). This file names the
principle in one place so it can be cited, taught, and not quietly skipped.

## The rule

**A task is not done until it produces evidence a skeptic can check.
"Seems right" is never enough.**

- A change is verified by a *run*, not by reading it: the failing test that
  now passes, the command output, the diff, the gate result. Paste it.
- "It should work" / "looks correct" / "I'm fairly sure" are not
  terminations. They are the state *before* verification.
- The evidence must be specific to *this* change. A green suite that was
  green before the change proves nothing about the change.

## Why (the failure mode this prevents)

Probabilistic generation is confident regardless of correctness. An agent
(or a tired engineer) will report success from plausibility, not proof. The
gap between "plausible" and "verified" is where shipped bugs live. The cost
of closing it is seconds (run the thing); the cost of not closing it
compounds downstream.

## Worked example (this kit, 2026-05-18)

A skill-triggering eval returned **2/18** — a catastrophic-looking number
that, taken at face value, said the skills barely fire. The disciplined
move was *not* to believe the metric. Reading the actual run transcripts
showed the model had consulted the skill and routed around a deliberately
gutted test stub: the harness was measuring itself, not the skills. The
number was real; the conclusion it implied was false. Inspecting the
evidence inverted the verdict.

**Generalised:** when a metric looks decisive (great *or* terrible), read
the underlying transcript/output before believing it. A number is a
pointer to evidence, not a substitute for it. Aggregates hide the thing
that explains them.

## How this composes with the rest of the kit

- **Skill `Gate` sections** — each skill terminates in a named, checkable
  artefact. That *is* this principle, per-phase.
- **Governance engine** — deterministic; a finding is evidence, not opinion.
- **reviewer-agent** — adversarial; "PASS" must cite what it checked.
- **build skill** — RED before GREEN: the failing run is the evidence the
  test can fail; without it a passing test proves nothing.
- **TDD `no_secrets` / universal rules (ADR-0007)** — a gate firing is
  concrete evidence; a clean run against a planted violation is the
  evidence the gate works.

## When you are tempted to skip it

| "..." | Reality |
|---|---|
| "It's a tiny change, obviously fine" | Small-but-wrong is the most expensive bug class; it ships because no one looked. Run it. |
| "The metric says it passed" | The metric is a pointer. Read what it points at before you trust it. |
| "I verified something like this before" | Different change, different evidence. Re-run for *this* one. |
| "No time to verify" | Verification is seconds; an unverified regression is hours, downstream, with no blame line. |
