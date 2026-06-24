---
spec_version: 1
status: active
name: review
description: SDLC Phase 4 — Review a built epic against its specs. Runs a self-review checklist covering spec compliance, code quality, test quality, and architecture. Ships the epic on pass.
purpose: |
  Review is the last gate before merge. Without it, the team ships what
  Build wrote — including tests that pass vacuously, scope that drifted,
  and ADRs that never got recorded. The reviewer-agent subagent provides
  an adversarial second-context pass on Tier 1 hosts; Tier 2/3 hosts run
  the checklist inline.

applicable_phases: [review]

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
  - dev/epics/{epic}/epic.md
  - dev/epics/{epic}/tasks.md (all task statuses must be Done)
  - dev/epics/{epic}/approaches.md
  - diff against main (or merge target)
  - governance audit output

writes:
  - dev/epics/{epic}/review.md
  - updates to dev/epics/{epic}/epic.md Status → Shipped on pass
  - the project's roadmap (mark item Done)
  - the project's CHANGELOG (new entry at top)

invokes_skills: []
invokes_agents: [reviewer-agent]

trigger_phrases:
  - "/review"
  - "review the code"
  - "check the build"
  - "is it ready to ship"
  - "run the checklist"
---

# Review Phase

Review a built epic against its specs and ship on pass.

## Overview

The last gate before merge. Adversarial reviewer-agent pass (Tier 1) or inline checklist (Tier 2/3) checks spec compliance, code quality, test quality (including Min-Invariant assertions), architecture conformance, and zero-new-governance-errors. Ships on pass: status updates + roadmap entry + CHANGELOG update + commit, all in one atomic landing.

## When to Use

- After `/sdlc` Build phase completes
- Before opening a PR for a feature branch
- When acceptance criteria need explicit verification
- After any epic completes its build tasks

**When NOT to use:**
- Mid-build — use mini-reviews at component gates inside Build, not full review
- For commits with no acceptance criteria — review is anchored to criteria
- For trivial commits (docs typo, dependency bump) — overkill
- When tasks.md still has Pending entries — Build first

## Precondition

Read `dev/epics/{epic}/tasks.md` — all task Status values must be `Done`.
If any are `Pending`: "Build is not complete. Run Build phase first."

## Context

1. `dev/epics/{epic}/epic.md` — goal, architecture, epic-level acceptance criteria
2. `dev/epics/{epic}/tasks.md` — component groups with inline acceptance criteria + task status
3. `dev/epics/{epic}/approaches.md` — approaches tried and abandoned during build
4. Run the project's test suite to confirm all tests pass before starting checklist

## Adversarial review (optional but preferred on Tier 1)

On Tier 1 hosts (Claude Code, Copilot agent mode): invoke `reviewer-agent` with `review epic=dev/epics/{epic}`. Wait for its verdict (PASS / FAIL / PASS WITH WARNINGS).

On Tier 2/3 hosts: walk the reviewer-agent checklist inline against the artefacts. The checklist still applies; the adversarial fresh-context isolation is what's missing.

If reviewer-agent verdict is FAIL → fix BLOCKING issues, re-run, max 2 cycles, then present to human if still failing.

## Review checklist

### Spec Compliance (per component)
- [ ] Every acceptance criterion from every component in tasks.md is met by the implementation
- [ ] No features implemented that are not in the acceptance criteria (extra scope is a finding)
- [ ] Edge cases listed in each component header are handled
- [ ] Out-of-scope items were NOT implemented

### Code Quality
- [ ] No dead code or commented-out blocks left in
- [ ] No hardcoded magic numbers (use named constants)
- [ ] No hardcoded secrets or credentials
- [ ] Clear naming — no single-letter variables except loop counters
- [ ] Functional orientation maintained: pure functions preferred, no unnecessary class hierarchies

### Test Quality
- [ ] Tests describe behavior, not implementation details
- [ ] Test names are readable (describe what, not how)
- [ ] Real assertions on every test (no passing-vacuously tests)
- [ ] **Min-Invariant (rule `test_invariants`)**: every test block contains at least one domain invariant — a count, a named fact (`contains <specificValue>`), an exact equality, or a specific string match. Shape-only assertions (`toBeDefined`, `Array.isArray`, `toHaveProperty` alone) with no domain invariant = **blocking finding**. The `test_shape_assertions` predicate flags the same pattern mechanically; this checklist item is the reviewer's read of it. (Upstream, `min_invariant_per_task` governs the tasks.md column the assertion must match.)
- [ ] Edge cases from specs have corresponding tests
- [ ] Test suite green — all tests pass

### Architecture
- [ ] Implementation matches `epic.md §Architecture` approach
- [ ] No ADR decisions violated (especially boundary rules)
- [ ] `approaches.md` has at least one entry per component built — if empty, this is a **finding** (build skipped approach logging)
- [ ] Dependency flow respected (see `governance.yaml`)

### Governance
Run the project's governance audit (e.g. `npm run governance:audit`) and check for new error-severity findings introduced by this epic:
- [ ] Zero new governance errors introduced by this epic

## Present results

```
Review: {epic name}

Passed:
  - {checklist items that passed}

Issues:
  - {issue} — {file:line} — {what to fix}

Summary: {n} passed, {m} issues found
```

If all pass:

```
Review: {epic name} — all checks passed.
Ready to ship.
```

## Write review.md

Create `dev/epics/{epic}/review.md` with the full checklist results, issues list, and verdict.
This persists the review record for future reference.

## On issues found

List each issue with exact file path and line number. Suggest fixes but do not auto-apply.
User decides: fix now (route back to Build for those specific tasks, then re-review) or accept as-is.

## On pass

1. Update `epic.md` **Status:** → `Shipped`
2. Update all component rows in epic.md → `Shipped`
3. **Update the project's roadmap now — this is part of the same commit, not optional.**
   Write a one-liner replacing the full entry: `### {item} — **Done** ({YYYY-MM-DD})\nSee CHANGELOG for details.`
4. Move the full detail entry to the top of the project's CHANGELOG, newest first.
5. Stage only files changed by this epic — never `git add -A` (it sweeps unrelated changes):
   ```bash
   git add <project files> <roadmap-path> <changelog-path> dev/epics/{epic}/ && \
     git commit -m "feat({epic-short}): ship epic — review passed"
   ```
   Add additional paths only if the epic genuinely touched them.
   *(Steps 1–4 must all be staged before this commit. If your project has a post-commit dispatcher, it refreshes the plan-next stub here.)*

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll skip the adversarial review; I wrote good tests" | The author can't audit their own assumptions. Adversarial pass catches what self-review misses. |
| "Min-Invariant is overkill in review" | Reviewers catch the false-green tests Build let through. Skip Min-Invariant and you ship them. |

## Red Flags

- review.md not written.
- Min-Invariant violations not flagged (rule `test_invariants`).
- Shipping with new governance errors.
- `git add -A` in the ship commit (sweeps unrelated changes).

## Verification

- [ ] All checklist items examined; results recorded in review.md.
- [ ] Reviewer-agent (or inline checklist on Tier 2/3) PASSed or PASSed-with-warnings.
- [ ] Status fields updated; ship commit pushed.
- [ ] Roadmap + CHANGELOG updated in the same commit.
- [ ] Zero new governance errors.
