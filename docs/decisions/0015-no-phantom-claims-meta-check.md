# ADR-0015: A no-phantom-claims meta-check guards skill prose against the engine

**Status:** Accepted
**Date:** 2026-06-07
**Supersedes:** None

## Context

The autonomy-capstone battle-test (world-cup-fan-planner) found the kit's central integrity
problem: it **oversells enforcement it does not wire** — its own documented phantom-enforcement
anti-pattern, reproduced inside its own product. P1 fixed three *instances* (A1 template
column, A2 predicate logic, B1 hook emission). But fixing instances does not stop the *class*
from recurring.

A tempting over-reach is "one meta-check that kills the whole class." That is not honest: the
phantom-enforcement flavors are heterogeneous and each already has a guard —

| Flavor | Example | Existing guard |
|---|---|---|
| template-shape (A1) | spec template omits the Min-Invariant column | emitter **anatomy test** |
| predicate-logic (A2) | predicate can't see an absent column | **predicates.test.ts** |
| hook-emission (B1) | no `.claude/settings.json` ships | emitter **golden self-test** |
| enablement (A4) | a real rule cited but shipped opt-in | gate **advisory-count** + `conventions/ship-gate.md` |

There is, however, ONE flavor with **no guard at all**: a skill citing a predicate/rule **by a
name that does not exist anywhere shipped** — citation drift. The ADR-0010 rename
(`R21_min_invariant_per_task` → `min_invariant_per_task`, predicate `tasks_min_invariant`) is
exactly the kind of change that leaves prose pointing at a dead name. Nothing checks it.

## Decision

**Add a no-phantom-claims meta-check (`engine/src/phantom-claims.ts`) wired into the engine's
own test suite (`engine/test/phantom-claims.test.ts`).** Every predicate or rule a canonical
**skill or agent** cites by name in an *enforcement context* must resolve to a real shipped
mechanism.

- **Source of truth:** predicate names = `BUILTIN_PREDICATES` (definitive, imported, not
  parsed); rule ids = harvested from the shipped `governance.yaml.example`, **including
  opt-in rules shipped commented-out** (`# - id: x`) — those are real and citable.
- **Tight patterns only.** A citation is `` `x` predicate ``, `` predicate `x` ``, `` rule `x` ``,
  `` governed by `x` ``, `` violates `x` ``, `` flagged by `x` ``. A bare backtick (`` the `build`
  skill ``, `` run `npm test` ``) is deliberately NOT a citation — no false positives on
  skill/command names.
- **Surfaces scanned:** `canonical/skills/**` + `canonical/agents/**` — the surfaces that
  *promise* enforcement to a user. The schema reference (`governance-rule.schema.md`) is NOT
  scanned: it documents the rule *format* with intentional placeholder examples.

## Consequences

- Citation drift is now a **failing test**, not a latent phantom. A future predicate/rule
  rename that misses a skill breaks CI.
- **Non-tautological** (F1): the check found a real bug in its own extractor on first run
  (overlapping patterns double-counted `governed by rule \`x\``); the RED tests fail a
  do-nothing `() => []` check; the live guard fails a flag-everything check.
- **Honest scope, stated in the code.** The module's header lists what it does NOT catch and
  which existing guard owns each. This ADR exists partly so the meta-check is not itself sold
  as more than it is — the exact failure it guards against.

## What this ADR does *not* do

- It does not catch A1/A2/B1/A4 (owned by the guards in the table above).
- It does not validate `conventions/**` citations (v1 scope is skills + agents; a later ADR
  can widen it once the convention-doc citation style is regular).
- It does not check that a cited rule is *enabled* (that is A4 / the gate's honesty framing) —
  only that it *exists* (is shipped, even if opt-in).

## Cross-reference

- `engine/src/phantom-claims.ts`, `engine/test/phantom-claims.test.ts`
- `engine/src/predicates.ts` (`BUILTIN_PREDICATES` — the predicate source of truth)
- ADR-0010 (the rename that created the drift risk), ADR-0014 (B1 hook emission),
  and the phantom-hook anti-pattern
- battle-test punch-list (the phantom-enforcement cluster; internal battle-test evidence)
