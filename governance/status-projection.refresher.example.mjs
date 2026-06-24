#!/usr/bin/env node
/**
 * Worked-example AUTHORING-side status-projection refresher.
 *
 * ADR-0001 ships shapes + worked examples, not production runtimes. This is the authoring
 * companion to `governance/plan-next-stub.refresher.example.mjs` (the read side): a copyable
 * reference that fans one `epic.md` `**Status:**` (the single authority, ADR-0011) out to the
 * `BEGIN/END-GENERATED:epic-status` regions in `plan.md`, `tasks.md`, and `ROADMAP.md`
 * (`canonical/status-projection.schema.md`).
 *
 * Two rules distinguish it from the read refresher, because it is a sole writer of surfaces:
 *   - FAIL CLOSED: an unreadable epic.md or a missing `**Status:**` aborts that epic and writes
 *     nothing (never `Unknown`). The read refresher fails OPEN to `Unknown`, fine for a stub.
 *   - STABLE regions: a region carries the status value, a repo-relative source, and the
 *     regenerate command, never a timestamp or sha, so `--check` is a pure status-drift gate
 *     and writing is idempotent. The "when" is recoverable from `git blame`.
 *
 * A *production* projector wires this into a host lifecycle (post-commit, a CI `--check` gate,
 * a session-start nudge) and may sweep many repos; that wiring is yours.
 *
 *   Library: import { computeProjection } from './governance/status-projection.refresher.example.mjs'
 *   CLI:     node governance/status-projection.refresher.example.mjs <repoPath> [--check]
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, renameSync } from 'node:fs';

const MARKER_ID = 'epic-status';
const REGEN_CMD = 'node governance/status-projection.refresher.example.mjs <repoPath>';

/** Authoritative read. FAIL CLOSED: throws on a missing/empty `**Status:**` (never Unknown). */
export function parseEpicStatus(epicText) {
  if (typeof epicText !== 'string' || epicText.trim() === '') {
    throw new Error('FAIL CLOSED: epic.md is empty or unreadable; refusing to project a status');
  }
  const m = epicText.match(/^\*\*Status:\*\*[ \t]*(.+?)[ \t]*$/m);
  if (!m || m[1].trim() === '') {
    throw new Error('FAIL CLOSED: no parseable **Status:** line in epic.md; refusing to default to Unknown');
  }
  return m[1].trim();
}

function beginMarker(src, cmd) {
  return `<!-- BEGIN-GENERATED:${MARKER_ID} - do not hand-edit. Source: ${src}. Regenerate: ${cmd} -->`;
}
function endMarker() {
  return `<!-- END-GENERATED:${MARKER_ID} -->`;
}

/** Per-epic region for plan.md / tasks.md. `surface` is 'plan' or 'tasks'. */
export function buildEpicStatusRegion({ surface, status, src, cmd = REGEN_CMD }) {
  const label = surface === 'tasks' ? '**Epic status:**' : '**Status:**';
  return [beginMarker(src, cmd), `${label} ${status}`, endMarker()].join('\n');
}

/** Repo-level rollup region for ROADMAP.md: one row per epic. */
export function buildRoadmapRegion({ epics, src, cmd = REGEN_CMD }) {
  const rows = epics.map((e) => `| ${e.name} | ${e.status} |`).join('\n');
  return [
    beginMarker(src, cmd),
    '## Epic status (generated)',
    '',
    '| Epic | Status |',
    '|---|---|',
    rows,
    endMarker(),
  ].join('\n');
}

/**
 * Splice a generated region into a markdown file. Idempotent: replace an existing region in
 * place, else insert after the first H1, else prepend. Text outside the region is preserved.
 */
