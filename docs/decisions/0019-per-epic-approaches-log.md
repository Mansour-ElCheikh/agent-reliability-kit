# ADR-0019: The per-epic approaches log is `approaches.md`, not `adr.md`

**Status:** Accepted
**Date:** 2026-06-10
**Supersedes:** None

## Context

Each epic carries a per-epic file at `dev/epics/{epic}/adr.md` — an append-only
"Tried / Chose instead / Why" log of approaches that were attempted and rejected during
build, read by `plan` / `build` / `debugging` so a failed approach is never silently
retried. It is **not** an architectural decision record.

But it shared the name "ADR" with the formal `docs/decisions/NNNN-*.md` architectural
decision records. Two unrelated things called "ADR" in one repo is a real adopter-confusion
trap (publish-readiness), and it collides conceptually with the formal decision log the kit
ships. Flagged on the ROADMAP for the public-flip pass.

## Decision

**Rename the per-epic file `adr.md` → `approaches.md`** across every live convention
surface, plus the file's own template title (`# Approaches — {epic name}`):

- the skills that create or read it: `spec` (creates it + its template), `build`,
  `plan`, `review`, `sdlc`, `debugging-and-error-recovery`
- the `reviewer-agent` agent (reads it during the gate)
- the Claude Code emitter golden fixtures (input + output) so the self-test stays coherent

**Not `lessons.md`** — that collides with the harvested `memory/` lessons, a distinct
concept (cross-session knowledge, not per-epic rejected approaches).

The formal `docs/decisions/` ADRs are untouched: they remain the one "ADR" in the repo.

## Scope: this is a textual rename, not a gate change

No governance predicate or `governance.yaml` rule references the per-epic file. The
"anatomy gate" (`scripts/check-anatomy.mjs`) governs canonical **skill** structure (size +
section conformance), not the epic directory's contents — so it is unaffected and needs no
update. There is no separate epic-anatomy convention doc; the `spec` skill *is* the
convention surface for the epic directory, and it is updated in place.

## Consequences

- Adopters see one "ADR" concept (the formal decision log) and a self-describing
  `approaches.md` for the per-epic rejected-approaches trail. The confusion is removed.
- Skills now create and read `approaches.md`. A repo mid-flight with an existing
  `dev/epics/*/adr.md` renames that one file to adopt; no data shape changes.
- **Chronology preserved.** Prior ADRs (`0006`, `0012`) describe `spec`/`sdlc` producing
  `adr.md`. They are left exactly as written; read forward, those references denote
  `approaches.md`. This ADR is the forward note, not a rewrite of accepted records.

## What this ADR does *not* do

- It does not edit the historical `docs/decisions/` ADRs (chronology stays intact).
- It does not add or change a predicate (none gated the per-epic file).
- It does not rename to `lessons.md` (reserved for the harvested `memory/` concept).

## Cross-reference

- Renamed surfaces: `canonical/skills/{spec,build,plan,review,sdlc,debugging-and-error-recovery}.md`, `canonical/agents/reviewer-agent.md`, the `emitters/claude-code/test/golden-{input,output}` reviewer-agent fixtures
- ADR-0006 (Define merged into `spec`; the prior naming context)
- `scripts/check-anatomy.mjs` (the skill-anatomy gate; unaffected)
