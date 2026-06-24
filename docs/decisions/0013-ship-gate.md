# ADR-0013: A ship gate runs the target repo's own gates and blocks ship on red

**Status:** Accepted
**Date:** 2026-06-07
**Supersedes:** None

## Context

The kit had every piece of a gated SDLC except the gate that fires by itself. The
PreToolUse governance hook blocks a *write*; the `build` skill instructs RED before GREEN;
the `review` skill asks for a clean audit. But "tests are green before ship" and "the build
was actually TDD'd" were self-imposed: an autonomy-capstone dry-run (2026-06-06) confirmed
the agent hand-sequenced and self-checked them. An orchestrator that ships from one prompt
needs a deterministic ship gate that does not depend on the agent's goodwill, or "gated" is
a claim, not a mechanism.

Constraints:

- **ADR-0001 / ADR-0008:** the kit is documents + local CLIs, no daemon, no runtime that
  drives the model. The gate must be a CLI invoked on demand (and optionally wired to a Stop
  hook), not a background service.
- **ADR-0005:** TypeScript in the `engine/` workspace; no second tool, no new language.
- The gate must run the **target repo's own** gates, not the kit's. A repo declares its test
  layers in `testing-manifest.json` (the keys are package scripts) and its rules in
  `governance.yaml`. The gate reads those; it does not hard-code a test command.
- **Guardrail 4 / F1:** the gate's "blocks on red" must be proven non-tautological, or it is
  fake coverage.

## Decision

**`reliability-engine gate` is a new engine subcommand that runs the target repo's test/lint
scripts plus the governance audit and exits non-zero (blocks) when any check is red.** It is
the deterministic enforcement layer the dry-run showed was missing.

- **Composes existing pieces, re-implements none.** Test/lint commands come from
  `testing-manifest.json` command keys that are real `package.json` scripts (falling back to
  the `test` script); the governance check is the existing `runAudit` at the engine surface;
  package manager is detected from the lockfile. The pure aggregation + manifest logic is
  unit-tested with injected fakes (`engine/test/gate.test.ts`, 14 tests); the real exit-code
  path is proven end-to-end (green target -> exit 0, same target flipped red -> exit 1).
- **Blocks, does not warn.** Any red check makes the gate `blocked`. With no runnable test at
  all the gate blocks too (you cannot ship un-gated) - absence of a check is a red gate, not
  a quiet pass (F3-aligned).
- **Two surfaces, matched to where it fires.** `reliability-engine gate` exits non-zero for CI,
  a manual check, or an orchestrator ship step. `reliability-engine gate --stop-hook` emits
  `{"decision":"block","reason":...}` so it can ride a Stop hook (the harness makes the agent
  continue and fix). The kit ships the Stop-hook wiring as a shape
  (`governance/gate-hook.example.sh`); adopters wire it, like `hook.example.sh`.
- **TDD-as-default (gap 4) is enforced here, not just instructed.** The `build` skill is the
  TDD runner (RED before GREEN, Min-Invariant assertions); the gate is the backstop that
  refuses ship when the test suite is red or absent, so a skipped-TDD build cannot reach ship
  green. Instruction (build skill) + enforcement (gate) compose; neither alone suffices.

Governance-first triad for this new capability: this ADR + `conventions/ship-gate.md` + the
non-tautological TDD test (`engine/test/gate.test.ts`) standing in for a predicate (the gate
is an orchestration CLI, not a `governance.yaml` rule).

## Consequences

- An orchestrator (or a human) can ship only behind a green gate. "TDD-first / green-test"
  stops being a discipline the agent must remember and becomes a check that fires.
- The gate is generic: every repo gates on its own declared tests + rules. No kit-specific
  command is hard-coded.
- **Permitted failure:** a repo with no tests blocks the gate. That is intended (a ship gate
  needs at least one green check); the message tells the user to add a test or run elsewhere.
- **Permitted failure:** the gate spawns the repo's scripts, so a misconfigured script (wrong
  package manager, missing dep) reads as a red gate. Honest: a gate that cannot run the tests
  is not a green gate.
- **Failure modes prevented:** F1 (non-tautological test: an always-pass gate fails the
  red-target cases), F3 (no test -> block, not a silent pass; the Stop-hook shape is stat'd
  before trust), F4 (one gate module, reuses `runAudit`, no second audit path), F6 (one
  subcommand + one example hook; no gate daemon, no CI platform).

## What this ADR does *not* do

- It does not run the model or drive phases (that is the `sdlc` skill the agent follows; the
  gate is a CLI the skill calls).
- It does not auto-fix a red gate; it blocks and reports.
- It does not replace the write-time governance hook or the build skill; it composes with
  them as the ship-time backstop.
- It does not add a coverage threshold or a perf gate (deferred; add as checks later if a
  real need appears, behind their own ADR).

## Cross-reference

- `engine/src/gate.ts`, `engine/test/gate.test.ts`, `engine/src/cli.ts` (the `gate` command)
- `conventions/ship-gate.md`, `governance/gate-hook.example.sh`
- `canonical/skills/build.md` (the TDD runner), `canonical/skills/sdlc.md` (the orchestrator
  that calls the gate at ship), `canonical/skills/review.md`
- ADR-0001, ADR-0005, ADR-0008 (kit-is-a-kit, node-only, not-a-runtime)
- Internal autonomy-capstone spec (gaps 2, 4)
