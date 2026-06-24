# ADR-0010: Re-bind Min-Invariant to a governed rule id

**Status:** Accepted
**Date:** 2026-06-03
**Supersedes:** None

## Context

"Min-Invariant" is the discipline that every task's test must assert a concrete
domain fact (a count, threshold, named value, or file path) rather than a shape
(`array`, `object`, `defined`). A shape-only assertion passes against empty or
wrong-shape data: the false green that ships "it built but didn't work". The
`plan`, `build`, and `review` skills all reference it.

In RepoNav (the source the scaffold was extracted from) Min-Invariant was a
**governed rule**, not a convention:

- `R21_min_invariant_per_task` (predicate `tasks_min_invariant`) audits every
  `dev/epics/**/tasks.md` Min-Invariant column for empty or shape-only values.
- `R20_mcp_test_invariants` (predicate, shape-only assertion detection) catches
  shape-only assertions in test code that make a real call.

The skill bodies cited the rule id explicitly ("...forbidden and violate R21";
"Check 2 — Min-Invariant completeness (R21)"; "Post-GREEN: R21 inline assertion
quality check"). The skill rule and the mechanical predicate **shared an id**.

During extraction the convention survived but the binding did not. The scaffold's
`plan.md` / `build.md` / `review.md` restate Min-Invariant as self-justifying
prose with no rule id, and the engine ships no predicate for it. The 2026-06-03
RepoNav→scaffold→consumer triangulation identified this as the one genuine
substance loss versus RepoNav: Min-Invariant became a floating convention. A
skill that says "run the Min-Invariant cross-check" has nothing mechanical
behind it, and an audit cannot report the rule at all.

Re-binding has two honesty constraints. First, Min-Invariant is **not** ADR-0007
consensus hygiene: it presupposes the scaffold's epic/`tasks.md` convention, so
it does not belong in the Universal Default Set that ships enabled for everyone.
Second, at authoring time its *efficacy* was reasoned, not measured. The
Min-Invariant A/B eval (`docs/findings/eval-min-invariant-ab-2026-06.md`) was run
as part of this flip and **passed on a 10-scenario pilot** (100% to 0%
false-green slip-through on the shape-preserving class); the rule ships labelled
with that pilot result, with a base-rate sweep over real diffs left to graduate
to the eval repo.

## Decision

**Re-bind Min-Invariant to a governed rule id, restoring the RepoNav binding in
tool-neutral form. Ship the mechanical check; scope it opt-in; label its
efficacy honestly until the A/B eval lands.**

1. **Engine.** Ship two built-in predicates (`engine/src/predicates.ts`):
   - `tasks_min_invariant` (R21 analogue) — parses a `tasks.md` markdown table,
     finds the Min-Invariant column, flags empty cells and shape-only values.
     `forbidden_invariant_values` is rule-configurable (defaults faithful to
     RepoNav's list). Added `forbidden_invariant_values` to the `GovernanceRule`
     type.
   - `test_shape_assertions` (R20 analogue) — flags an `it()`/`test()` block
     whose assertions are *all* shape-only (no domain invariant). Tool/framework
     -neutral, not MCP-specific. Conservative (fires only when a block asserts
     and every assertion is shape-only) to keep the false-positive rate low.

2. **Rule ids.** `min_invariant_per_task` (`check: tasks_min_invariant`) and
   `test_invariants` (`check: test_shape_assertions`). The R-number prefix is
   dropped to match the scaffold's existing id style (`tdd_test_first`,
   `no_secrets`); the lineage to RepoNav R21/R20 is recorded here.

3. **Skills.** `plan.md` (Min-Invariant column rule + the completeness
   cross-check), `build.md` (the RED step + a post-GREEN assertion-quality
   check), `review.md` (the test-quality checklist), and `reviewer-agent.md`
   (its checklist) all name the rule id, so the skill rule and the mechanical
   check share an id again.

4. **Governance config.** The two rules ship in `governance.yaml.example` in a
   labelled **SDLC-methodology, opt-in** section — *not* the Universal Default
   Set. Default `severity: warn`, `enforcement: [engine]`. Each carries a
   comment recording the eval B pilot result (*mechanism measured: 100% to 0%
   false-green slip-through on the shape-preserving class; base-rate sweep over
   real diffs graduates to the eval repo*). They are not blanket-enabled and
   never block by default.

5. **Schema.** `governance-rule.schema.md` documents both rules, the
   `forbidden_invariant_values` field, and the predicate cross-reference.

## Consequences

**For the next contributor:** Min-Invariant is a governed rule again. The id
that appears in the `plan` skill's cross-check, the `build` skill's post-GREEN
check, the `review` checklist, and the engine audit is one and the same
(`min_invariant_per_task` / `test_invariants`). An adopter who runs the SDLC
skills can enable the predicate and get write/commit/audit-time enforcement of
the exact discipline the skills teach, with no re-authoring.

**Honestly scoped:** shipped opt-in (not universal) and labelled with the eval B
pilot result. The rule's *existence* is justified (it restores a real lost
binding and backs an already-shipped skill convention); its *efficacy mechanism*
is now measured (eval B pilot: 100% to 0% slip-through on the shape-preserving
class), with the base rate over real diffs the remaining open question. This is
the same overclaim discipline the kit's `document-validity` rule exists to
enforce, applied to itself.

**Permits (the cost):** two more built-in predicates to maintain.
`test_shape_assertions` is a regex heuristic over test source: it can miss
assertions hidden behind helpers and can mis-read unusual formatting. Mitigated
by being conservative and opt-in, and scoped by the adopter (`scope` /
`file_patterns`) to the test dirs where false greens actually bite — the same
narrowing RepoNav used (it scoped R20 to MCP integration tests).

## What this ADR does *not* do

- Does **not** add Min-Invariant to the ADR-0007 Universal Default Set, and does
  not make it blocking by default (it stays opt-in `warn`).
- Does **not** claim Min-Invariant efficacy. That is the A/B eval's job; this ADR
  only restores the binding and ships the mechanical check.
- Does **not** port RepoNav's MCP-specific R20 scoping. `test_shape_assertions`
  is framework-neutral and adopter-scoped.
- Does **not** change the engine's evaluation model, severity resolution, or the
  ratchet (the predicates plug into the existing registry + audit path).

## Cross-reference

- RepoNav `.reponav/governance.yaml` R20/R21 + `src/governance/testQualityRules.ts`
  (`findTasksMinInvariantViolations`, `findMcpTestInvariantViolations`) — the
  faithful source.
- `engine/src/predicates.ts` (`tasks_min_invariant`, `test_shape_assertions`),
  `engine/src/types.ts` (`forbidden_invariant_values`),
  `engine/test/predicates.test.ts` (the TDD tests).
- `canonical/skills/{plan,build,review}.md`, `canonical/agents/reviewer-agent.md`
  — the skill bindings.
- `canonical/governance-rule.schema.md`, `governance/governance.yaml.example`
  — the contract + the shipped opt-in rules.
- `docs/findings/eval-min-invariant-ab-2026-06.md` — the efficacy A/B eval that
  upgrades the "unproven" label.
- ADR-0001 (charter: ships shapes, the predicate is a shape), ADR-0007
  (Universal Default Set: why Min-Invariant is *not* in it).
