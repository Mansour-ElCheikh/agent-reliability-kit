/**
 * Self-test for the session-metrics reader worked example (ADR-0023).
 * Run: node --test governance/session-metrics.reader.test.mjs
 *
 * Asserts concrete metric values (Min-Invariant discipline: counts, rates,
 * deltas, never bare "is defined") over a synthetic event set with known
 * answers, plus the JSONL read path (bad lines tolerated).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeMetrics, readMetrics } from './session-metrics.reader.example.mjs';

// session s1: plan(pass) -> build(pass) -> review(fail) -> review(pass), 30s span
// session s2: plan(pass) -> build(blocked) -> review(pass), 10s span
const EVENTS = [
  {
    ts: '2026-06-04T10:00:00Z',
    session_id: 's1',
    skill_or_phase: 'plan',
    outcome: 'passed',
    duration_ms: 1000,
    governance: { errors: 0, warnings: 5 },
  },
  {
    ts: '2026-06-04T10:00:10Z',
    session_id: 's1',
    skill_or_phase: 'build',
    outcome: 'passed',
    duration_ms: 5000,
  },
  {
    ts: '2026-06-04T10:00:20Z',
    session_id: 's1',
    skill_or_phase: 'review',
    outcome: 'failed',
    duration_ms: 2000,
  },
  {
    ts: '2026-06-04T10:00:30Z',
    session_id: 's1',
    skill_or_phase: 'review',
    outcome: 'passed',
    duration_ms: 1500,
    governance: { errors: 0, warnings: 3 },
  },
  {
    ts: '2026-06-04T11:00:00Z',
    session_id: 's2',
    skill_or_phase: 'plan',
    outcome: 'passed',
    duration_ms: 800,
  },
  {
    ts: '2026-06-04T11:00:05Z',
    session_id: 's2',
    skill_or_phase: 'build',
    outcome: 'blocked',
    duration_ms: 200,
    context_kb: 8,
  },
  {
    ts: '2026-06-04T11:00:10Z',
    session_id: 's2',
    skill_or_phase: 'review',
    outcome: 'passed',
    duration_ms: 1200,
  },
];

test('counts events, sessions, and outcomes', () => {
  const m = computeMetrics(EVENTS);
  assert.equal(m.events, 7);
  assert.equal(m.sessions, 2);
  assert.equal(m.byOutcome.passed, 5);
  assert.equal(m.byOutcome.failed, 1);
  assert.equal(m.byOutcome.blocked, 1);
  assert.equal(m.byOutcome.skipped, 0);
  assert.equal(m.byOutcome.degraded, 0);
});

test('rejection rate is review failed+blocked over review events', () => {
  const m = computeMetrics(EVENTS);
  // 3 review events; 1 failed -> 1/3
  assert.ok(Math.abs(m.rejectionRate - 1 / 3) < 1e-9, `rejectionRate=${m.rejectionRate}`);
});

test('block rate is blocked over all events', () => {
  const m = computeMetrics(EVENTS);
  assert.ok(Math.abs(m.blockRate - 1 / 7) < 1e-9, `blockRate=${m.blockRate}`);
});

test('cycle time is per-session ts span; median across sessions', () => {
  const m = computeMetrics(EVENTS);
  assert.equal(m.cycleTimeMsBySession.s1, 30000);
  assert.equal(m.cycleTimeMsBySession.s2, 10000);
  assert.equal(m.medianCycleTimeMs, 20000); // even count -> mean of the two
});

test('review latency totals and means review-phase durations', () => {
  const m = computeMetrics(EVENTS);
  assert.equal(m.reviewLatencyMs.total, 2000 + 1500 + 1200); // 4700
  assert.ok(Math.abs(m.reviewLatencyMs.mean - 4700 / 3) < 1e-9);
});

test('governance trend reads warnings from first to last snapshot', () => {
  const m = computeMetrics(EVENTS);
  assert.equal(m.governanceTrend.firstWarnings, 5);
  assert.equal(m.governanceTrend.lastWarnings, 3);
  assert.equal(m.governanceTrend.delta, -2); // improved
});

test('context-growth flags phases above the 5 KB threshold', () => {
  const m = computeMetrics(EVENTS);
  const build = m.contextGrowthFlags.find((f) => f.phase === 'build');
  assert.ok(build, 'build flagged');
  assert.equal(build.meanContextKb, 8);
});

test('empty input degrades gracefully (no throw, null rates)', () => {
  const m = computeMetrics([]);
  assert.equal(m.events, 0);
  assert.equal(m.sessions, 0);
  assert.equal(m.medianCycleTimeMs, null);
  assert.equal(m.rejectionRate, null);
  assert.equal(m.reviewLatencyMs, null);
  assert.equal(m.governanceTrend, null);
});

test('readMetrics parses JSONL and tolerates a malformed line', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-'));
  const log = path.join(dir, 'session-events.jsonl');
  const lines = EVENTS.map((e) => JSON.stringify(e));
  lines.splice(3, 0, '{ this is not valid json'); // a corrupt line in the middle
  await fs.writeFile(log, lines.join('\n') + '\n', 'utf8');
  const m = await readMetrics(log);
  assert.equal(m.events, 7); // corrupt line skipped, all 7 valid events counted
  assert.equal(m.skippedLines, 1);
  await fs.rm(dir, { recursive: true, force: true });
});
