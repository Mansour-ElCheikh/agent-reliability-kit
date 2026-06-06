// Sanity control: both arms must PASS against the CORRECT impl.
// A FAIL here means the test is broken (over-strict), not that it "caught" a bug.
import { describe, it, expect } from 'vitest';
import { scenarios } from './scenarios.mjs';

describe('Sanity control — both arms vs CORRECT impl (all must pass)', () => {
  for (const s of scenarios) {
    it(`[${s.id}] shape on correct`, () => s.shape(expect, s.correct()));
    it(`[${s.id}] min on correct`, () => s.min(expect, s.correct()));
  }
});
