# ADR-0012: One-shot gated orchestrator entry for /sdlc

**Status:** Accepted
**Date:** 2026-06-07
**Supersedes:** None

## Context

`/sdlc` routes an EXISTING epic by its `**Status:**` (ADR-0011, the single routing source).
But the north-star entry is one prompt -> a full gated run, and a brand-new task has no epic
and no status to route on. An autonomy-capstone dry-run (2026-06-06) confirmed the gap: the
skill assumed an epic already existed, so the agent hand-built the epic/tasks scaffold and
hand-sequenced the phases. Two concrete holes:

1. **No concrete one-shot bootstrap.** `/sdlc "description"` is documented as "force a new
   epic", but the steps to create `dev/epics/<NNN>-<slug>/{epic.md,tasks.md,adr.md}` by
   reading the target repo (next number, conventions) were not spelled out, so it was done by
   hand each time.
2. **The ship boundary was self-checked.** "verify test output before final status update"
   relied on the agent honestly running and reading the tests. ADR-0013 builds the
   deterministic ship gate; this ADR wires it into the orchestrator so ship is gated by a
   mechanism, not goodwill.

Constraints: the kit is a skill the agent follows plus local CLIs it calls (ADR-0001/0008) -
NOT a runtime that drives the model. Routing stays single-sourced in `canonical/phases.md`
(ADR-0011). The orchestrator must honor the concurrency interlock before it spawns autonomous
runs (the claim ledger — external; adopters wire their own, the scaffold ships the contract).

## Decision

**Generalize `canonical/skills/sdlc.md` into the one-shot gated entry: a concrete Step 0
that bootstraps a new task from a prompt by reading the TARGET repo, the existing routing for
in-flight epics, and a ship step that runs the gate (ADR-0013) and blocks on red.** Three
additions, no fork (ADR-0006 forbids a sibling Define skill; this extends the orchestrator):

1. **Step 0 - claim, then bootstrap.**
   - *Interlock first (only when spawning an autonomous run / a new worktree-session):* claim
     in the ledger with the task scope, `<concurrency-claim command> --hard --globs <scope>
     --critical-path <name>`; on a non-zero exit (WIP-cap breach or glob collision) do NOT
     spawn - surface the breach. An ordinary interactive `/sdlc` is already claimed by the
     SessionStart hook, so this is the machine-spawn guard (the HARD INVARIANT).
   - *One-shot bootstrap (when `/sdlc "<prompt>"` and no in-flight epic):* read the target
     repo - list `dev/epics/` (create it if absent), take the highest existing number + 1 as
     `<NNN>`, read the repo's conventions/governance for shape - then create
     `dev/epics/<NNN>-<slug>/epic.md` (`**Status:** Defining`), `tasks.md` (the
     `| # | Spec | Task | TDD Behavior | Min-Invariant | Status |` table), and `adr.md`. This
     is the de-hardcoding: numbers and conventions are READ from the target repo, never
     assumed from one spine's layout.
2. **Route (unchanged authority).** Consume the `canonical/phases.md` Epic-status routing
   table (ADR-0011). A freshly bootstrapped epic is `Defining` -> Define phase; everything
   else routes as before. The skill does not restate the table.
3. **Gate at ship.** At the Built -> Shipped boundary, run `reliability-engine gate` (ADR-0013)
   and refuse to ship on a non-zero exit. This replaces the self-imposed "verify test output"
   with the deterministic gate; release-on-harvest (the ledger) then fires via the Stop hook.

Governance-first triad: this ADR + the updated `canonical/skills/sdlc.md` (the convention
surface for the orchestrator) + the existing `min_invariant_per_task` predicate that governs
the `tasks.md` the bootstrap writes (the scaffolded table is immediately under that rule).

## Consequences

- `/sdlc "<prompt>"` runs the whole loop from one prompt: claim -> bootstrap -> Define ->
  Build (TDD) -> ship gate -> ship -> release. The agent follows the rails; the CLIs
  (ledger, gate) are the deterministic guardrails the human supervises.
- De-hardcoded: the orchestrator works in any repo that adopts the `dev/epics/` convention,
  reading that repo's numbers and rules. A repo with no `dev/epics/` gets one created.
- **Permitted failure:** bootstrap presumes the `dev/epics/` epic convention. A repo that
  organises work differently is out of scope for the bootstrap (documented), though the gate
  (ADR-0013) is convention-agnostic.
- **Failure modes prevented:** F4 (routing stays single-sourced in phases.md; the skill reads
  it), F6 (no orchestrator runtime - the agent + skill + two small CLIs, no engine that
  drives the model), and the dry-run's two concrete gaps are closed by a mechanism each.

## What this ADR does *not* do

- It does not add a Define-phase sibling skill (ADR-0006); it extends `sdlc`.
- It does not restate or change the routing table (ADR-0011).
- It does not build a programmatic phase runner; `sdlc` remains a skill the agent follows.
- It does not implement the gate (ADR-0013) or the ledger (an external concurrency interlock); it wires them
  in at the spawn and ship boundaries.

## Cross-reference

- `canonical/skills/sdlc.md` (the generalized orchestrator), `canonical/phases.md` (routing,
  ADR-0011), `canonical/skills/build.md` (TDD runner)
- ADR-0013 (ship gate), ADR-0006 (no Define sibling), ADR-0011 (routing single source)
- The external concurrency-interlock contract (the spawn interlock; the scaffold wires it, does not ship it)
- Internal autonomy-capstone spec (gap 1)
