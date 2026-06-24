# ADR-0016: A self-scoping rule requires an integration layer for user-facing surfaces

**Status:** Accepted
**Date:** 2026-06-09
**Extends:** ADR-0013 (ship gate), `conventions/test-layers.md` (the surface→layers convention)

## Context

The World Cup battle-test surfaced the **gate-bias** finding (Layer-2
`gate-bias-correctness-gated-not-ux`): the kit gates what a concrete Min-Invariant can pin
(counts, equalities, round-trips) and is structurally blind to UX + integration. The slice
shipped correct, well-tested software with an **untested app layer — and that is exactly where
`/share` 404'd** (a Next.js realm-isolation bug a unit test cannot see).

`conventions/test-layers.md` already *documented* the right composition — `userFacing → [unit,
integration, e2e]` — but nothing **enforced** it, and an adopter could escape it entirely by
simply not declaring a `userFacing` surface. WC did exactly that: `surfaces: { core: { minLayers:
["test"] } }` — unit only. The gate had nothing to require, so the integration layer was never
written and the 404 shipped green.

The trap to avoid is over-correction: you **cannot** deterministically gate "does it look good"
or "is the flow right." Faking a UX gate would be a new phantom. UX is human judgment to
*surface*, not gate.

## Decision

**Add one built-in predicate `userfacing_integration_layer`, shipped as an active universal
`warn` rule (ramps to `error` under `profile: team`).** It is **self-scoping**:

- It globs the repo (default Next.js route/page patterns, overridable via `file_patterns`) for
  user-facing surface files. **If none exist, it is a no-op** — a CLI / library / analyzer (the
  kit's proven sweet spot, e.g. RepoNav) is never touched. This boundary *is* the gate-bias
  finding made mechanical.
- If route/page files DO exist but the `testing-manifest.json` declares no `integration` or
  `e2e` layer, it emits a finding: the gate boots none of those surfaces, so route-composition /
  realm-isolation bugs ship green.

It gates only that an integration layer is **declared** (so the ship gate, ADR-0013, then runs
it). It never asserts anything about UX/taste.

`governance.yaml.example` scope now includes `app/**`, `pages/**`, and `testing-manifest.json`
so the rule can see route files and the manifest.

## Consequences

- A repo with user-facing surfaces can no longer ship a "green" gate with zero integration
  coverage without at least a `warn` (solo) / block (team). Would have caught `/share`.
- **No false positives on deterministic-core projects** — self-scoping means analyzers/CLIs/libs
  are exempt by construction, not by configuration.
- **Honest boundary:** correctness + "an integration layer exists" are gated; UX/taste is not
  (no deterministic invariant) — it stays human-surfaced. The rule's description and this ADR say
  so, so the kit does not oversell what it gates (the recurring anti-pattern).
- **Non-tautological** (F1): `predicates.test.ts` — a route-bearing unit-only manifest yields a
  finding (a do-nothing stub fails); an e2e-bearing manifest and a route-free repo yield none (a
  flag-everything stub fails). Proven end-to-end via the engine audit.

## What this ADR does *not* do

- It does not gate UX, styling, or flow (impossible to do deterministically; surfaced for human
  review instead).
- It does not run the e2e tests itself — that is the ship gate (ADR-0013); this only requires the
  layer be declared so the gate has something to run.
- It does not mandate a specific framework — `file_patterns` overrides the Next.js defaults.

## Cross-reference

- `engine/src/predicates.ts` (`userfacing_integration_layer`), `engine/test/predicates.test.ts`
- `governance/governance.yaml.example` (the wired rule + scope), `conventions/test-layers.md`
- Layer-2 `gate-bias-correctness-gated-not-ux`, `validation-altitude`; battle-test friction-log §H
