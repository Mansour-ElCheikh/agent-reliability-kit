# Session-event log schema v1

**spec_version:** 1
**Status:** contract + worked-example writer (`governance/session-events.writer.example.mjs`). A production writer wired to a host's session lifecycle is a v0.2 candidate (ROADMAP.md).
**Consumed by:** the `session-harvest` skill, and the `session-metrics.reader.example.mjs` worked example (ADR-0014) for pipeline metrics (both read it if the project emits one)

A session-event log is an append-only JSONL file a project MAY emit, one line per skill/phase invocation, so that end-of-session harvest can answer "which skills fired, at what cost, with what outcome" without reconstructing it from memory.

The scaffold ships this contract **plus a minimal worked-example writer** (`governance/session-events.writer.example.mjs`) — the `hook.example.sh` precedent: a copyable reference that appends one conforming record per call, not a production runtime. A *production* writer is tool-specific (a Claude Code SessionEnd / PostToolUse hook, a Cursor wrapper, an adopter's own dispatcher) and stays host-supplied: ADR-0001 ships shapes and worked examples, not contents. Wiring the example into a host's session lifecycle, so it fires automatically per skill/phase, is the v0.2 candidate (ROADMAP.md).

---

## File

- Path: project's choice; conventionally `.scaffold/session-events.jsonl` (gitignored, per-session).
- Format: [JSON Lines](https://jsonlines.org/) — one JSON object per line, UTF-8, newline-terminated. Append-only within a session.
- Lifetime: per-session. Rotated/truncated at session start, or date-stamped. Not committed.

---

## Record shape

```jsonl
{"ts":"2026-05-18T09:14:03Z","session_id":"a1b2c3","skill_or_phase":"review","outcome":"passed","duration_ms":4310,"files_touched":["src/foo.ts"],"context_kb":12.4}
```

### Required fields

| Field | Type | Description |
|---|---|---|
| `ts` | string (ISO 8601 UTC) | When the event completed. |
| `session_id` | string | Stable id for the session (host-assigned or a UUID minted at session start). Groups events. |
| `skill_or_phase` | string | The skill name (`review`, `plan`) or SDLC phase (`build`) the event represents. |
| `outcome` | enum | One of `passed` / `failed` / `blocked` / `skipped` / `degraded`. |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `duration_ms` | number | Wall-clock duration of the invocation. |
| `files_touched` | string[] | Repo-relative paths written/edited during the event. |
| `context_kb` | number | Approx. context the skill consumed when it fired (for context-growth tracking; the `session-harvest` skill flags skills reading > 5 KB/invocation). |
| `governance` | object | `{ "errors": n, "warnings": n }` snapshot if a governance audit ran in the event. |
| `tool` | string | Tool slug the event ran under (`claude-code`, `cursor`) — useful in mixed-tool teams. |
| `notes` | string | Free text; one short line. No newlines (would break JSONL). |

Unknown fields are permitted and ignored by consumers (forward-compatible). Consumers MUST tolerate missing optional fields.

---

## How `session-harvest` uses it

`session-harvest` Step 1 ("Scan the session") reads this log if present to answer, without re-deriving from the transcript:

- Which skills/phases fired and how many times
- Which were `blocked` (governance) or `degraded` (Tier 2/3 capability fallback)
- Which skill consumed the most context (a `context-growth` finding candidate)
- Per-session cost shape (sum of `duration_ms`, count of events)

If the log is absent, `session-harvest` falls back to git log + transcript scanning (its documented behaviour). The log is an optimisation, never a hard dependency.

---

## Versioning

This schema is **v1**. Bump rules mirror the emitter contract:

- Patch: doc clarifications. No version change.
- Minor: new optional fields. Existing logs keep parsing.
- Major: a change that breaks parsing of existing logs (e.g. renaming a required field). Requires an ADR + a consumer deprecation window.

A future writer SHOULD stamp its own `schema_version` field once writers exist and a v2 is on the horizon; v1 readers treat a missing `schema_version` as v1.

---

## What this document does NOT specify

- A production writer wired to a host's session lifecycle. The example writer (`governance/session-events.writer.example.mjs`) shows the append + field validation; firing it automatically on SessionEnd / PostToolUse / commit is host-specific.
- Rotation/retention policy (project's choice).
- Whether the host tool can emit one at all (Tier 1 hosts with session lifecycle hooks can; Tier 3 hosts may need a manual wrapper).

---

## Cross-reference

- `canonical/skills/session-harvest.md` — the end-of-session-harvest consumer
- `governance/session-events.writer.example.mjs` — the worked-example writer
- `governance/session-metrics.reader.example.mjs` + `governance/METRICS.md` — the worked-example reader that turns this log into pipeline metrics (ADR-0014)
- `canonical/emitter-contract.md` — versioning rules this mirrors
- ROADMAP.md — v0.2 "session-event log emitter (host-lifecycle-wired writer)"
- ADR-0001 — "ships shapes + worked examples, not contents" (why the production writer stays host-supplied)
