// Arm S (shape-only) vs the BROKEN impl.
// A PASS here = false-green slip-through (the bug shipped green).
import { describe, it, expect } from 'vitest';
import { scenarios } from './scenarios.mjs';

describe('Arm S (shape-only) vs BROKEN impl', () => {
  for (const s of scenarios) {
    it(`[${s.id}] (${s.klass}) ${s.name}`, () => s.shape(expect, s.broken()));
  }
});
