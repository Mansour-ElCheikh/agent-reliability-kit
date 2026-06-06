// Tests for the ADR-0016 numeric-count reconciliation gate.
// Run: node --test scripts/check-counts.test.mjs
//
// The unit tests prove the gate CATCHES a planted mismatch (non-tautological);
// the dogfood test reconciles the kit's own public surfaces against runtime
// reality, so a future count edit that forgets a surface fails here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  reconcileCounts,
  countRegistryEntries,
  gatherGroundTruth,
  gatherClaims,
} from './check-counts.mjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('reconcileCounts flags a claim that disagrees with runtime reality', () => {
  const groundTruth = { predicates: 11, adrs: 16, skills: 12, subagents: 1 };
  const claims = [
    { category: 'adrs', value: 15, surface: 'README.md', line: 23, text: '15 ADRs ship' },
    { category: 'predicates', value: 11, surface: 'README.md', line: 19, text: '11 predicates' },
  ];
  const { mismatches, checked } = reconcileCounts({ groundTruth, claims });
  assert.equal(checked, 2);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].category, 'adrs');
  assert.equal(mismatches[0].value, 15);
  assert.equal(mismatches[0].expected, 16);
});

test('reconcileCounts passes when every claim matches runtime reality', () => {
  const groundTruth = { predicates: 11, adrs: 16, skills: 12, subagents: 1 };
  const claims = [
    { category: 'adrs', value: 16, surface: 'README.md', line: 23, text: '16 ADRs' },
    { category: 'skills', value: 12, surface: 'ARCHITECTURE.md', line: 54, text: '12 skills' },
    { category: 'subagents', value: 1, surface: 'ARCHITECTURE.md', line: 54, text: '1 subagent' },
  ];
  const { mismatches } = reconcileCounts({ groundTruth, claims });
  assert.equal(mismatches.length, 0);
});

test('countRegistryEntries counts the BUILTIN_PREDICATES registry block', () => {
  const src = `export const BUILTIN_PREDICATES: Record<string, Predicate> = {\n  a,\n  b,\n  c,\n};\n`;
  assert.equal(countRegistryEntries(src), 3);
});

test("the kit's own public surfaces reconcile with runtime reality (dogfood)", async () => {
  const groundTruth = await gatherGroundTruth(REPO_ROOT);
  const claims = await gatherClaims(REPO_ROOT);
  const { mismatches, checked } = reconcileCounts({ groundTruth, claims });
  assert.ok(checked >= 10, `expected several digit-form count claims, found ${checked}`);
  assert.deepEqual(
    mismatches,
    [],
    'public-surface counts drifted from runtime reality:\n' + JSON.stringify(mismatches, null, 2),
  );
});
