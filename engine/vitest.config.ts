import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the engine's own suites — NOT the fixture *.test.ts files, which
    // are intentionally-malformed inputs the audit predicates evaluate.
    include: ['test/*.test.ts'],
    exclude: ['test/fixtures/**'],
    // The engine shells out to git; keep tests serial + give them room.
    testTimeout: 20_000,
    pool: 'forks',
  },
});
