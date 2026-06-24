# ADR-0017: Authoring-side status projection (epic status fans out to its surfaces)

**Status:** Accepted
**Date:** 2026-06-06
**Supersedes:** None

## Context

ADR-0011 made an epic's `**Status:**` line (scanned from `dev/epics/<NNN>-<name>/epic.md`)
the single routing source of truth, and `canonical/plan-next-stub.schema.md` defines the
READ side: a worked-example refresher (`governance/plan-next-stub.refresher.example.mjs`)
scans those statuses into one advisory stub that `plan-next` and `sdlc` read. That refresher
is read-only consolidation and, by its own comment, defaults a missing status to `Unknown`
(fail-open), which is correct for an advisory stub.

What the scaffold does not yet ship is the AUTHORING side: when a status changes in one
place, the other surfaces that restate it (an epic's `plan.md` header, its `tasks.md` cell,
the repo's `ROADMAP.md`) must be regenerated, not hand-propagated. Without that, a status
lives in several editable copies and drifts: a roadmap line says one thing, the epic says
another, and nothing reconciles them. That is the same duplication ADR-0011 removed for
routing, still open for the human-readable surfaces.

A consumer needs a shape to copy, exactly as it needed one for the read stub. Per ADR-0001
the scaffold ships shapes and worked examples, not production runtimes: the production
projector (wired to a host's commit lifecycle, sweeping a host's project set) is
host-specific and stays host-supplied.

## Decision

**Ship an authoring-side projection convention plus a worked-example refresher, the mirror
of the read-side stub.** Concretely:

1. `canonical/status-projection.schema.md` defines the region contract: a status authored
   only in `epic.md` `**Status:**` is projected into `BEGIN/END-GENERATED:epic-status`
   marker regions in `plan.md`, `tasks.md`, and `ROADMAP.md`. Each region carries a
   `GENERATED - do not hand-edit` header naming its source and regenerate command.

2. `governance/status-projection.refresher.example.mjs` is the worked example (the
   `plan-next-stub.refresher.example.mjs` precedent): a copyable reference that reads epic
   statuses and rewrites the regions. It is an example, not a runtime; wiring it to a
   post-commit hook, a CI step, or a session-start hook is the host's job.

The convention bakes in two rules that distinguish an authoring projector from a read stub,
because an authoring projector is a sole writer of surfaces:

- **Fail closed.** If an `epic.md` is unreadable or its `**Status:**` regex misses, the
  projector aborts that epic and writes nothing. It never substitutes `Unknown` and never
  overwrites a surface from an absent source. This is the deliberate inversion of the read
  refresher's fail-open default.
- **Stable regions, non-tautological drift guard.** A region carries the status value, a
  repo-relative source path, and a constant regenerate command, never a per-run timestamp or
  commit sha. Volatile provenance in a committed, drift-checked surface would make the guard
  fire every run and churn the tree; the "when" is recoverable from `git blame`. A `--check`
  mode recomputes every region from source and diffs it against the on-disk surface; any
  difference is a non-zero exit and blocks. The predicate
  (`governance/status-projection.refresher.example.test.mjs`) proves the guard is
  non-tautological: it corrupts one status to a sentinel and asserts `--check` goes red, then
  restores and asserts green. A generator that echoed its prior projection would stay green
  on the corrupted source and so fail the test.

## Consequences

**For the next contributor:** a status is authored once in `epic.md` and projected to every
surface by re-running the refresher. A hand-edit to a region is a review-visible drift, not a
silent second authority. The read stub and the authoring projection are siblings: one reads
epic status into an advisory summary, the other writes it into the colocated surfaces.

**Closes** the authoring-side half of the single-source-of-truth model for status: routing
(ADR-0011) and the advisory stub (the read schema) were the read side; this is the write
side. **Permits (the cost):** a project that keeps `plan.md`/`tasks.md` outside an epic
directory is not projected into those files; only the named surface paths are projected. The
production runtime (lifecycle wiring, multi-project sweep) is intentionally not shipped here;
adopters wire the example into their own automation.

## What this ADR does *not* do

- It does **not** ship a production projector or a scheduler. The example is illustrative;
  host wiring (post-commit, CI, session-start) is the adopter's, per ADR-0001.
- It does **not** change ADR-0011's routing semantics or the read stub. `## Epic status` in
  the read stub stays the routing input; this projects the same field to human-readable
  surfaces.
- It does **not** introduce a status vocabulary; statuses are the `canonical/phases.md` enum.

## Cross-reference

- ADR-0011 - epic status is the single routing source (the read side this mirrors).
- `canonical/plan-next-stub.schema.md` + `governance/plan-next-stub.refresher.example.mjs` -
  the read-side schema and worked example this is the authoring companion to.
- ADR-0001 - the scaffold ships shapes and worked examples, not production runtimes.
- `canonical/status-projection.schema.md` - the region contract this decision formalises.
- `governance/status-projection.refresher.example.mjs` +
  `governance/status-projection.refresher.example.test.mjs` - the worked example and its
  non-tautological predicate.
