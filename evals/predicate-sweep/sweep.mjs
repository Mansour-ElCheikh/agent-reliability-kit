#!/usr/bin/env node
/**
 * Eval B2 — run the shipped Min-Invariant predicates against REAL artefacts to
 * measure real-world findings (true-positive vs false-positive), since Eval B
 * proved the mechanism on synthetic fixtures only.
 *
 *   node evals/predicate-sweep/sweep.mjs <repoRoot>
 *
 * Sweeps <repoRoot>/dev/epics/​**​/tasks.md  with tasks_min_invariant
 *    and <repoRoot>/src/​**​/*.test.ts        with test_shape_assertions
 * and prints every finding (file:line + message) for hand-classification.
 */
import { tasks_min_invariant, test_shape_assertions } from '../../engine/dist/predicates.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.argv[2] ?? '.';

async function walk(dir, match, out = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, match, out);
    else if (match(full)) out.push(full);
  }
  return out;
}

function mkInput(filePath, fileContent, rule) {
  return { filePath, fileContent, rule, context: {} };
}

async function runPredicate(label, files, predicate, ruleId) {
  const rule = { id: ruleId, severity: 'warn', description: '', enforcement: ['engine'], check: ruleId };
  let total = 0;
  console.log(`\n=== ${label} — ${files.length} file(s) ===`);
  for (const f of files) {
    const content = await fs.readFile(f, 'utf8');
    const findings = await predicate(mkInput(path.relative(repoRoot, f), content, rule));
    for (const fd of findings) {
      total++;
      console.log(`  ${fd.filePath}${fd.line ? ':' + fd.line : ''} — ${fd.message}`);
    }
  }
  console.log(`  TOTAL ${label} findings: ${total}`);
  return total;
}

const tasksFiles = await walk(path.join(repoRoot, 'dev', 'epics'), (f) => f.endsWith('tasks.md'));
const testFiles = await walk(path.join(repoRoot, 'src'), (f) => /\.test\.ts$/.test(f));

const t = await runPredicate('tasks_min_invariant (R21) vs real tasks.md', tasksFiles, tasks_min_invariant, 'min_invariant_per_task');
const s = await runPredicate('test_shape_assertions (R20) vs real *.test.ts', testFiles, test_shape_assertions, 'test_invariants');

console.log(`\n=== SWEEP SUMMARY ===`);
console.log(`tasks.md files: ${tasksFiles.length}, findings: ${t}`);
console.log(`*.test.ts files: ${testFiles.length}, findings: ${s}`);
console.log(`(classify each finding TP/FP by reading the flagged cell/assertion above)`);
