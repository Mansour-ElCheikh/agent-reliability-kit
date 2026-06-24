// Predicate for the ADR-number-integrity gate (ADR-0018, scripts/check-adr-numbers.mjs).
// NON-TAUTOLOGICAL: a no-op checker would fail the "detects the 0012 collision" assertion.
// Also runs the REAL ./docs/decisions through the gate — must be GREEN on a clean tree.
// Run: node --test scripts/check-adr-numbers.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findDuplicateNumbers, findTitleMismatches, checkAdrDir } from './check-adr-numbers.mjs';

// RED on a reused number (the exact 2026-06-09 ADR-0012 collision); ignores template + non-ADR.
test('findDuplicateNumbers flags a reused number, ignores template + non-ADR files', () => {
  assert.deepEqual(
    findDuplicateNumbers(['0012-one-shot.md', '0012-status-projection.md', '0013-gate.md', 'template.md', 'README.md']),
    ['0012'],
  );
  assert.deepEqual(
    findDuplicateNumbers(['0012-one-shot.md', '0013-gate.md', '0017-status-projection.md', 'template.md']),
    [],
  );
});

// Catches a half-finished renumber: file says 0017 but the title still says 0012 (or is missing).
test('findTitleMismatches flags title/filename drift; passes when aligned', () => {
  assert.deepEqual(
    findTitleMismatches([{ name: '0017-x.md', text: '# ADR-0012: x\n\nbody' }]),
    [{ name: '0017-x.md', fileNum: '0017', titleNum: '0012' }],
  );
  assert.deepEqual(findTitleMismatches([{ name: '0017-x.md', text: '# ADR-0017: x\n' }]), []);
  assert.deepEqual(
    findTitleMismatches([{ name: '0018-y.md', text: 'no title line\n' }]),
    [{ name: '0018-y.md', fileNum: '0018', titleNum: null }],
  );
});

// The real docs/decisions/ must pass now (GREEN on current main).
test('the real docs/decisions/ has unique, title-consistent ADR numbers', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'decisions');
  const { dups, mismatches, count } = checkAdrDir(dir);
  assert.deepEqual(dups, [], `duplicate ADR numbers: ${dups.join(', ')}`);
  assert.deepEqual(mismatches, [], `title/filename mismatches: ${JSON.stringify(mismatches)}`);
  assert.ok(count >= 17, `expected >= 17 ADRs, found ${count}`);
});
