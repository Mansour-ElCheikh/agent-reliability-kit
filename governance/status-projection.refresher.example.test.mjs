// Predicate for the authoring-side status-projection worked example (ADR-0017,
// canonical/status-projection.schema.md). Proves the projector is fail-closed and that its
// drift guard is NON-TAUTOLOGICAL: an echo-only generator would stay green on a corrupted
// source and fail the round-trip test below. Run: node --test governance/status-projection.refresher.example.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEpicStatus,
  buildEpicStatusRegion,
  buildRoadmapRegion,
  spliceRegion,
  computeProjection,
} from './status-projection.refresher.example.mjs';

// --- parseEpicStatus: authoritative read, FAIL CLOSED (never Unknown) ---
test('parseEpicStatus: reads the status, trims, takes the first line', () => {
  assert.equal(parseEpicStatus('# E\n\n**Status:** Building\n**Date:** 2026-06-06\n'), 'Building');
  assert.equal(parseEpicStatus('**Status:**   Shipped  \n'), 'Shipped');
  assert.equal(parseEpicStatus('**Status:** Built\n**Status:** Shipped\n'), 'Built');
});
test('parseEpicStatus: FAIL CLOSED on a missing or empty status', () => {
  assert.throws(() => parseEpicStatus('# E\n\nno status\n'), /status/i);
  assert.throws(() => parseEpicStatus('**Status:**   \n'), /status/i);
  assert.throws(() => parseEpicStatus(''));
});

// --- region builders carry the GENERATED header ---
test('buildEpicStatusRegion / buildRoadmapRegion: markers + do-not-hand-edit + payload', () => {
  const plan = buildEpicStatusRegion({ surface: 'plan', status: 'Building', src: 'dev/epics/001-x/epic.md' });
  assert.match(plan, /<!-- BEGIN-GENERATED:epic-status/);
  assert.match(plan, /<!-- END-GENERATED:epic-status -->/);
  assert.match(plan, /do not hand-edit/i);
  assert.match(plan, /\*\*Status:\*\* Building/);
  assert.match(buildEpicStatusRegion({ surface: 'tasks', status: 'Built', src: 's' }), /\*\*Epic status:\*\* Built/);
  const road = buildRoadmapRegion({ epics: [{ name: '001-x', status: 'Shipped' }], src: 'dev/epics/*/epic.md' });
  assert.match(road, /\| 001-x \| Shipped \|/);
});

// --- spliceRegion: idempotent insert/replace, preserves surrounding prose ---
test('spliceRegion: inserts after H1, replaces in place, is idempotent', () => {
  const region = buildEpicStatusRegion({ surface: 'plan', status: 'Building', src: 's' });
  const once = spliceRegion('# T\n\nPROSE\n', region);
  assert.ok(once.indexOf('# T') < once.indexOf('BEGIN-GENERATED'));
  assert.ok(once.indexOf('BEGIN-GENERATED') < once.indexOf('PROSE'));
  assert.equal(spliceRegion(once, region), once); // idempotent
  const updated = spliceRegion(once, buildEpicStatusRegion({ surface: 'plan', status: 'Shipped', src: 's' }));
  assert.match(updated, /\*\*Status:\*\* Shipped/);
  assert.doesNotMatch(updated, /\*\*Status:\*\* Building/);
  assert.match(updated, /PROSE/);
  assert.equal(updated.match(/BEGIN-GENERATED/g).length, 1);
});

// --- computeProjection: orchestration + FAIL CLOSED ---
function makeRepo(files) {
  const map = new Map(Object.entries(files));
  return { map, readFile: (p) => (map.has(p) ? map.get(p) : null) };
}
const EPICS = [{ name: '001-x', dir: '/repo/dev/epics/001-x' }];
const base = () => ({
  '/repo/dev/epics/001-x/epic.md': '# X\n\n**Status:** Building\n',
  '/repo/dev/epics/001-x/plan.md': '# Plan\n\nbody\n',
  '/repo/dev/epics/001-x/tasks.md': '# Tasks\n\n- t\n',
  '/repo/ROADMAP.md': '# Roadmap\n\nprose\n',
});

test('computeProjection: projects plan, tasks, ROADMAP; skips absent surfaces; no-op on no epics', () => {
  const { readFile } = makeRepo(base());
  const { writes, statuses } = computeProjection({ repoRoot: '/repo', epics: EPICS, readFile });
  assert.deepEqual(writes.map((w) => w.path).sort(), [
    '/repo/ROADMAP.md', '/repo/dev/epics/001-x/plan.md', '/repo/dev/epics/001-x/tasks.md',
  ]);
  assert.deepEqual(statuses, [{ name: '001-x', status: 'Building' }]);
  assert.deepEqual(computeProjection({ repoRoot: '/repo', epics: [], readFile }).writes, []);
});

test('computeProjection: FAIL CLOSED when an epic.md is unreadable or has no status', () => {
  const f1 = base(); delete f1['/repo/dev/epics/001-x/epic.md'];
  assert.throws(() => computeProjection({ repoRoot: '/repo', epics: EPICS, readFile: makeRepo(f1).readFile }), /epic\.md|status/i);
  const f2 = base(); f2['/repo/dev/epics/001-x/epic.md'] = '# X\n\nno status\n';
  assert.throws(() => computeProjection({ repoRoot: '/repo', epics: EPICS, readFile: makeRepo(f2).readFile }), /status/i);
});

// --- THE predicate: non-tautological round-trip (corrupt -> RED, restore -> GREEN) ---
test('round-trip guard: in-sync GREEN, corrupt-to-sentinel RED, restore GREEN', () => {
  const { map, readFile } = makeRepo(base());
  const opts = { repoRoot: '/repo', epics: EPICS, readFile };
  const drift = (r) => r.writes.some((w) => w.before !== w.after);
  for (const w of computeProjection(opts).writes) map.set(w.path, w.after); // apply (committed projection)
  assert.equal(drift(computeProjection(opts)), false, 'in-sync must be GREEN');
  map.set('/repo/dev/epics/001-x/epic.md', '# X\n\n**Status:** SENTINEL_CORRUPT\n');
  assert.equal(drift(computeProjection(opts)), true, 'corrupted source must be RED');
  map.set('/repo/dev/epics/001-x/epic.md', '# X\n\n**Status:** Building\n');
  assert.equal(drift(computeProjection(opts)), false, 'restored source must be GREEN');
});
