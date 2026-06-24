#!/usr/bin/env node
/**
 * Worked-example session-metrics reader (ADR-0023).
 *
 * The read side of the session-event log. `session-events.writer.example.mjs`
 * appends one JSONL record per skill/phase (schema: `canonical/session-event-log.schema.md`);
 * this reads that log and turns it into pipeline-improvement metrics — the
 * dimensions the warning-count ratchet does not cover: cycle time, review
 * latency, rejection rate, plus a governance-warning trend and context-growth
 * flags. Together with the ratchet (`governance/RATCHET.md`, warning-count over
 * commits) these answer "is the pipeline getting better, not just busier?".
 *
 * Like every governance/* example, this is a copyable reference, NOT a bundled
 * dashboard service (ADR-0001 ships shapes + worked examples, not runtimes). A
 * hosted dashboard is the adopter's; this shows the computation + a text render.
 *
 * Library use:
 *   import { readMetrics, computeMetrics } from './governance/session-metrics.reader.example.mjs';
 *   const m = await readMetrics('.scaffold/session-events.jsonl');
 *
 * CLI use:
 *   node governance/session-metrics.reader.example.mjs           # text dashboard
 *   node governance/session-metrics.reader.example.mjs --json    # raw metrics JSON
 *
 * Env:
 *   SCAFFOLD_SESSION_LOG  log path (default .scaffold/session-events.jsonl), matches the writer.
 */

import { readFile } from 'node:fs/promises';

const DEFAULT_LOG = process.env.SCAFFOLD_SESSION_LOG ?? '.scaffold/session-events.jsonl';
const KNOWN_OUTCOMES = ['passed', 'failed', 'blocked', 'skipped', 'degraded'];
/** A skill/phase consuming more than this (mean KB/invocation) is a context-growth flag. */
const CONTEXT_KB_THRESHOLD = 5;

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function median(arr) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Reduce an array of session-event records to pipeline metrics. Pure; tolerant
 * of missing optional fields (the schema is forward-compatible). Rates are
 * `null` when their denominator is zero rather than NaN, so a sparse log reads
 * honestly instead of dividing by nothing.
 */
export function computeMetrics(events) {
  const byOutcome = Object.fromEntries(KNOWN_OUTCOMES.map((o) => [o, 0]));
  const sessions = new Map(); // session_id -> { min, max } ts in ms
  const byPhase = {}; // phase -> { count, totalDurationMs, outcomes }
  const reviewDurations = [];
  let reviewCount = 0;
  let reviewRejected = 0;
  const govSnapshots = []; // { t, warnings, errors }
  const ctxByPhase = {}; // phase -> { sum, n }

  for (const e of events) {
    if (e.outcome in byOutcome) byOutcome[e.outcome] += 1;

    const t = Date.parse(e.ts);
    if (e.session_id != null && Number.isFinite(t)) {
      const s = sessions.get(e.session_id) ?? { min: t, max: t };
      s.min = Math.min(s.min, t);
      s.max = Math.max(s.max, t);
      sessions.set(e.session_id, s);
    }

    const phase = e.skill_or_phase ?? 'unknown';
    const bp = (byPhase[phase] ??= { count: 0, totalDurationMs: 0, outcomes: {} });
    bp.count += 1;
    if (typeof e.duration_ms === 'number') bp.totalDurationMs += e.duration_ms;
    bp.outcomes[e.outcome] = (bp.outcomes[e.outcome] ?? 0) + 1;

    if (/review/i.test(phase)) {
      reviewCount += 1;
      if (e.outcome === 'failed' || e.outcome === 'blocked') reviewRejected += 1;
      if (typeof e.duration_ms === 'number') reviewDurations.push(e.duration_ms);
    }

    if (e.governance && typeof e.governance.warnings === 'number' && Number.isFinite(t)) {
      govSnapshots.push({ t, warnings: e.governance.warnings, errors: e.governance.errors ?? 0 });
    }

    if (typeof e.context_kb === 'number') {
      const c = (ctxByPhase[phase] ??= { sum: 0, n: 0 });
      c.sum += e.context_kb;
      c.n += 1;
    }
  }

  const cycleTimeMsBySession = {};
  for (const [sid, s] of sessions) cycleTimeMsBySession[sid] = s.max - s.min;
  const spans = Object.values(cycleTimeMsBySession);

  govSnapshots.sort((a, b) => a.t - b.t);

  return {
    events: events.length,
    sessions: sessions.size,
    byOutcome,
    byPhase,
    rejectionRate: reviewCount ? reviewRejected / reviewCount : null,
    blockRate: events.length ? byOutcome.blocked / events.length : null,
    degradedRate: events.length ? byOutcome.degraded / events.length : null,
    cycleTimeMsBySession,
    medianCycleTimeMs: spans.length ? median(spans) : null,
    reviewLatencyMs: reviewDurations.length
      ? { total: sum(reviewDurations), mean: sum(reviewDurations) / reviewDurations.length }
      : null,
    governanceTrend: govSnapshots.length
      ? {
          firstWarnings: govSnapshots[0].warnings,
          lastWarnings: govSnapshots[govSnapshots.length - 1].warnings,
          delta: govSnapshots[govSnapshots.length - 1].warnings - govSnapshots[0].warnings,
        }
      : null,
    contextGrowthFlags: Object.entries(ctxByPhase)
      .map(([phase, c]) => ({ phase, meanContextKb: c.sum / c.n }))
      .filter((f) => f.meanContextKb > CONTEXT_KB_THRESHOLD),
  };
}

