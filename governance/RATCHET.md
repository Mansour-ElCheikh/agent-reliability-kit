# Ratchet — operating the warning-count baseline

The ratchet is the part of the governance engine that keeps the warning count from drifting upward. Every `warn`-severity rule produces zero or more findings on every audit. The ratchet refuses commits that grow the total warning count beyond a recorded baseline.

## Why a ratchet

Without one, `warn` is meaningless. Warnings accumulate. After three sprints nobody reads them. The ratchet pins the count: you can fix warnings (count goes down, baseline updates), you cannot add new ones (count goes up, commit fails).

## How it works

```
1. Audit run produces a finding count per rule:
     R2_tdd_test_alignment: 4
     R5_adr_on_decision:    1

2. Baseline file stores the most-recent accepted counts:
     # .governance-baseline.json
     { "R2_tdd_test_alignment": 4, "R5_adr_on_decision": 1 }

3. On every commit, audit runs and compares against baseline:
     - any per-rule count > baseline → commit fails
     - all counts <= baseline       → commit passes
     - any count < baseline         → commit passes AND baseline updates
       (rule ratchets down to the new floor)
```

## The baseline file

`/.governance-baseline.json` at the repo root. Plain JSON. Committed to git so the ratchet survives clones and CI.

```json
{
  "version": 1,
  "ratcheted_at": "2026-05-17T12:00:00Z",
  "counts": {
    "R2_tdd_test_alignment": 4,
    "R5_adr_on_decision": 1
  }
}
```

## Initial baseline

When you first wire governance into an existing project, you will have a non-zero count almost certainly. Establish the baseline once:

```sh
# Run audit, write current count as baseline
node scripts/governance-audit.js --emit-baseline > .governance-baseline.json
git add .governance-baseline.json
git commit -m "chore(governance): establish initial baseline"
```

This freezes the existing warnings as the floor. From that commit forward, the count can only go down.

## When to bypass

Three legitimate bypasses, in increasing order of friction:

1. **Reset the baseline.** A rule was added or changed and the new count is the genuine new reality. Run `--emit-baseline` again and commit. Document the reason in the commit message. Reviewers should see this commit alone — it is the ratchet declaring a new floor.
2. **`enforcement: [engine]` only.** Move a noisy rule off the hook surface temporarily (still surfaces in audit reports but does not block write-time). Reverse when the count is back under control.
3. **Demote to `audit`.** If a rule's predicate is wrong, demote to `audit` severity, fix the predicate, re-promote. Demoting to `audit` removes the rule from the ratchet entirely.

The bypasses exist on purpose. The ratchet is a tool, not a tyrant.

## What the ratchet does not do

- **Does not track per-file warnings.** Only per-rule totals. A move of a warning from file A to file B does not trip the ratchet.
- **Does not validate the predicate.** If a rule's check is buggy and counts wrong, the ratchet faithfully tracks the wrong count. Audit the predicate periodically.
- **Does not catch silent regressions in `audit`-severity rules.** Audit rules are record-only by definition; they live outside the ratchet. Promote to `warn` when you want the ratchet to engage.

## Operating discipline

- Treat `.governance-baseline.json` like a lockfile: review changes in PRs.
- A baseline reset should be its own commit, not bundled with feature work.
- If the count drifts up because a noisy rule is firing too much, fix the rule before resetting the baseline. Resetting hides the signal.
