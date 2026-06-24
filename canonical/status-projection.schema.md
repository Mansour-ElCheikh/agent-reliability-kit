# Status-projection schema v1

**spec_version:** 1
**Status:** contract + worked-example refresher (`governance/status-projection.refresher.example.mjs`). A production projector wired to a host's commit lifecycle is host-supplied (ADR-0001, ADR-0017).
**Consumed by:** the host's authoring projector. Sibling of `canonical/plan-next-stub.schema.md` (the read side).

An epic's `**Status:**` line is the single authority (ADR-0011). The read stub consolidates
statuses into one advisory summary; this schema defines the AUTHORING projection: the same one
field is written into `BEGIN/END-GENERATED` regions in the human-readable surfaces that restate
it, so they never drift from the epic. This is the write companion to the read stub.

---

## Source of truth (authoritative)

- Path: `dev/epics/<NNN>-<name>/epic.md`.
- Field: the first line matching `^\*\*Status:\*\*[ \t]*(.+?)[ \t]*$`.
- Value: the `canonical/phases.md` enum (`Defining` / `Approved` / `Planned` / `Building` /
  `Built` / `Shipped`). The projector does not enforce the enum (an out-of-enum value is
  projected verbatim so the drift guard can catch a corruption); the SDLC router enforces it.
- **Fail closed.** If the file is unreadable or the regex misses, the projector ABORTS that
  epic with a non-zero exit and writes nothing. It never substitutes `Unknown` and never
  overwrites a surface from an absent source. This is the deliberate inversion of the read
  refresher's fail-open `Unknown` default, because an authoring projector is a sole writer.

---

## Region markers

Each generated region is delimited by an HTML-comment marker pair so it survives inside human
prose and is found deterministically:

```
<!-- BEGIN-GENERATED:epic-status - do not hand-edit. Source: <src>. Regenerate: <cmd> -->
<payload>
<!-- END-GENERATED:epic-status -->
```

- `<src>` is a repo-relative path to the authoritative epic.md (or `dev/epics/*/epic.md` for
  the rollup). Repo-relative, not absolute, so a region authored from a worktree stays valid.
- `<cmd>` is the host's regenerate command (location-independent, e.g. a project-wide sweep).
- The marker id is `epic-status`; a surface holds at most one region per id.

**Splice rule (idempotent):**

1. If a `BEGIN-GENERATED:epic-status ... END-GENERATED:epic-status` block exists, replace the
   whole block in place. The human chose the location once; the projector maintains content.
2. Else insert the region after the first H1 (`# ...`).
3. Else prepend it.

Re-running with an unchanged source is a no-op (write only on content change).

---

## Surfaces (the projection targets)

| Surface | Path | Payload |
|---|---|---|
| Epic plan | `dev/epics/<NNN>-<name>/plan.md` | `**Status:** <value>`. Per-epic. |
| Epic tasks | `dev/epics/<NNN>-<name>/tasks.md` | `**Epic status:** <value>`. Per-epic. |
| Roadmap | `<repo>/ROADMAP.md` | A `## Epic status (generated)` heading + a one-row-per-epic table. |

A per-epic surface that does not exist is skipped (the projector writes into surfaces the
project keeps). `ROADMAP.md` is projected when the repo has one.

**Regions are stable (no volatile provenance).** A region carries the status value, the
repo-relative source, and the regenerate command, never a per-run timestamp or commit sha.
Volatile provenance in a drift-checked, committed surface would make the guard fire every run
and churn the tree; the generation time is recoverable from `git blame`. A region changes iff
the status (or the source path) changes, which makes the drift check a pure status gate and the
write idempotent.

---

## Generation contract (non-tautological)

- **Generated, never hand-edited.** Every region carries the `GENERATED - do not hand-edit`
  header; the projector writes only on content change, so a hand-edit is a review-visible diff.
- **Non-tautological drift guard.** A `--check` mode recomputes every region from the current
  source and diffs it against the on-disk surface; any difference is a non-zero exit that blocks
  (it does not auto-commit). The predicate
  (`governance/status-projection.refresher.example.test.mjs`) proves the guard is
  non-tautological: corrupt one status to a sentinel, assert `--check` goes red; restore, assert
  green. A generator that echoed its prior projection would stay green on the corrupted source
  and fail the test. Until that predicate is green a projector is `probationary` and `--check` is
  the only sanctioned mode; writing is opt-in.

---

## How a host uses it

The worked example (`governance/status-projection.refresher.example.mjs`) exports the pure
pieces (`parseEpicStatus`, region builders, `spliceRegion`, `computeProjection`) plus a CLI.
A production projector wires it into a host lifecycle: a git post-commit hook, a CI drift gate
(`--check`), or a session-start nudge. That wiring is host-specific and stays host-supplied
(ADR-0001), exactly like the read refresher.

---

## Versioning

This schema is **v1**. Patch: doc clarifications. Minor: a new optional surface (existing
regions keep parsing). Major: renaming the marker id or a required payload (requires an ADR),
because that breaks every committed region.

---

## Cross-reference

- `canonical/plan-next-stub.schema.md` - the read-side sibling.
- `canonical/phases.md` - the status enum.
- ADR-0011 - epic status is the single routing source (why the field is authoritative).
- ADR-0017 - the authoring-side projection decision this formalises.
- ADR-0001 - ships shapes and worked examples, not production runtimes.
- `governance/status-projection.refresher.example.mjs` - the worked example.
