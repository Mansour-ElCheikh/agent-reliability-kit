# ADR-0023: Ship a session-metrics reader for pipeline-improvement metrics over the event log

**Status:** Accepted
**Date:** 2026-06-04
**Supersedes:** None

## Context

Axis 11 of the external SDLC-factory rubric (`docs/findings/sdlc-axes-scoring-2026-05.md` §Axis 11) asks for metrics that show whether the agent pipeline is getting **better**, not just producing **more**. It scored `PARTIAL`: the ratchet (`.governance-baseline.json`) tracks warning-count over commits, and the case-study eval produces the lift number, but the dimensions the finding explicitly named as missing, cycle-time, review-latency, and rejection-rate, had no shipped reader.

The 2026-06-03 flip shipped the session-event **writer** (`governance/session-events.writer.example.mjs`) and its schema (`canonical/session-event-log.schema.md`). The log carries the raw fields those metrics need, `duration_ms`, `outcome`, a per-event `governance: {errors, warnings}` snapshot, `context_kb`, but nothing read the log to compute anything. The write side existed; the read side did not. That is the open half of Axis 11.

## Decision

**Ship `governance/session-metrics.reader.example.mjs`, the read side of the session-event log, as a worked example (the `hook.example.sh` / writer precedent under ADR-0001: a copyable reference, not a hosted service).**

`computeMetrics(events)` is a pure reduction of event records to the dimensions the ratchet does not cover:

- **cycle time** per session (last-minus-first `ts` span) plus the median across sessions;
- **review latency** (total and mean `duration_ms` of review-phase events);
- **rejection rate** (review events with `outcome` `failed`/`blocked` over all review events, i.e. the reviewer-agent FAIL→fix cycles);
- **block rate** and **degraded rate** (the Tier 2/3 capability-fallback signal);
- a **governance-warning trend** (first-to-last `governance.warnings` snapshot in the log);
- **context-growth flags** (phases averaging more than 5 KB/invocation, the threshold `session-harvest` already names).

`readMetrics(logPath)` reads the JSONL log and tolerates malformed lines (counted in `skippedLines`, never aborting). A text dashboard render plus a `--json` mode ship as the CLI. Rates whose denominator is zero return `null`, not `NaN`, so a sparse log reads honestly. The reader is TDD-driven: `governance/session-metrics.reader.test.mjs` asserts concrete metric values (counts, rates, deltas, per the Min-Invariant discipline) over a synthetic event set with known answers, run via `node --test`.

Together with the ratchet (warning-count over commits, `governance/RATCHET.md`) and the dimensions doc (`governance/METRICS.md`), this completes the writer→log→reader loop. Axis 11 moves from `PARTIAL` to `SOLID` (re-scored in the 2026-06 finding).

## Consequences

**For the next contributor:** a project that emits the session-event log now gets cycle-time, review-latency, rejection-rate, and a governance trend from one command, with no hosted service to stand up. The metrics answer "is the pipeline improving?" rather than only "how many events fired?".

**Prevents** the activity-vs-improvement gap the axis warns about: event *counts* are activity; rejection-rate trending down and cycle-time trending down are *improvement*.

**Permits (the cost):** it is a worked-example reader, not a hosted dashboard, so an adopter who wants a live surface wires their own over `computeMetrics`. The metrics are only as rich as the log the adopter emits, `duration_ms`, `governance`, and `context_kb` are optional schema fields, so review-latency, governance-trend, and context-growth read `null`/empty when absent. That is by design (null, not a fabricated zero), but it means the richest metrics require the adopter to populate the optional fields.

## What this ADR does *not* do

- Does **not** ship a hosted dashboard or observability service. Worked example only (ADR-0001).
- Does **not** add an engine predicate. The reader is a `governance/` worked example like the writer, not part of the rules engine; the registry stays at eleven.
- Does **not** wire a host-lifecycle writer. The reader reads whatever log exists; the auto-firing writer stays the v0.2 candidate (ROADMAP.md).
- Does **not** replace the ratchet. Warning-count-over-commits stays the ratchet's job (`RATCHET.md`); the reader's governance-trend is the in-session snapshot complement.

## Cross-reference

- ADR-0001 (ships shapes + worked examples, not runtimes) — why the reader is an example, not a service.
- `docs/findings/sdlc-axes-scoring-2026-05.md` §Axis 11 (the `PARTIAL` gap) and the 2026-06 re-score (the close to `SOLID`).
- `canonical/session-event-log.schema.md` (the schema the reader consumes);
  `governance/session-events.writer.example.mjs` (the write side).
- `governance/RATCHET.md` (the complementary warning-count metric);
  `governance/METRICS.md` (the metric-dimensions doc).
- `governance/session-metrics.reader.example.mjs` + `governance/session-metrics.reader.test.mjs` (the reader and its 9 `node --test` cases).
