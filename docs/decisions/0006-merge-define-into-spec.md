# ADR-0006: Merge `define` into `spec`; retire `define` as a canonical skill

**Status:** Accepted
**Date:** 2026-05-18
**Supersedes:** None

## Context

The canonical skill set shipped two Define-phase skills:

- `canonical/skills/define.md` — produces `epic.md` + a flat `tasks.md`; trigger boundary "≤2-3 components".
- `canonical/skills/spec.md` — produces `epic.md` + per-component `specs/*.md` + `adr.md`; trigger boundary "3+ components warranting independent criteria".

Both occupy the **same SDLC phase** (`applicable_phases: [define]`), both produce `epic.md`, and the only material difference is artifact layout: component criteria inlined in one `tasks.md` vs split into `specs/*.md`. The user is forced to choose the fork *before* doing the spec that would reveal the component count.

A 2026-05-18 comparative analysis against `addyosmani/agent-skills` (whose single `spec-driven-development` skill scales from a one-pager to multi-component internally via its SPECIFY phase, with no user-facing fork) established that the only material difference between `define` and `spec` is artifact layout, surfaced to the user as a skill choice they must make *before* doing the spec that would reveal the component count. That is premature optionality, not added rigor; the broader topology analysis is public at [`docs/findings/comparison-vs-flat-skill-models.md`](../findings/comparison-vs-flat-skill-models.md).

Non-negotiable constraints: retiring a canonical skill is a contract change (emitters, `sdlc` routing, anatomy gate all depend on the skill set); the merged skill must satisfy the ADR-0020 anatomy contract; no rigor may be lost (the per-component path must remain reachable).

## Decision

**Merge `define` into `spec`; `spec` scales internally on component count; retire `define`.**

`canonical/skills/spec.md` gains an internal branch in its workflow body:

- **1-2 components:** inline the acceptance criteria + edge cases in a single `tasks.md` (the old `define` behaviour).
- **3+ components:** emit one `specs/<NNN>-<name>.md` per component (the old `spec` behaviour).

The branch is decided *inside* the skill, after the problem/goal are captured, when the component count is actually known — not handed to the user as an up-front skill selection. `canonical/skills/define.md` is deleted. `canonical/skills/sdlc.md`'s routing table maps the Define phase to `spec`. All three emitters (Claude Code, Cursor, Copilot) regenerate; their golden fixtures update as an intentional diff in the S6.4a PR. The ADR-0020 anatomy gate must pass on the merged `spec`.

This also absorbs the redundancy audit's §4 instruction to fold Osmani `spec-driven-development`'s SPECIFY-phase internal scaling into our `spec` rather than porting it as a new skill (it would have re-collided with the merged `spec`).

## Consequences

**For the next contributor:** there is one Define-phase skill, `spec`. It is the sole entry to capturing intent. The "how many spec files" decision is an implementation branch inside it, documented in its body, not a skill-selection question. Future Define-phase additions extend `spec`'s branch, they do not add a sibling skill.

**Prevents:** the failure mode where a user picks `define` for a feature that turns out to need per-component specs (or vice-versa) and has to redo the artifact layout — because the choice was forced before the information to make it existed.

**Permits (the cost):** `spec.md` is now a larger skill with an internal conditional. A reader must follow the branch to know which artifacts are produced. Mitigation: the branch is a single explicit decision point with a stated threshold, not scattered conditionals; ADR-0020's `## Overview` + `## When to Use` state the scaling behaviour up front.

**New constraint on future ADRs:** the canonical skill count is now a deliberately-curated number. Adding a phase-split skill (one skill per artifact-layout variant) requires an ADR justifying why an internal branch is insufficient. "More skills" is not the default response to a new variant.

## What this ADR does *not* do

- Does not change `plan`, `plan-next`, `review`, or `audit` (separately addressed in the S6.4 spec; the redundancy audit found those not redundant).
- Does not touch the `plan-next` ↔ `sdlc` routing overlap (F15, deferred post-S6.4).
- Does not port Osmani `spec-driven-development` as a skill (folded into `spec` instead).
- Does not change the SDLC phase vocabulary — `define` remains a *phase*; only the *skill* named `define` is retired.

## Cross-reference

- [`docs/findings/comparison-vs-flat-skill-models.md`](../findings/comparison-vs-flat-skill-models.md) — public-grade topology analysis (substance extracted from a 2026-05-18 internal audit; the audit + the S6.4 execution lock are internal-process records, not in the public tree)
- `canonical/skills/spec.md` (merged target), `canonical/skills/define.md` (retired), `canonical/skills/sdlc.md` (routing edit)
- ADR-0020 — anatomy contract the merged skill satisfies
- spine `wave4_s6_3_harvest_2026-05-18.md` L5 — don't expose a differentiator that doesn't earn its cost (process-level instance)