/**
 * Read a JSONL session-event log and compute metrics. Malformed lines are
 * counted in `skippedLines` and ignored rather than aborting the read. A
 * missing log returns zeroed metrics with `missing: true`.
 */
export async function readMetrics(logPath = DEFAULT_LOG) {
  let raw;
  try {
    raw = await readFile(logPath, 'utf8');
  } catch {
    return { ...computeMetrics([]), skippedLines: 0, logPath, missing: true };
  }
  const events = [];
  let skippedLines = 0;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      skippedLines += 1;
    }
  }
  return { ...computeMetrics(events), skippedLines, logPath };
}

/** Render metrics as a one-screen text dashboard. */
export function renderDashboard(m) {
  const pct = (x) => (x == null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
  const ms = (x) => (x == null ? 'n/a' : `${x} ms`);
  const lines = [
    `session-metrics  (${m.events} events across ${m.sessions} sessions)`,
    `  outcomes        ${Object.entries(m.byOutcome).map(([k, v]) => `${k}:${v}`).join('  ')}`,
    `  rejection rate  ${pct(m.rejectionRate)}  (review failed+blocked / review events)`,
    `  block rate      ${pct(m.blockRate)}`,
    `  degraded rate   ${pct(m.degradedRate)}  (Tier 2/3 capability fallback)`,
    `  cycle time      median ${ms(m.medianCycleTimeMs)}  (per-session ts span)`,
    `  review latency  ${m.reviewLatencyMs ? `mean ${Math.round(m.reviewLatencyMs.mean)} ms` : 'n/a'}`,
    `  governance      ${m.governanceTrend ? `warnings ${m.governanceTrend.firstWarnings} to ${m.governanceTrend.lastWarnings} (net ${m.governanceTrend.delta})` : 'n/a'}`,
  ];
  if (m.contextGrowthFlags?.length) {
    lines.push(
      `  context growth  ${m.contextGrowthFlags.map((f) => `${f.phase}:${f.meanContextKb.toFixed(1)}KB`).join('  ')}  (> ${CONTEXT_KB_THRESHOLD} KB/invocation)`,
    );
  }
  return lines.join('\n');
}

// CLI entry point (only runs when invoked directly, not when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  const asJson = process.argv.includes('--json');
  readMetrics()
    .then((m) => {
      if (m.missing) {
        process.stderr.write(`no session-event log at ${m.logPath} (nothing to read yet)\n`);
        process.exit(0);
      }
      process.stdout.write((asJson ? JSON.stringify(m, null, 2) : renderDashboard(m)) + '\n');
    })
    .catch((err) => {
      process.stderr.write(`${err.message ?? err}\n`);
      process.exit(1);
    });
}