export function spliceRegion(fileText, regionText, markerId = MARKER_ID) {
  const blockRe = new RegExp(`<!-- BEGIN-GENERATED:${markerId}[\\s\\S]*?<!-- END-GENERATED:${markerId} -->`);
  if (blockRe.test(fileText)) return fileText.replace(blockRe, regionText);
  const lines = fileText.split('\n');
  const i = lines.findIndex((l) => /^#\s/.test(l));
  if (i >= 0) {
    let at = i + 1;
    if (lines[at] === '') at++;
    lines.splice(at, 0, regionText, '');
    return lines.join('\n');
  }
  return `${regionText}\n\n${fileText}`;
}

/**
 * Compute the projection for a repo. Pure: `readFile(path)` returns the file text or null;
 * each epic is `{ name, dir }` with `dir` the absolute epic directory.
 * Returns { writes: [{ path, before, after }], statuses: [{ name, status }] }.
 *   - A per-epic surface that does not exist is skipped.
 *   - ROADMAP.md is projected only when it exists and there is >=1 epic.
 *   - FAIL CLOSED: throws if any epic.md is unreadable or has no parseable status.
 * `--check` = any write where before !== after is drift; `--write` = persist those.
 */
export function computeProjection({ repoRoot, epics, readFile }) {
  const writes = [];
  const statuses = [];
  for (const epic of epics) {
    const epicPath = `${epic.dir}/epic.md`;
    const epicText = readFile(epicPath);
    if (epicText == null) throw new Error(`FAIL CLOSED: epic.md unreadable at ${epicPath}; refusing to project`);
    const status = parseEpicStatus(epicText);
    statuses.push({ name: epic.name, status });
    const srcLabel = `dev/epics/${epic.name}/epic.md`; // repo-relative, worktree-independent
    for (const surface of ['plan', 'tasks']) {
      const path = `${epic.dir}/${surface}.md`;
      const before = readFile(path);
      if (before == null) continue;
      const region = buildEpicStatusRegion({ surface, status, src: srcLabel });
      writes.push({ path, before, after: spliceRegion(before, region) });
    }
  }
  if (epics.length > 0) {
    const path = `${repoRoot}/ROADMAP.md`;
    const before = readFile(path);
    if (before != null) {
      const region = buildRoadmapRegion({ epics: statuses, src: 'dev/epics/*/epic.md' });
      writes.push({ path, before, after: spliceRegion(before, region) });
    }
  }
  return { writes, statuses };
}

// ---------------------------------------------------------------------------
// CLI (runs only when invoked directly; the wiring into a lifecycle is yours).
// ---------------------------------------------------------------------------
function readFileOrNull(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
function listEpics(repoRoot) {
  const dir = `${repoRoot}/dev/epics`;
  let names;
  try { names = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
  catch { return []; }
  names.sort((a, b) => a.localeCompare(b));
  return names.map((name) => ({ name, dir: `${dir}/${name}` })).filter((e) => existsSync(`${e.dir}/epic.md`));
}
function atomicWrite(path, content) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const repoRoot = args.find((a) => !a.startsWith('--'));
  if (!repoRoot) {
    process.stderr.write('usage: status-projection.refresher.example.mjs <repoPath> [--check]\n');
    process.exit(2);
  }
  const epics = listEpics(repoRoot);
  if (epics.length === 0) {
    process.stdout.write(`skip: no dev/epics in ${repoRoot}\n`);
    process.exit(0);
  }
  let result;
  try {
    result = computeProjection({ repoRoot, epics, readFile: readFileOrNull });
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
  const drifted = result.writes.filter((w) => w.before !== w.after);
  if (check) {
    if (drifted.length) {
      process.stderr.write(`DRIFT: ${drifted.length} stale surface(s) in ${repoRoot}\n`);
      process.exit(1);
    }
    process.stdout.write(`ok: ${epics.length} epic(s), ${result.writes.length} surface(s) in sync\n`);
    process.exit(0);
  }
  for (const w of drifted) atomicWrite(w.path, w.after);
  process.stdout.write(`${repoRoot}: ${epics.length} epic(s), ${drifted.length} surface(s) written\n`);
  process.exit(0);
}
