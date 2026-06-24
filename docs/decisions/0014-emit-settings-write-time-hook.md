# ADR-0014: The claude-code emitter ships a settings.json wiring the write-time governance hook

**Status:** Accepted
**Date:** 2026-06-07
**Supersedes:** None

## Context

The `build` and `sdlc` skills repeatedly cite a write-time enforcement mechanism: *"The
mechanical co-located-test rule fires at write time independently of this skill... Do not
work around the hook."* But the claude-code emitter emitted skills, agents, and `CLAUDE.md`
and **no `.claude/settings.json`** - so in a freshly-scaffolded adopter repo there was no
PreToolUse hook at all, and the only deterministic enforcement was the ship gate (run on
demand). The autonomy-capstone battle-test (world-cup-fan-planner, finding B1) confirmed it:
the skills promise write-time enforcement that does not exist for an adopter. This reproduced
the kit's own documented **phantom-hook anti-pattern** inside its
own product.

The engine already has the backend: `reliability-engine hook` reads a PreToolUse payload on
stdin, evaluates `enforcement: [hook]` rules, and exits 2 to block (error-severity findings).
It was simply never wired into an emitted settings file.

## Decision

**The claude-code emitter emits `.claude/settings.json` wiring `reliability-engine hook` as a
PreToolUse(Edit|Write|NotebookEdit) hook.** So the write-time governance enforcement the
skills cite actually fires in an adopter repo.

- **Adopter-safe.** `bootstrap`/`overwrite` write the file; `adopt` SKIPS an existing
  settings.json (the adopter owns it - their permissions and hooks are never clobbered; the
  emit report records "add the hook manually if missing").
- **Command form.** The hook command is the published form `npx reliability-engine hook
  --config governance.yaml`, with a `_doc` field telling adopters to point it at a local
  engine (`node <path>/engine/dist/cli.js hook`) until the kit is published. The wiring
  exists either way - the path is configuration, not a phantom.
- **Governance-first triad:** this ADR + the settings.json shape (documented in the file's
  `_doc` and `canonical/emitter-contract.md`) + the emitter golden self-test, which now
  includes `.claude/settings.json` (a test that the emit produces it - the predicate
  equivalent).

## Consequences

- The write-time enforcement the skills promise is now **real** in adopter repos. Proven:
  piping a secret-bearing Write payload through the wired hook returns `GOVERNANCE BLOCKED`
  + exit 2; a clean write returns exit 0.
- **C2 linkage (important, honest):** under `profile: solo` the hook (like the ship gate)
  blocks only on **error-severity** findings (`no_secrets`) and *records* `warn` rules
  (co-located-test stays advisory until `profile: team` ramps it, or the rule is authored
  `error`). So B1 closes "the hook is **absent**"; *what it blocks under solo* is the
  separate C2 honesty item (P2). The phantom (no hook) is fixed; the advisory-under-solo
  framing is documented, not oversold.
- **Failure modes prevented:** F3 (the cited hook now exists, is emitted, and is covered by
  the golden test - no more phantom), F4 (one settings.json; adopter-owned in adopt mode, not
  clobbered).

## What this ADR does *not* do

- It does not change which severity blocks (that is C2 / the `--strict` + profile work, P2).
- It does not merge into an existing settings.json (adopt mode skips; a manual add is
  documented). A future ADR could add structured merging.
- It does not resolve the engine-path portability (C4): until the kit publishes
  `reliability-engine`, adopters set the local engine path. The wiring is present regardless.
- It does not wire the user-global editorial hook (that is personal, not the kit's to ship).

## Cross-reference

- `emitters/claude-code/src/cli.ts` (`emitSettings`), `emitters/claude-code/test/golden-output/.claude/settings.json`
- `engine/src/hook.ts` (the backend this wires), `engine/src/cli.ts` (`hook` command)
- ADR-0013 (ship gate - the on-demand backstop this complements); the phantom-hook anti-pattern
- battle-test punch-list B1 (internal battle-test evidence)
