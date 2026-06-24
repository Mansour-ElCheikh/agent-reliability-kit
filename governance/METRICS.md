# Pipeline metrics

Two surfaces answer "is the agent pipeline getting **better**, not just busier?" (the question behind rubric Axis 11). Neither is a hosted service; both are deterministic, copyable references the adopter runs.

## 1. The ratchet — warning-count over commits

`.governance-baseline.json` records the warning count per rule and refuses commits that grow it past the baseline (existing warnings grandfathered, new ones not). The baseline only moves on explicit `ratchet update`. This is the *cross-commit* improvement metric: the warning floor only ratchets down. See [`RATCHET.md`](./RATCHET.md).

## 2. The session-metrics reader — in-session dimensions

[`session-metrics.reader.example.mjs`](./session-metrics.reader.example.mjs) reads the session-event log ([schema](../canonical/session-event-log.schema.md), written by [`session-events.writer.example.mjs`](./session-events.writer.example.mjs)) and computes the dimensions the ratchet does not:

| Metric | Meaning | Needs |
|---|---|---|
| **cycle time** (median per session) | wall-clock span from a session's first to last event | `ts` (required) |
| **review latency** (total + mean) | time spent in review-phase events | `duration_ms` on review events |
| **rejection rate** | review events `failed`/`blocked` over all review events (reviewer-agent FAIL→fix cycles) | `outcome` (required) |
| **block rate** / **degraded rate** | blocked writes; Tier 2/3 capability fallbacks | `outcome` (required) |
| **governance trend** | first-to-last `warnings` snapshot in the log | `governance: {warnings}` |
| **context-growth flags** | phases averaging > 5 KB/invocation | `context_kb` |

A rate whose denominator is zero reads `null`, not a fabricated `0` — a sparse log stays honest. The metrics are only as rich as the log: `duration_ms`, `governance`, and `context_kb` are *optional* schema fields, so latency, trend, and context metrics are `null`/empty until the adopter's writer populates them.

```sh
node governance/session-metrics.reader.example.mjs          # text dashboard
node governance/session-metrics.reader.example.mjs --json   # raw metrics JSON
```

```
session-metrics  (7 events across 2 sessions)
  outcomes        passed:5  failed:1  blocked:1  skipped:0  degraded:0
  rejection rate  33.3%  (review failed+blocked / review events)
  cycle time      median 20000 ms  (per-session ts span)
  review latency  mean 1567 ms
  governance      warnings 5 to 3 (net -2)
```

## Honest scope

These are worked examples (ADR-0001: shapes + references, not bundled runtimes). For a live dashboard, an adopter wires their own surface over the reader's `computeMetrics()`. The eval methodology ([`docs/findings/skill-eval-methodology-2026-05.md`](../docs/findings/skill-eval-methodology-2026-05.md)) is the third, slower-loop measurement (pass/fail efficacy with line-cited evidence); it is not a per-session metric and lives with the evals, not here.

## Cross-reference

- [ADR-0023](../docs/decisions/0014-session-metrics-reader.md) — the reader decision and its dimensions.
- [`canonical/session-event-log.schema.md`](../canonical/session-event-log.schema.md) — the log this reads.
- [`RATCHET.md`](./RATCHET.md) — the cross-commit warning-count metric.
