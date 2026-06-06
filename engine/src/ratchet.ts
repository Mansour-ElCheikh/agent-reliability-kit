/**
 * Ratchet — warning-count baseline that refuses commits growing the count.
 * Implements governance/RATCHET.md (locked at v0.1.0).
 *
 * Baseline file: <repo-root>/.governance-baseline.json (committed to git).
 * Manual `ratchet update` after a passing audit; never auto-updates.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Finding, RatchetBaseline } from './types.js';

export const BASELINE_FILENAME = '.governance-baseline.json';

export async function readBaseline(repoRoot: string): Promise<RatchetBaseline | null> {
  try {
    const raw = await fs.readFile(path.join(repoRoot, BASELINE_FILENAME), 'utf8');
    const parsed = JSON.parse(raw) as RatchetBaseline;
    if (typeof parsed.version !== 'number' || typeof parsed.counts !== 'object') {
      throw new Error(`${BASELINE_FILENAME} is malformed (missing version or counts)`);
    }
    return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** Count only `warn`-severity findings per rule (errors block; audit is record-only). */
export function warnCountsByRule(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    if (f.severity !== 'warn') continue;
    counts[f.ruleId] = (counts[f.ruleId] ?? 0) + 1;
  }
  return counts;
}

export interface RatchetComparison {
  diff: Record<string, { baseline: number; current: number; delta: number }>;
  exceeded: boolean;
  /** rules whose count dropped — eligible for `ratchet update` to lower the floor */
  ratchetDownAvailable: string[];
}

export function compareToBaseline(
  current: Record<string, number>,
  baseline: RatchetBaseline | null,
): RatchetComparison {
  const diff: Record<string, { baseline: number; current: number; delta: number }> = {};
  const base = baseline?.counts ?? {};
  const allRules = new Set([...Object.keys(base), ...Object.keys(current)]);
  let exceeded = false;
  const ratchetDownAvailable: string[] = [];

  for (const rule of allRules) {
    const b = base[rule] ?? 0;
    const c = current[rule] ?? 0;
    const delta = c - b;
    diff[rule] = { baseline: b, current: c, delta };
    if (delta > 0) exceeded = true;
    if (delta < 0) ratchetDownAvailable.push(rule);
  }

  return { diff, exceeded, ratchetDownAvailable };
}

export async function emitBaseline(
  repoRoot: string,
  current: Record<string, number>,
): Promise<RatchetBaseline> {
  const baseline: RatchetBaseline = {
    version: 1,
    ratcheted_at: new Date().toISOString(),
    counts: current,
  };
  await fs.writeFile(
    path.join(repoRoot, BASELINE_FILENAME),
    JSON.stringify(baseline, null, 2) + '\n',
    'utf8',
  );
  return baseline;
}
