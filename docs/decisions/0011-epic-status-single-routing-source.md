# ADR-0011: Epic-status is the single routing source of truth (closes F15)

**Status:** Accepted
**Date:** 2026-06-03
**Supersedes:** None

## Context

The 2026-05-18 SDLC redundancy audit (`docs/findings/sdlc-redundancy-audit.md`
§2c) and friction finding F15 (`docs/findings/wave4-self-bootstrap.md`) named a
real duplication: the `plan-next` skill's epic-status → phase routing table
restates the same status → phase mapping the `sdlc` orchestrator carries in its
Step 2. Both map an epic's `**Status:**` line to "which phase runs next". The
cost is maintenance: a routing change must land in two places, and they can
silently drift.

F15 was deliberately deferred through S6.4 — surgery on the orchestrator's
routing contract during a positioning rewrite was two destabilisations at once.
S6.4b shipped; the routing contract is stable; it is now safe to settle.

A related gap surfaced in the same triangulation: RepoNav's `update-plan` skill
(roadmap-narrative refresh) was dropped during extraction and never restored.
Between ships, a project's roadmap prose drifts from reality (status lines lag,
"next" items go stale) with nothing to catch it. The `review` skill refreshes
the roadmap *on ship* (per epic), but there is no end-of-session pass for
narrative staleness.

## Decision

**1. One routing table. Epic-status drives it.**

The status → phase mapping becomes a single canonical table, *Epic-status
routing*, in `canonical/phases.md`. An epic's `**Status:**` line — auto-scanned
from `dev/epics/*/epic.md` — is the single routing source of truth. Both `sdlc`
(Step 2) and `plan-next` (its "Routing from Epic status" block) **consume** that
table; neither restates it. A routing change lands in `canonical/phases.md`
only.

This preserves each skill's distinct, non-duplicated logic:

- `sdlc` keeps its invocation-form overrides (`/sdlc "desc"` forces a new epic;
  `/sdlc {name}` targets one) and its phase-execution flow.
- `plan-next` keeps its signal-priority logic (epic-status takes precedence over
  the roadmap's "next unstarted items", which may lag) and its structural-risk
  ranking. Only the *table* it used to restate is delegated.

**2. Do not restore `update-plan`. Fold roadmap refresh into `session-harvest`.**

Rather than reintroduce a separate roadmap-refresh skill, `session-harvest`
gains a roadmap-staleness check: at session close it compares the roadmap's
stated status against actual epic statuses + recent commits, classifies any
drift as a `roadmap-staleness` finding, and drafts the one-line refresh for user
approval. This covers what `update-plan` did, at the moment context is freshest,
without adding a skill or a user-facing fork.

## Consequences

**For the next contributor:** the routing table has one home
(`canonical/phases.md`). `sdlc` and `plan-next` cannot drift apart because they
read the same table. Roadmap-narrative staleness is caught at session close by
`session-harvest`, not left to rot until someone notices.

**Closes F15.** The plan-next ↔ sdlc routing duplication is removed (not merely
documented as consistent). `update-plan` stays dropped; the canonical skill count
is unchanged (12 skills + 1 subagent).

**Permits (the cost):** `sdlc` and `plan-next` are now slightly less
self-contained — an agent routing an epic reads the canonical table in
`phases.md` rather than finding it inline. This matches the scaffold's existing
pattern (skills already read `governance.yaml`, `testing-manifest.json`, the
plan-next stub). The table is tiny and stable.

## What this ADR does *not* do

- Does **not** change the routing *semantics* — the status → phase mapping is
  identical to what both skills already encoded.
- Does **not** change `plan-next`'s signal-priority logic (epic-status still
  outranks the roadmap "next" list) or its structural-risk ranking.
- Does **not** add or remove a skill (`update-plan` stays dropped; the refresh
  folds into `session-harvest`).
- Does **not** touch the governance engine or emitters (`phases.md` is canonical
  vocabulary, not an emitted skill).

## Cross-reference

- `docs/findings/wave4-self-bootstrap.md` F15 — the friction finding this closes.
- `docs/findings/sdlc-redundancy-audit.md` §2c — the analysis (overlap is
  plan-next ↔ sdlc, not plan ↔ plan-next).
- `canonical/phases.md` — the new single-source Epic-status routing table.
- `canonical/skills/sdlc.md`, `canonical/skills/plan-next.md` — consumers.
- `canonical/skills/session-harvest.md` — the folded roadmap-staleness refresh.
