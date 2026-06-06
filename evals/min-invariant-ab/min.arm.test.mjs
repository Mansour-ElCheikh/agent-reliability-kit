// Arm M (Min-Invariant) vs the BROKEN impl.
// A FAIL here = catch (the concrete assertion rejected the broken impl).
import { describe, it, expect } from 'vitest';
import { scenarios } from './scenarios.mjs';

describe('Arm M (Min-Invariant) vs BROKEN impl', () => {
  for (const s of scenarios) {
    it(`[${s.id}] (${s.klass}) ${s.name}`, () => s.min(expect, s.broken()));
  }
});
