#!/usr/bin/env node
// ADR-0016 numeric-count reconciliation gate, runnable standalone.
// Enforces conventions/repo-documentation.md rule #2 ("numeric claims match
// runtime reality") on this kit's own top-level public surfaces, turning a
// previously PR-time-manual review into a build gate. Mirrors the
// scripts/check-anatomy.mjs pattern (standalone, exit 1 on failure).
//
// Invocation:
//   node scripts/check-counts.mjs [<repo-root>]
//
// Default repo root: process.cwd() (CI runs from the repo root).
//
// Exit 0 if every digit-form count claim on README / ARCHITECTURE / ROADMAP
// equals the runtime probe; exit 1 (with a per-claim diff) otherwise.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The positional public surfaces this gate reconciles (cf. the em-dash gate). */
export const GATED_SURFACES = ['README.md', 'ARCHITECTURE.md', 'ROADMAP.md'];

/**
 * category -> regex capturing the claimed integer from narrative prose. Only
 * digit-form claims are gated; sub-counts written as words ("three test-file
 * predicates") are intentionally out of scope. Keep these anchored to a keyword
 * so numbers like "ADR-0042" or "12/12" never false-match.
 */
export const CLAIM_PATTERNS = {
  predicates: /\b(\d+)\s+(?:deterministic\s+)?predicates\b/gi,
  adrs: /\b(\d+)\s+ADRs\b/gi,
  skills: /\b(\d+)\s+(?:canonical\s+)?skills\b/gi,
  subagents: /\b(\d+)\s+(?:adversarial\s+)?subagents?\b/gi,
};

/**
 * Count registry entries in the engine predicate source (the "grep -c"
 * equivalent rule #2 names). Parsing the source rather than importing the dist
 * keeps the gate runnable with no build step.
 */
export function countRegistryEntries(predicatesSource) {
  const m = predicatesSource.match(/export const BUILTIN_PREDICATES[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  if (!m) throw new Error('could not locate the BUILTIN_PREDICATES registry block');
  return m[1].split('\n').filter((l) => /^\s+[A-Za-z_]\w*,\s*$/.test(l)).length;
}

/** Probe the filesystem + engine source for the real counts. */
export async function gatherGroundTruth(root) {
  const predicatesSrc = await fs.readFile(path.join(root, 'engine/src/predicates.ts'), 'utf8');
  const adrFiles = (await fs.readdir(path.join(root, 'docs/decisions'))).filter((f) =>
    /^\d{4}-.*\.md$/.test(f),
  );
  const skillFiles = (await fs.readdir(path.join(root, 'canonical/skills'))).filter((f) =>
    f.endsWith('.md'),
  );
  const agentFiles = (await fs.readdir(path.join(root, 'canonical/agents'))).filter((f) =>
    f.endsWith('.md'),
  );
  return {
    predicates: countRegistryEntries(predicatesSrc),
    adrs: adrFiles.length,
    skills: skillFiles.length,
    subagents: agentFiles.length,
  };
}

/** Extract every digit-form count claim from the gated surfaces. */
export async function gatherClaims(root, surfaces = GATED_SURFACES) {
  const claims = [];
  for (const surface of surfaces) {
    let text;
    try {
      text = await fs.readFile(path.join(root, surface), 'utf8');
    } catch {
      continue; // a surface that does not exist is not a claim source
    }
    const lines = text.split('\n');
    for (const [category, pattern] of Object.entries(CLAIM_PATTERNS)) {
      for (let i = 0; i < lines.length; i++) {
        const re = new RegExp(pattern.source, pattern.flags); // fresh lastIndex per line
        let mm;
        while ((mm = re.exec(lines[i])) !== null) {
          claims.push({
            category,
            value: Number(mm[1]),
            surface,
            line: i + 1,
            text: lines[i].trim(),
          });
        }
      }
    }
  }
  return claims;
}

/** Pure reconciliation: returns { mismatches, checked }. */
export function reconcileCounts({ groundTruth, claims }) {
  const mismatches = [];
  for (const c of claims) {
    const truth = groundTruth[c.category];
    if (truth === undefined) continue;
    if (c.value !== truth) mismatches.push({ ...c, expected: truth });
  }
  return { mismatches, checked: claims.length };
}

async function main() {
  const root = process.argv[2] ?? process.cwd();
  const groundTruth = await gatherGroundTruth(root);
  const claims = await gatherClaims(root);
  const { mismatches, checked } = reconcileCounts({ groundTruth, claims });

  if (mismatches.length > 0) {
    for (const m of mismatches) {
      const msg = `${m.surface}:${m.line} claims ${m.value} ${m.category}; runtime reality is ${m.expected}  ->  ${m.text}`;
      process.stderr.write(`::error file=${m.surface},line=${m.line}::${msg}\n`);
      process.stderr.write(msg + '\n');
    }
    process.stderr.write(
      `\nNumeric-count reconciliation FAILED: ${mismatches.length} mismatch(es) across ${checked} claim(s).\n`,
    );
    process.exit(1);
  }

  const gt = Object.entries(groundTruth)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  process.stdout.write(
    `Numeric-count reconciliation PASS: ${checked} claim(s) match runtime reality (${gt}).\n`,
  );
}

// Run as a CLI only — stay importable (no side effects) for the test.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((e) => {
    process.stderr.write(`check-counts FATAL: ${e.message}\n`);
    process.exit(1);
  });
}
