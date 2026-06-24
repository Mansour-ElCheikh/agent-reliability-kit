# Plan-next context stub schema v1

**spec_version:** 1
**Status:** contract + worked-example refresher (`governance/plan-next-stub.refresher.example.mjs`). A production refresher wired to a host's commit lifecycle is host-supplied (ROADMAP.md v0.2).
**Consumed by:** the `plan-next` skill (reads it first) + the `sdlc` orchestrator (Step 1 state read).

The plan-next context stub is a small (≤40-line) markdown status file a project MAY maintain so `plan-next` and `sdlc` can read current project state cheaply, without re-deriving it from the roadmap + git log + a full governance audit on every invocation. It is the context-growth guardrail the skills assume: read the stub, stop there unless commit-level detail is needed.

The kit ships this contract **plus a minimal worked-example refresher** (`governance/plan-next-stub.refresher.example.mjs`) — the `hook.example.sh` / session-event-writer precedent: a copyable reference that regenerates the stub, not a production runtime. A *production* refresher (a post-commit hook, a CI step, an adopter's dispatcher) is host-specific and stays host-supplied (ADR-0001 ships shapes + worked examples, not contents). This mirrors the session-event log decision (ADR-0001).

---

## File

- Path: project's choice; conventionally `.scaffold/plan-next.md` (regenerable; commit it or gitignore it, project's call).
- Format: Markdown, the sections below. ≤40 lines (a context budget, not a hard limit).
- Lifetime: **regenerated, never hand-edited.** A refresher rewrites it from source (epic statuses + git + governance) on every commit (or on demand). Hand edits are overwritten.

---

## Sections (the contract)

```markdown
# Plan-next — <project>
_Refreshed <ISO8601> from <N> epics, HEAD <shortsha>_

## Milestone
<one line: the current milestone / focus>

## Epic status
<one line per epic, scanned from dev/epics/*/epic.md — AUTHORITATIVE>
- 001-streaming: Built
- 002-import: Building

## Next unstarted items
<from the roadmap — ADVISORY, may lag; trust Epic status on conflict>
- <roadmap item>

## Seam advisories
<optional: hot files / structural risk from the analyser, or "none">

## Governance
<error + warning counts from the last audit, or "not run">
```

### Field contract

| Section | Required | Source | Semantics |
|---|---|---|---|
| `## Epic status` | yes | scanned from `dev/epics/*/epic.md` `**Status:**` lines | **Authoritative routing source** (ADR-0011). One line per epic: `<NNN-name>: <Status>`. |
| `## Milestone` | yes | roadmap / project | Current focus, one line. |
| `## Next unstarted items` | no | roadmap | **Advisory** — may lag; on conflict with Epic status, Epic status wins. |
| `## Seam advisories` | no | analyser | Hot files / structural risk; `none` if no analyser. |
| `## Governance` | no | last audit | `{errors} errors, {warnings} warnings`, or `not run`. |

The header line SHOULD record refresh time + HEAD sha so a consumer can judge staleness (the `sdlc`/`plan-next` skills treat a stub older than ~1h or behind HEAD as stale and fall back to a live read).

---

## How `plan-next` / `sdlc` use it

`plan-next` reads this first and **stops there** unless the user needs commit-level detail. `Epic status` is the routing input; the status → phase mapping is the single canonical table in `canonical/phases.md` (ADR-0011) — the stub supplies the *state*, the table supplies the *routing*. `sdlc` Step 1 reads the same stub for the governance gate + the active milestone. If the stub is absent or stale, both fall back to scanning `dev/epics/*/epic.md` + `git log` + a live audit (their documented fallback); the stub is an optimisation, never a hard dependency.

---

## Versioning

This schema is **v1**. Bump rules mirror the emitter contract:

- Patch: doc clarifications. No version change.
- Minor: new optional sections. Existing stubs keep parsing.
- Major: a change that breaks consumers (renaming/removing a required section). Requires an ADR.

---

## What this document does NOT specify

- The refresher wiring. The example (`governance/plan-next-stub.refresher.example.mjs`) shows the scan + the write; firing it on post-commit / CI / session-start is host-specific.
- How the governance summary is produced (the example reads a prior audit report if present; computing one live is the engine's job, not the refresher's).
- Whether the stub is committed or gitignored (project's choice).

---

## Cross-reference

- `canonical/skills/plan-next.md` — primary consumer (reads it first).
- `canonical/skills/sdlc.md` — Step 1 state read.
- `canonical/phases.md` — the Epic-status → phase routing table (the stub supplies state; this supplies routing).
- `governance/plan-next-stub.refresher.example.mjs` — the worked-example refresher.
- ADR-0011 — epic-status is the single routing source of truth (why `## Epic status` is authoritative).
- ADR-0001 — ships shapes + worked examples, not contents (why the production refresher stays host-supplied).
- `canonical/session-event-log.schema.md` — the sibling schema this mirrors.
