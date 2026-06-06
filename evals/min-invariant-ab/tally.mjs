/**
 * Tally Eval B from vitest's JSON output.
 *
 *   Arm S (shape vs broken):  a PASS  = false-green slip-through.
 *   Arm M (min   vs broken):  a FAIL  = catch (no slip-through).
 *   Control (both vs correct): all must PASS (else the test is broken, not catching).
 *
 * Reports slip-through rate per arm, split by failure class, against the
 * pre-registered bar in docs/findings/eval-min-invariant-ab-2026-06.md.
 */
import { readFileSync } from 'node:fs';
import { scenarios } from './scenarios.mjs';

const results = JSON.parse(readFileSync(new URL('./results.json', import.meta.url), 'utf8'));

const klassOf = Object.fromEntries(scenarios.map((s) => [s.id, s.klass]));
const idFromTitle = (t) => (t.match(/^\[([^\]]+)\]/) ?? [])[1];

// Flatten assertionResults across files, tagged by which arm file they came from.
const byArm = { shape: [], min: [], control: [] };
for (const file of results.testResults ?? []) {
  const arm = file.name.includes('shape.arm')
    ? 'shape'
    : file.name.includes('min.arm')
      ? 'min'
      : 'control';
  for (const a of file.assertionResults ?? []) {
    byArm[arm].push({ id: idFromTitle(a.title), title: a.title, status: a.status });
  }
}

function rate(arm, predicateIsSlip, klass) {
  const rows = byArm[arm].filter((r) => (klass ? klassOf[r.id] === klass : true));
  const slips = rows.filter(predicateIsSlip).length;
  return { slips, total: rows.length, pct: rows.length ? (100 * slips) / rows.length : 0 };
}

const shapePreserving = (r, arm) => klassOf[r.id] === 'shape-preserving';

// Slip = PASS against broken (shape arm) / PASS against broken (min arm).
const isPass = (r) => r.status === 'passed';

const shapeSP = rate('shape', isPass, 'shape-preserving');
const minSP = rate('min', isPass, 'shape-preserving');
const shapeSC = rate('shape', isPass, 'shape-changing');
const minSC = rate('min', isPass, 'shape-changing');
const controlFails = byArm.control.filter((r) => r.status !== 'passed');

const reductionSP = shapeSP.pct - minSP.pct;

const bar = {
  'S slip >= 80% (SP)': shapeSP.pct >= 80,
  'M slip <= 20% (SP)': minSP.pct <= 20,
  'reduction >= 60pp (SP)': reductionSP >= 60,
  'control all green': controlFails.length === 0,
};
const verdict = Object.values(bar).every(Boolean) ? 'PASS (H1 supported)' : 'FAIL / inconclusive';

console.log('\n=== Eval B — Min-Invariant A/B false-green slip-through ===\n');
console.log('Per-scenario (broken impl):');
console.log('  id'.padEnd(28), 'class'.padEnd(18), 'ArmS', 'ArmM');
for (const s of scenarios) {
  const sShape = byArm.shape.find((r) => r.id === s.id)?.status;
  const sMin = byArm.min.find((r) => r.id === s.id)?.status;
  const tagS = sShape === 'passed' ? 'SLIP' : 'caught';
  const tagM = sMin === 'passed' ? 'SLIP' : 'caught';
  console.log('  ' + s.id.padEnd(26), s.klass.padEnd(18), tagS.padEnd(5), tagM);
}
console.log('\nShape-preserving class (the dangerous false-green class):');
console.log(`  Arm S slip-through: ${shapeSP.slips}/${shapeSP.total} = ${shapeSP.pct.toFixed(0)}%`);
console.log(`  Arm M slip-through: ${minSP.slips}/${minSP.total} = ${minSP.pct.toFixed(0)}%`);
console.log(`  Reduction (S - M):  ${reductionSP.toFixed(0)}pp`);
console.log('\nShape-changing control (shape-only should already catch):');
console.log(`  Arm S slip-through: ${shapeSC.slips}/${shapeSC.total}`);
console.log(`  Arm M slip-through: ${minSC.slips}/${minSC.total}`);
console.log(`\nSanity control (both arms vs correct): ${controlFails.length} failure(s)`);
if (controlFails.length) console.log('  FAILURES:', controlFails.map((r) => r.title));
console.log('\nPre-registered bar:');
for (const [k, v] of Object.entries(bar)) console.log(`  [${v ? 'x' : ' '}] ${k}`);
console.log(`\nVERDICT: ${verdict}\n`);
