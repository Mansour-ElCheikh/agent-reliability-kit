# ADR-0025: Longitudinal state-integrity is enforced by gates, not review

**Status:** Accepted
**Date:** 2026-06-06
**Supersedes:** None

## Context

The 2026-06 pre-flip assessment, and the session-harvest of that work, named a gap the eval suite never exercised: the kit's evidence is single-shot/task efficacy, while its weakest, untested surface is *longitudinal state-integrity*: drift between what the docs claim and what the repo actually is, accumulating under active use (the F4 failure mode the kit names elsewhere). Three concrete instances were standing at flip time:

- **Numeric counts** ("11 predicates", "15 ADRs", "12 skills + 1 subagent") were hand-typed across README / ARCHITECTURE / ROADMAP and reconciled only by manual PR review (`conventions/repo-documentation.md` rule #2). The counts happened to be correct, but nothing *prevented* the next predicate or ADR from silently desyncing them.
- **`doc_validity` enforced presence, not expiry.** The predicate checked that `validity` + `as_of` + an expiry key exist, but never computed whether the window had closed, so a "current" doc could sit far past its expiry and pass.
- **`governance/RATCHET.md` cited a non-existent command** to establish the baseline (a `governance-audit.js --emit-baseline` invocation); the real entrypoint is `ratchet emit`.

The constraint is ADR-0001 (ship shapes and worked examples, not contents or a runtime) and the private-surface lock (`conventions/public-flip-hygiene.md`): the kit ships no live `governance.yaml`, so it cannot audit *itself* with the full engine in CI. Any state-integrity enforcement must therefore run from the repo and the source, not from a live self-audit.

## Decision

**Make the two tractable drift surfaces build gates, and document the ratchet baseline as the adopter artefact it already is.**

- **Count-reconciliation gate.** `scripts/check-counts.mjs` (mirroring `scripts/check-anatomy.mjs`) probes runtime reality (the `BUILTIN_PREDICATES` registry, the `docs/decisions/NNNN-*.md` files, `canonical/skills/`, `canonical/agents/`) and asserts every digit-form count claim on the positional public surfaces (README, ARCHITECTURE, ROADMAP) matches. Wired into CI; it upgrades `repo-documentation.md` rule #2 from PR-time review to a red build. Positional like the em-dash gate: it gates the top-level public surfaces, not every file.
- **`doc_validity` expiry.** After its presence check passes, the predicate computes expiry from `as_of` + `expires_after_days` (or an explicit `expires`) and emits an advisory `warn` once the window closes. Severity is always `warn` (staleness is advisory; *missing the contract* stays at `rule.severity` — the doc never followed the discipline). The clock is injectable via `AuditContext.now` for deterministic audits, defaulting to the real clock. Unparseable dates are skipped (zero false positives), matching the existing tool-capabilities staleness check.
- **Ratchet baseline = adopter artefact.** The fresh-clone "inert ratchet" observation is correct but not a defect: the kit ships no live `governance.yaml`, so it has nothing to ratchet against itself. Adopters get a baseline at bootstrap: `scripts/scaffold.ts` prompts (never silently) and runs `ratchet emit` into their repo. The only fix here is honesty: `RATCHET.md`'s establish-baseline command is corrected to the real `ratchet emit` entrypoint.

## Consequences

**For the next contributor:** adding a predicate or an ADR without updating the public-surface counts fails CI with a per-claim diff, not on a reviewer's good eye. A planning or decision doc that silently ages past its window now surfaces a `warn`. The ratchet's setup instructions actually run.

**Prevents** the doc-vs-reality drift (F4) that accumulates under active use, the longitudinal failure mode single-shot evals never reached. This is the first state-integrity gate; it is deliberately scoped to counts and doc expiry, the two surfaces measurable from the repo alone.

**Permits (the cost):** counts must be written as digits on the gated surfaces (a sub-count in words is not gated, by design). The gate is positional (three surfaces), not global, so a count claim added to a fourth surface is unchecked until that surface is added to the gate. `doc_validity` expiry adds a `warn` category that, in an adopter repo on `profile: team`, can ramp and trip the ratchet — the intended signal (an expired plan is real debt), grandfathered by the same baseline as any other warning.

## What this ADR does *not* do

- Does **not** build a roadmap or state projector, and does **not** generate prose. Counts stay hand-written; the gate only reconciles them. The markdown-as-projection discipline is for queryable state, not narrative.
- Does **not** add or remove an engine predicate. `doc_validity` is extended, not split; the registry stays at eleven.
- Does **not** ship a live `governance.yaml` or a live `.governance-baseline.json` for the kit, and does **not** add a self-audit CI step. The kit enforces what it can from the repo and the source; a full self-audit needs a live config the private-surface lock keeps out.
- Does **not** change the ratchet mechanism, the hook, or the profile ramp.

## Cross-reference

- ADR-0001 (ships shapes, not contents) — why the kit runs no live self-audit and ships no live baseline.
- ADR-0011 (epic-status single routing source; no auto-roadmap) — the same no-projector restraint, on the routing axis.
- ADR-0036 (RepoNav) anatomy gate + `scripts/check-anatomy.mjs` — the standalone script-gate precedent this mirrors.
- `conventions/repo-documentation.md` rules #2 (numeric claims) + #3 (validity frontmatter) — the conventions this operationalises.
- `conventions/public-flip-hygiene.md` (private-surface lock) — why no live baseline ships for the kit itself.
- `governance/RATCHET.md` — the baseline operating doc whose phantom command this corrects.
- `docs/findings/sdlc-axes-scoring-2026-06.md` — the assessment that named longitudinal state-integrity as the untested axis.
