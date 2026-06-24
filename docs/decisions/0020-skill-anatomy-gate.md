# ADR-0020: Skill-anatomy gate (kit-local record; adapts RepoNav prior art)

**Status:** Accepted
**Date:** 2026-06-10
**Supersedes:** None

## Context

The kit enforces a **skill-anatomy gate**: every canonical skill must conform to a fixed
structure, so a skill body cannot silently drift into the unstructured "let me just start"
mode the kit exists to prevent. The gate is wired in three places: `emitters/_lib/src/anatomy.ts`
(`validateSkillAnatomy`, run by every emitter before rendering — exit 4 on a violation),
`scripts/check-anatomy.mjs` (standalone, CI + `pnpm run check:anatomy`), and the R26 size
predicate in the engine.

This discipline was **adapted from RepoNav's ADR-0036 (2026-04-30)** when the gate was ported
into the kit. But the kit then referenced "ADR-0036" in ~25 places — a foreign repo's private
ADR number — with no kit-local decision record. A public kit citing another repo's ADR number
is an adopter-confusion and dangling-reference problem: a reader who looks up `docs/decisions/0036`
in the kit finds nothing. The kit's own ADR-0018 number-integrity gate does not catch it,
because that gate validates `docs/decisions/` *files*, not prose citations.

## Decision

**Record the skill-anatomy gate as kit-local ADR-0020 and repoint every "ADR-0036" reference
to it** — across the canonical skills, ADRs, findings, conventions, the gate script, the emitter
`_lib` and cursor code, the engine R26 predicate, the CI workflow, and the emitter golden
fixtures. RepoNav's ADR-0036 is credited as prior art; the kit owns the decision under its own
number.

The gate's contract (source of truth: `anatomy.ts`): every canonical **skill** body must contain,
in order — YAML frontmatter (`name`, `description` ≤ 1024 chars, `spec_version`), an `# H1`
title, `## Overview`, `## When to Use` (with a `**When NOT to use:**` clause), the workflow body,
`## Common Rationalizations`, `## Red Flags`, `## Verification`. Agents are exempt (they follow
their own contract). A violation is an author bug (exit 4 at emit time).

## Consequences

- The kit's most central structural gate now has a kit-local decision record; an adopter who
  reads any "ADR-0020" reference can find it in `docs/decisions/`.
- The ~25 dangling "ADR-0036" citations are resolved. `docs/decisions/0006` and `anatomy.ts`
  keep an explicit "adapted from RepoNav" provenance note rather than a bare foreign number.
- No behaviour change: the gate logic, the R26 predicate, and the emitted output are untouched;
  this is a citation and decision-record correction.

## What this ADR does *not* do

- It does not change the anatomy contract or the gate's code (only the ADR number it cites).
- It does not erase the RepoNav origin; that is credited as prior art.

## Cross-reference

- `emitters/_lib/src/anatomy.ts` (`validateSkillAnatomy`), `scripts/check-anatomy.mjs` (standalone gate), `engine/src/predicates.ts` (R26 size warn)
- `conventions/test-layers.md` (`pnpm run check:anatomy`)
- ADR-0018 (ADR-number-integrity gate — validates files, not prose; this closes a prose-citation gap it cannot see)
